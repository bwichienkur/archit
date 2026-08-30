using Archit.Api.Cad;
using Archit.Api.Catalog;
using Archit.Api.Collaboration;
using Archit.Api.Exports;
using Archit.Api.Infrastructure;
using Archit.Api.Projects;
using Archit.Api.Tenancy;

var builder = WebApplication.CreateBuilder(args);
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").GetChildren()
    .Select(item => item.Value)
    .Where(value => !string.IsNullOrWhiteSpace(value))
    .Cast<string>()
    .ToArray();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment()) policy.SetIsOriginAllowed(_ => true);
    else if (allowedOrigins.Length > 0) policy.WithOrigins(allowedOrigins);
}));
builder.Services.AddSignalR();
builder.Services.AddSingleton<ExternalCadImportProvider>();
builder.Services.AddSingleton<UnconfiguredCadImportProvider>();
builder.Services.AddSingleton<ICadImportProvider>(services =>
{
    var external = services.GetRequiredService<ExternalCadImportProvider>();
    return external.IsConfigured ? external : services.GetRequiredService<UnconfiguredCadImportProvider>();
});
builder.Services.AddSingleton<ICadImportQueue, LocalDurableCadImportQueue>();
builder.Services.AddSingleton<ICadArtifactStore, LocalCadArtifactStore>();
builder.Services.AddSingleton<ICadImportJobStore, LocalCadImportJobStore>();
builder.Services.AddHostedService<CadImportWorker>();
builder.Services.AddSingleton<IProjectRepository, LocalProjectRepository>();
builder.Services.AddSingleton<ICatalogRepository, LocalCatalogRepository>();
builder.Services.AddSingleton<ICollaborationRepository, LocalCollaborationRepository>();
builder.Services.AddSingleton<IProjectEventBroadcaster, SignalRProjectEventBroadcaster>();
builder.Services.AddSingleton<ITenantRepository, LocalTenantRepository>();
builder.Services.AddSingleton<IExportJobRepository, LocalExportJobRepository>();
builder.Services.AddSingleton<IExportArtifactStore, LocalExportArtifactStore>();
builder.Services.AddHostedService<ExportWorker>();
builder.Services.AddConfiguredPersistence(builder.Configuration);

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
    ICadImportJobStore jobs,
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
        await jobs.SaveAsync(queued, cancellationToken);
        await queue.EnqueueAsync(id, cancellationToken);
        return Results.Accepted($"/api/cad/imports/{id}", queued);
    }
    catch (Exception ex)
    {
        await jobs.DeleteAsync(id, CancellationToken.None);
        return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapGet("/api/cad/imports/{id:guid}", async (Guid id, ICadImportJobStore jobs, CancellationToken cancellationToken) =>
{
    var job = await jobs.GetAsync(id, cancellationToken);
    return job is null ? Results.NotFound() : Results.Ok(job);
});

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

app.MapPut("/api/catalog/products", async (UpsertCatalogProductRequest request, ICatalogRepository repository, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await repository.UpsertAsync(request, cancellationToken)); }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/catalog/products/{id:guid}", async (Guid id, ICatalogRepository repository, CancellationToken cancellationToken) =>
{
    var product = await repository.GetAsync(id, cancellationToken);
    return product is null ? Results.NotFound() : Results.Ok(product);
});

app.MapGet("/api/catalog/products", async (string? manufacturer, string? category, string? q, ICatalogRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.SearchAsync(manufacturer, category, q, cancellationToken)));

