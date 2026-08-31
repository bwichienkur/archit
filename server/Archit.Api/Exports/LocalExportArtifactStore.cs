namespace Archit.Api.Exports;

public sealed class LocalExportArtifactStore : IExportArtifactStore
{
    private readonly string _root;

    public LocalExportArtifactStore(IConfiguration configuration,IWebHostEnvironment environment)
    {
        _root = configuration["Exports:ArtifactPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_EXPORT_ARTIFACT_PATH") ?? Path.Combine(environment.ContentRootPath,".archit-data","export-artifacts");
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(ExportJobRecord job,string fileName,ReadOnlyMemory<byte> content,CancellationToken cancellationToken)
    {
        var safeName=Path.GetFileName(fileName);if(string.IsNullOrWhiteSpace(safeName))throw new InvalidOperationException("Export artifact filename is required.");
        var dir=Path.Combine(_root,job.ProjectId.ToString("N"),job.Id.ToString("N"));Directory.CreateDirectory(dir);var path=Path.Combine(dir,safeName);await File.WriteAllBytesAsync(path,content.ToArray(),cancellationToken);return path;
    }

    public Task<Stream> OpenAsync(ExportJobRecord job,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();if(string.IsNullOrWhiteSpace(job.ArtifactPath)||!File.Exists(job.ArtifactPath))throw new FileNotFoundException($"Export artifact for job {job.Id} was not found.");Stream stream=new FileStream(job.ArtifactPath,FileMode.Open,FileAccess.Read,FileShare.Read,81920,useAsync:true);return Task.FromResult(stream);
    }
}
