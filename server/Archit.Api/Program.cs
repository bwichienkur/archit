using Archit.Api.Cad;
using Archit.Api.Projects;
using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").GetChildren()
    .Select(item => item.Value)
    .Where(value => !string.IsNullOrWhiteSpace(value))
    .Cast<string>()
    .ToArray();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    policy.AllowAnyHeader().AllowAnyMethod();
    if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment()) policy.SetIsOriginAllowed(_ => true);
    else if (allowedOrigins.Length > 0) policy.WithOrigins(allowedOrigins);
}));
builder.Services.AddSingleton<ConcurrentDictionary<Guid, CadImportJob>>();
builder.Services.AddSingleton<ExternalCadImportProvider>();
builder.Services.AddSingleton<UnconfiguredCadImportProvider>();
builder.Services.AddSingleton<ICadImportProvider>(services =>
{
    var external = services.GetRequiredService<ExternalCadImportProvider>();
    return external.IsConfigured ? external : services.GetRequiredService<UnconfiguredCadImportProvider>();
});
builder.Services.AddSingleton<ICadImportQueue, InMemoryCadImportQueue>();
builder.Services.AddSingleton<ICadArtifactStore, LocalCadArtifactStore>();
builder.Services.AddHostedService<CadImportWorker>();
builder.Services.AddSingleton<IProjectRepository, InMemoryProjectRepository>();

var app = builder.Build();
app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Archit.Api" }));

app.MapGet("/api/cad/provider", (ICadImportProvider provider) => Results.Ok(new
{
    provider = provider.Name,
    configured = provider.IsConfigured
}));

app.MapPost("/api/cad/imports", async (
    HttpRequest request,
    ICadImportProvider provider,
    ICadArtifactStore artifacts,
    ICadImportQueue queue,
    ConcurrentDictionary<Guid, CadImportJob> jobs,
    CancellationToken cancellationToken) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest(new { error = "Expected multipart/form-data." });

    var form = await request.ReadFormAsync(cancellationToken);
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "A non-empty file field named 'file' is required." });

    if (!string.Equals(Path.GetExtension(file.FileName), ".dwg", StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { error = "This endpoint currently accepts .dwg files only." });

    const long maxFileBytes = 250L * 1024L * 1024L;
    if (file.Length > maxFileBytes)
        return Results.BadRequest(new { error = "DWG exceeds the 250 MB import limit." });

    if (!provider.IsConfigured)
        return Results.Json(new
        {
            error = "No licensed DWG import provider is configured on the server. Set ARCHIT_CAD_IMPORTER_PATH to a native ODA/Autodesk worker executable."
        }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var id = Guid.NewGuid();
    var safeFileName = Path.GetFileName(file.FileName);
    var queued = new CadImportJob(id, safeFileName, "queued", 0);

    try
    {
        await using var source = file.OpenReadStream();
        await artifacts.SaveSourceAsync(id, safeFileName, source, cancellationToken);
        jobs[id] = queued;
        await queue.EnqueueAsync(id, cancellationToken);
        return Results.Accepted($"/api/cad/imports/{id}", queued);
    }
    catch (Exception ex)
    {
        jobs.TryRemove(id, out _);
        return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapGet("/api/cad/imports/{id:guid}", (Guid id, ConcurrentDictionary<Guid, CadImportJob> jobs) =>
    jobs.TryGetValue(id, out var job) ? Results.Ok(job) : Results.NotFound());

app.MapPost("/api/projects", async (CreateProjectRequest request, IProjectRepository repository, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Project name is required." });
    if (request.Name.Trim().Length > 160) return Results.BadRequest(new { error = "Project name cannot exceed 160 characters." });
    var project = await repository.CreateAsync(request.Name, cancellationToken);
    return Results.Created($"/api/projects/{project.Id}", project);
});

app.MapGet("/api/projects", async (IProjectRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.ListAsync(cancellationToken)));

app.MapGet("/api/projects/{projectId:guid}", async (Guid projectId, IProjectRepository repository, CancellationToken cancellationToken) =>
{
    var project = await repository.GetAsync(projectId, cancellationToken);
    return project is null ? Results.NotFound() : Results.Ok(project);
});

app.MapPost("/api/projects/{projectId:guid}/revisions", async (Guid projectId, CreateRevisionRequest request, IProjectRepository repository, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Kind)) return Results.BadRequest(new { error = "Revision kind is required." });
    if (request.Kind is not ("import" or "semantic" or "user-edit" or "configuration"))
        return Results.BadRequest(new { error = "Revision kind must be import, semantic, user-edit, or configuration." });
    if (string.IsNullOrWhiteSpace(request.CreatedBy)) return Results.BadRequest(new { error = "CreatedBy is required." });
    if (request.Model.ValueKind is System.Text.Json.JsonValueKind.Undefined or System.Text.Json.JsonValueKind.Null)
        return Results.BadRequest(new { error = "Revision model payload is required." });

    try
    {
        var revision = await repository.AddRevisionAsync(projectId, request, cancellationToken);
        return Results.Created($"/api/projects/{projectId}/revisions/{revision.Id}", revision);
    }
    catch (KeyNotFoundException) { return Results.NotFound(); }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/projects/{projectId:guid}/revisions", async (Guid projectId, IProjectRepository repository, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await repository.ListRevisionsAsync(projectId, cancellationToken)); }
    catch (KeyNotFoundException) { return Results.NotFound(); }
});

app.MapGet("/api/projects/{projectId:guid}/revisions/{revisionId:guid}", async (Guid projectId, Guid revisionId, IProjectRepository repository, CancellationToken cancellationToken) =>
{
    var revision = await repository.GetRevisionAsync(projectId, revisionId, cancellationToken);
    return revision is null ? Results.NotFound() : Results.Ok(revision);
});

app.Run();
