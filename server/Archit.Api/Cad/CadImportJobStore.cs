using System.Text.Json;

namespace Archit.Api.Cad;

public interface ICadImportJobStore
{
    Task<CadImportJob?> GetAsync(Guid jobId, CancellationToken cancellationToken);
    Task SaveAsync(CadImportJob job, CancellationToken cancellationToken);
    Task DeleteAsync(Guid jobId, CancellationToken cancellationToken);
    Task<IReadOnlyList<CadImportJob>> ListRecoverableAsync(CancellationToken cancellationToken);
}

public sealed class LocalCadImportJobStore(IConfiguration configuration, IWebHostEnvironment environment) : ICadImportJobStore
{
    private readonly string _root = ResolveRoot(configuration, environment);
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public async Task<CadImportJob?> GetAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var path = JobPath(jobId);
        if (!File.Exists(path)) return null;
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return await JsonSerializer.DeserializeAsync<CadImportJob>(stream, JsonOptions, cancellationToken);
    }

    public async Task SaveAsync(CadImportJob job, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var target = JobPath(job.Id);
            var temporary = target + ".tmp";
            await using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
                await JsonSerializer.SerializeAsync(stream, job, JsonOptions, cancellationToken);
            File.Move(temporary, target, overwrite: true);
        }
        finally { _gate.Release(); }
    }

    public Task DeleteAsync(Guid jobId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = JobPath(jobId);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<CadImportJob>> ListRecoverableAsync(CancellationToken cancellationToken)
    {
        var jobs = new List<CadImportJob>();
        foreach (var path in Directory.EnumerateFiles(_root, "*.json", SearchOption.TopDirectoryOnly))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
                var job = await JsonSerializer.DeserializeAsync<CadImportJob>(stream, JsonOptions, cancellationToken);
                if (job is not null && job.Status is "queued" or "processing") jobs.Add(job);
            }
            catch (JsonException) { /* corrupt state is skipped and surfaced through logs by the worker */ }
        }
        return jobs.OrderBy(job => job.Id).ToArray();
    }

    private string JobPath(Guid jobId) => Path.Combine(_root, $"{jobId:N}.json");

    private static string ResolveRoot(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["CadImport:JobStatePath"] ?? Environment.GetEnvironmentVariable("ARCHIT_CAD_JOB_STATE_PATH");
        var root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, ".archit-data", "cad-jobs")
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(root);
        return root;
    }
}
