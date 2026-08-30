using System.Text.Json;

namespace Archit.Api.Exports;

public sealed class LocalExportJobRepository : IExportJobRepository
{
    private readonly string _root;
    private readonly SemaphoreSlim _gate = new(1,1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public LocalExportJobRepository(IConfiguration configuration,IWebHostEnvironment environment)
    {
        _root = configuration["Exports:DataPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_EXPORT_PATH") ?? Path.Combine(environment.ContentRootPath,".archit-data","exports");
        Directory.CreateDirectory(_root);
    }

    public async Task<ExportJobRecord> CreateAsync(Guid projectId,CreateExportRequest request,CancellationToken cancellationToken)
    {
        if(request.RevisionId==Guid.Empty)throw new InvalidOperationException("RevisionId is required.");
        if(string.IsNullOrWhiteSpace(request.Format)||string.IsNullOrWhiteSpace(request.RequestedBy))throw new InvalidOperationException("Format and RequestedBy are required.");
        var now=DateTimeOffset.UtcNow;var job=new ExportJobRecord(Guid.NewGuid(),projectId,request.RevisionId,request.Format.Trim().ToLowerInvariant(),"queued",0,request.RequestedBy.Trim(),now,now,null,null);await SaveAsync(job,cancellationToken);return job;
    }

    public async Task<ExportJobRecord?> GetAsync(Guid jobId,CancellationToken cancellationToken)
    {
        foreach(var path in Directory.EnumerateFiles(_root,$"{jobId:N}.json",SearchOption.AllDirectories)){await using var stream=File.OpenRead(path);return await JsonSerializer.DeserializeAsync<ExportJobRecord>(stream,JsonOptions,cancellationToken);}return null;
    }

    public async Task<IReadOnlyList<ExportJobRecord>> ListAsync(Guid projectId,CancellationToken cancellationToken)
    {
        var dir=Path.Combine(_root,projectId.ToString("N"));if(!Directory.Exists(dir))return Array.Empty<ExportJobRecord>();var list=new List<ExportJobRecord>();foreach(var path in Directory.EnumerateFiles(dir,"*.json")){await using var stream=File.OpenRead(path);var job=await JsonSerializer.DeserializeAsync<ExportJobRecord>(stream,JsonOptions,cancellationToken);if(job is not null)list.Add(job);}return list.OrderByDescending(job=>job.CreatedAt).ToArray();
    }

    public async Task SaveAsync(ExportJobRecord job,CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);try{var dir=Path.Combine(_root,job.ProjectId.ToString("N"));Directory.CreateDirectory(dir);var target=Path.Combine(dir,$"{job.Id:N}.json"),temp=target+".tmp";await File.WriteAllTextAsync(temp,JsonSerializer.Serialize(job,JsonOptions),cancellationToken);File.Move(temp,target,overwrite:true);}finally{_gate.Release();}
    }
}
