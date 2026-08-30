using Archit.Api.Cad;
using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .AllowAnyHeader().AllowAnyMethod().SetIsOriginAllowed(_ => true)));
builder.Services.AddSingleton<ConcurrentDictionary<Guid, CadImportJob>>();
builder.Services.AddSingleton<ExternalCadImportProvider>();
builder.Services.AddSingleton<UnconfiguredCadImportProvider>();
builder.Services.AddSingleton<ICadImportProvider>(services =>
{
    var external = services.GetRequiredService<ExternalCadImportProvider>();
    return external.IsConfigured ? external : services.GetRequiredService<UnconfiguredCadImportProvider>();
});

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

    var id = Guid.NewGuid();
    var queued = new CadImportJob(id, Path.GetFileName(file.FileName), "queued", 0);
    jobs[id] = queued;

    if (!provider.IsConfigured)
    {
        var failed = queued with
        {
            Status = "failed",
            Error = "No licensed DWG import provider is configured on the server. Set ARCHIT_CAD_IMPORTER_PATH to a native ODA/Autodesk worker executable."
        };
        jobs[id] = failed;
        return Results.Json(failed, statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    try
    {
        jobs[id] = queued with { Status = "processing", Progress = 10 };
        await using var stream = file.OpenReadStream();
        var result = await provider.ImportAsync(stream, file.FileName, cancellationToken);
        var completed = queued with
        {
            Status = "completed",
            Progress = 100,
            Document = result.Document,
            Validation = result.Validation
        };
        jobs[id] = completed;
        return Results.Accepted($"/api/cad/imports/{id}", completed);
    }
    catch (Exception ex)
    {
        var failed = queued with { Status = "failed", Error = ex.Message };
        jobs[id] = failed;
        return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.MapGet("/api/cad/imports/{id:guid}", (Guid id, ConcurrentDictionary<Guid, CadImportJob> jobs) =>
    jobs.TryGetValue(id, out var job) ? Results.Ok(job) : Results.NotFound());

app.Run();
