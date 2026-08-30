using System.Text.Json;

namespace Archit.Api.Cad;

public interface ICadArtifactStore
{
    Task SaveSourceAsync(Guid jobId, string fileName, Stream source, CancellationToken cancellationToken);
    Task<Stream> OpenSourceAsync(Guid jobId, CancellationToken cancellationToken);
    Task SaveResultsAsync(Guid jobId, NormalizedCadDocument document, CadImportValidation validation, CancellationToken cancellationToken);
}

public sealed class LocalCadArtifactStore(IConfiguration configuration, IWebHostEnvironment environment) : ICadArtifactStore
{
    private readonly string _root = ResolveRoot(configuration, environment);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public async Task SaveSourceAsync(Guid jobId, string fileName, Stream source, CancellationToken cancellationToken)
    {
        var directory = JobDirectory(jobId);
        Directory.CreateDirectory(directory);
        var extension = string.Equals(Path.GetExtension(fileName), ".dwg", StringComparison.OrdinalIgnoreCase) ? ".dwg" : ".bin";
        var target = Path.Combine(directory, $"source{extension}");
        await using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await source.CopyToAsync(output, cancellationToken);
        await File.WriteAllTextAsync(Path.Combine(directory, "filename.txt"), Path.GetFileName(fileName), cancellationToken);
    }

    public Task<Stream> OpenSourceAsync(Guid jobId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var directory = JobDirectory(jobId);
        var path = Directory.Exists(directory)
            ? Directory.EnumerateFiles(directory, "source.*", SearchOption.TopDirectoryOnly).SingleOrDefault()
            : null;
        if (path is null) throw new FileNotFoundException($"Source artifact for CAD import {jobId} was not found.");
        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult(stream);
    }

    public async Task SaveResultsAsync(Guid jobId, NormalizedCadDocument document, CadImportValidation validation, CancellationToken cancellationToken)
    {
        var directory = JobDirectory(jobId);
        Directory.CreateDirectory(directory);
        await File.WriteAllTextAsync(Path.Combine(directory, "normalized.json"), JsonSerializer.Serialize(document, JsonOptions), cancellationToken);
        await File.WriteAllTextAsync(Path.Combine(directory, "validation.json"), JsonSerializer.Serialize(validation, JsonOptions), cancellationToken);
    }

    private string JobDirectory(Guid jobId) => Path.Combine(_root, jobId.ToString("N"));

    private static string ResolveRoot(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["CadImport:ArtifactPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_CAD_ARTIFACT_PATH");
        var root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, ".archit-data", "cad-imports")
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(root);
        return root;
    }
}
