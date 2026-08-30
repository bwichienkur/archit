using System.Text.Json;

namespace Archit.Api.Projects;

public sealed record ProjectRecord(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ProjectRevision(
    Guid Id,
    Guid ProjectId,
    Guid? ParentRevisionId,
    string Kind,
    DateTimeOffset CreatedAt,
    string CreatedBy,
    Guid? SourceImportId,
    JsonElement Model,
    string? Note = null);

public sealed record CreateProjectRequest(string Name);

public sealed record CreateRevisionRequest(
    Guid? ParentRevisionId,
    string Kind,
    string CreatedBy,
    Guid? SourceImportId,
    JsonElement Model,
    string? Note);

public interface IProjectRepository
{
    Task<ProjectRecord> CreateAsync(string name, CancellationToken cancellationToken);
    Task<ProjectRecord?> GetAsync(Guid projectId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProjectRecord>> ListAsync(CancellationToken cancellationToken);
    Task<ProjectRevision> AddRevisionAsync(Guid projectId, CreateRevisionRequest request, CancellationToken cancellationToken);
    Task<ProjectRevision?> GetRevisionAsync(Guid projectId, Guid revisionId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProjectRevision>> ListRevisionsAsync(Guid projectId, CancellationToken cancellationToken);
}