app.MapPost("/api/projects/{projectId:guid}/collaboration/events", async (Guid projectId, CreateCollaborationEventRequest request, ICollaborationRepository repository, IProjectEventBroadcaster broadcaster, CancellationToken cancellationToken) =>
{
    try
    {
        var created = await repository.AddEventAsync(projectId, request, cancellationToken);
        await broadcaster.BroadcastAsync(projectId, "projectEvent", created, cancellationToken);
        return Results.Created($"/api/projects/{projectId}/collaboration/events/{created.Id}", created);
    }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/projects/{projectId:guid}/collaboration/events", async (Guid projectId, ICollaborationRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.ListEventsAsync(projectId, cancellationToken)));

app.MapPost("/api/projects/{projectId:guid}/collaboration/comments", async (Guid projectId, CreateCommentRequest request, ICollaborationRepository repository, IProjectEventBroadcaster broadcaster, CancellationToken cancellationToken) =>
{
    try
    {
        var created = await repository.AddCommentAsync(projectId, request, cancellationToken);
        await broadcaster.BroadcastAsync(projectId, "commentCreated", created, cancellationToken);
        return Results.Created($"/api/projects/{projectId}/collaboration/comments/{created.Id}", created);
    }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/projects/{projectId:guid}/collaboration/comments", async (Guid projectId, bool? includeResolved, ICollaborationRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.ListCommentsAsync(projectId, includeResolved ?? true, cancellationToken)));

app.MapPost("/api/projects/{projectId:guid}/collaboration/comments/{commentId:guid}/resolve", async (Guid projectId, Guid commentId, ResolveCommentRequest request, ICollaborationRepository repository, IProjectEventBroadcaster broadcaster, CancellationToken cancellationToken) =>
{
    try
    {
        var resolved = await repository.ResolveCommentAsync(projectId, commentId, request, cancellationToken);
        await broadcaster.BroadcastAsync(projectId, "commentResolved", resolved, cancellationToken);
        return Results.Ok(resolved);
    }
    catch (KeyNotFoundException) { return Results.NotFound(); }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapPost("/api/tenants", async (CreateTenantRequest request, ITenantRepository repository, CancellationToken cancellationToken) =>
{
    try
    {
        var tenant = await repository.CreateAsync(request.Name, cancellationToken);
        return Results.Created($"/api/tenants/{tenant.Id}", tenant);
    }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/tenants/{tenantId:guid}", async (Guid tenantId, ITenantRepository repository, CancellationToken cancellationToken) =>
{
    var tenant = await repository.GetAsync(tenantId, cancellationToken);
    return tenant is null ? Results.NotFound() : Results.Ok(tenant);
});

app.MapPut("/api/tenants/{tenantId:guid}/memberships", async (Guid tenantId, UpsertMembershipRequest request, ITenantRepository repository, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await repository.UpsertMembershipAsync(tenantId, request, cancellationToken)); }
    catch (KeyNotFoundException) { return Results.NotFound(); }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/tenants/{tenantId:guid}/memberships/{userId}", async (Guid tenantId, string userId, ITenantRepository repository, CancellationToken cancellationToken) =>
{
    var membership = await repository.GetMembershipAsync(tenantId, userId, cancellationToken);
    return membership is null ? Results.NotFound() : Results.Ok(membership);
});

app.MapPost("/api/projects/{projectId:guid}/exports", async (Guid projectId, CreateExportRequest request, IExportJobRepository repository, CancellationToken cancellationToken) =>
{
    if (!string.Equals(request.Format,"json",StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { error = $"Server-side export format '{request.Format}' is not configured. JSON is currently available; DWG/DXF/IFC require format-specific providers." });
    try
    {
        var job = await repository.CreateAsync(projectId, request, cancellationToken);
        return Results.Accepted($"/api/exports/{job.Id}", job);
    }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/projects/{projectId:guid}/exports", async (Guid projectId, IExportJobRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.ListAsync(projectId, cancellationToken)));

app.MapGet("/api/exports/{jobId:guid}", async (Guid jobId, IExportJobRepository repository, CancellationToken cancellationToken) =>
{
    var job = await repository.GetAsync(jobId, cancellationToken);
    return job is null ? Results.NotFound() : Results.Ok(job);
});

app.MapGet("/api/exports/{jobId:guid}/artifact", async (Guid jobId, IExportJobRepository repository, IExportArtifactStore artifacts, CancellationToken cancellationToken) =>
{
    var job = await repository.GetAsync(jobId, cancellationToken);
    if (job is null) return Results.NotFound();
    if (job.Status != "completed" || string.IsNullOrWhiteSpace(job.ArtifactPath)) return Results.Conflict(new { error = "Export artifact is not ready." });
    try
    {
        var stream = await artifacts.OpenAsync(job, cancellationToken);
        return Results.Stream(stream,"application/json",Path.GetFileName(job.ArtifactPath));
    }
    catch (FileNotFoundException) { return Results.NotFound(); }
});

app.MapHub<ProjectHub>("/hubs/projects");

app.Run();
