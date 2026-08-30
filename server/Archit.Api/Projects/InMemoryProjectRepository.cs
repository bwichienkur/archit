using System.Collections.Concurrent;

namespace Archit.Api.Projects;

public sealed class InMemoryProjectRepository : IProjectRepository
{
    private readonly ConcurrentDictionary<Guid, ProjectRecord> _projects = new();
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<Guid, ProjectRevision>> _revisions = new();

    public Task<ProjectRecord> CreateAsync(string name, Guid? tenantId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var now = DateTimeOffset.UtcNow;
        var project = new ProjectRecord(Guid.NewGuid(), tenantId, name.Trim(), now, now);
        _projects[project.Id] = project;
        _revisions.TryAdd(project.Id, new ConcurrentDictionary<Guid, ProjectRevision>());
        return Task.FromResult(project);
    }

    public Task<ProjectRecord?> GetAsync(Guid projectId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _projects.TryGetValue(projectId, out var project);
        return Task.FromResult(project);
    }

    public Task<IReadOnlyList<ProjectRecord>> ListAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        IReadOnlyList<ProjectRecord> projects = _projects.Values.OrderByDescending(project => project.UpdatedAt).ToArray();
        return Task.FromResult(projects);
    }

    public Task<ProjectRevision> AddRevisionAsync(Guid projectId, CreateRevisionRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_projects.TryGetValue(projectId, out var project)) throw new KeyNotFoundException($"Project {projectId} was not found.");

        var revisions = _revisions.GetOrAdd(projectId, _ => new ConcurrentDictionary<Guid, ProjectRevision>());
        if (request.ParentRevisionId is { } requestedParentId && !revisions.ContainsKey(requestedParentId))
            throw new InvalidOperationException($"Parent revision {requestedParentId} does not belong to project {projectId}.");
        var parentRevisionId=request.ParentRevisionId??revisions.Values.OrderByDescending(item=>item.CreatedAt).ThenByDescending(item=>item.Id).FirstOrDefault()?.Id;

        var revision = new ProjectRevision(
            Guid.NewGuid(),
            projectId,
            parentRevisionId,
            request.Kind.Trim(),
            DateTimeOffset.UtcNow,
            request.CreatedBy.Trim(),
            request.SourceImportId,
            request.Model.Clone(),
            request.Note);
        revisions[revision.Id] = revision;
        _projects[projectId] = project with { UpdatedAt = revision.CreatedAt };
        return Task.FromResult(revision);
    }

    public Task<ProjectRevision?> GetRevisionAsync(Guid projectId, Guid revisionId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ProjectRevision? revision = null;
        if (_revisions.TryGetValue(projectId, out var revisions)) revisions.TryGetValue(revisionId, out revision);
        return Task.FromResult(revision);
    }

    public Task<IReadOnlyList<ProjectRevision>> ListRevisionsAsync(Guid projectId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_projects.ContainsKey(projectId)) throw new KeyNotFoundException($"Project {projectId} was not found.");
        var revisions = _revisions.TryGetValue(projectId, out var values)
            ? values.Values.OrderByDescending(revision => revision.CreatedAt).ToArray()
            : Array.Empty<ProjectRevision>();
        return Task.FromResult<IReadOnlyList<ProjectRevision>>(revisions);
    }
}
