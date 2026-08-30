namespace Archit.Api.Exports;

public sealed record ExportJobRecord(Guid Id,Guid ProjectId,Guid RevisionId,string Format,string Status,int Progress,string RequestedBy,DateTimeOffset CreatedAt,DateTimeOffset UpdatedAt,string? ArtifactPath,string? Error);
public sealed record CreateExportRequest(Guid RevisionId,string Format,string RequestedBy);

public interface IExportJobRepository
{
    Task<ExportJobRecord> CreateAsync(Guid projectId,CreateExportRequest request,CancellationToken cancellationToken);
    Task<ExportJobRecord?> GetAsync(Guid jobId,CancellationToken cancellationToken);
    Task<IReadOnlyList<ExportJobRecord>> ListAsync(Guid projectId,CancellationToken cancellationToken);
    Task SaveAsync(ExportJobRecord job,CancellationToken cancellationToken);
}
