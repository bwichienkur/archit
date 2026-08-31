namespace Archit.Api.Cad;

public sealed class LocalDurableCadImportQueue : ICadImportQueue
{
    private readonly string _root;
    private readonly TimeSpan _pollInterval = TimeSpan.FromMilliseconds(250);

    public LocalDurableCadImportQueue(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _root = configuration["CadImport:QueuePath"] ?? Environment.GetEnvironmentVariable("ARCHIT_CAD_QUEUE_PATH") ?? Path.Combine(environment.ContentRootPath, ".archit-data", "cad-queue");
        Directory.CreateDirectory(_root);
    }

    public async ValueTask EnqueueAsync(Guid jobId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = QueuePath(jobId);
        if (File.Exists(path)) return;
        var temp = path + $".{Guid.NewGuid():N}.tmp";
        await File.WriteAllTextAsync(temp, jobId.ToString("D"), cancellationToken);
        try { File.Move(temp, path); }
        catch (IOException) when (File.Exists(path)) { File.Delete(temp); }
    }

    public async ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            foreach (var path in Directory.EnumerateFiles(_root, "*.queue", SearchOption.TopDirectoryOnly).OrderBy(File.GetCreationTimeUtc))
            {
                var claim = path + $".{Environment.ProcessId}.{Guid.NewGuid():N}.claim";
                try { File.Move(path, claim); }
                catch (IOException) { continue; }
                try
                {
                    var text = await File.ReadAllTextAsync(claim, cancellationToken);
                    if (!Guid.TryParse(text.Trim(), out var jobId)) throw new InvalidDataException($"Invalid CAD queue marker {claim}.");
                    File.Delete(claim);
                    return jobId;
                }
                catch
                {
                    if (File.Exists(claim)) File.Move(claim, path, overwrite: true);
                    throw;
                }
            }
            await Task.Delay(_pollInterval, cancellationToken);
        }
    }

    private string QueuePath(Guid jobId) => Path.Combine(_root, $"{jobId:N}.queue");
}
