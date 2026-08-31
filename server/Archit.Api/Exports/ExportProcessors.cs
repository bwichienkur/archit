using System.Text;
using System.Text.Json;
using Archit.Api.Projects;

namespace Archit.Api.Exports;

public sealed record ExportArtifact(string FileName,string ContentType,ReadOnlyMemory<byte> Content);

public interface IExportProcessor
{
    string Format { get; }
    Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken);
}

public sealed class JsonExportProcessor : IExportProcessor
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    public string Format => "json";

    public Task<ExportArtifact> ProcessAsync(ExportJobRecord job,ProjectRevision revision,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var envelope=new
        {
            schemaVersion=1,
            projectId=job.ProjectId,
            revisionId=revision.Id,
            revisionKind=revision.Kind,
            sourceImportId=revision.SourceImportId,
            generatedAt=DateTimeOffset.UtcNow,
            model=revision.Model
        };
        var bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope,JsonOptions));
        return Task.FromResult(new ExportArtifact($"archit-{job.ProjectId:N}-{revision.Id:N}.json","application/json",bytes));
    }
}

public sealed class ExportProcessorRegistry
{
    private readonly IReadOnlyDictionary<string,IExportProcessor> _processors;

    public ExportProcessorRegistry()
    {
        IExportProcessor[] builtIns=[new JsonExportProcessor()];
        _processors=builtIns.ToDictionary(processor=>processor.Format,StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyCollection<string> Formats => _processors.Keys.ToArray();
    public bool Supports(string format)=>!string.IsNullOrWhiteSpace(format)&&_processors.ContainsKey(format);
    public IExportProcessor GetRequired(string format)=>_processors.TryGetValue(format,out var processor)
        ? processor
        : throw new InvalidOperationException($"Export format {format} does not have a configured server-side processor.");
}
