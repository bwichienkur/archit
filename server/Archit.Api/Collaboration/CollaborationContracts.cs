namespace Archit.Api.Collaboration;

public sealed record CollaborationEventRecord(
    Guid Id,
    Guid ProjectId,
    Guid? RevisionId,
    string ActorId,
    string ActorRole,
    string Type,
    string? TargetKind,
    string? TargetId,
    DateTimeOffset CreatedAt,
    Dictionary<string,string?> Payload);

public sealed record CollaborationCommentRecord(
    Guid Id,
    Guid ProjectId,
    Guid? RevisionId,
    string AuthorId,
    string AuthorRole,
    string TargetKind,
    string TargetId,
    string Body,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt,
    string? ResolvedBy);

public sealed record CreateCollaborationEventRequest(Guid? RevisionId,string ActorId,string ActorRole,string Type,string? TargetKind,string? TargetId,Dictionary<string,string?>? Payload);
public sealed record CreateCommentRequest(Guid? RevisionId,string AuthorId,string AuthorRole,string TargetKind,string TargetId,string Body);
public sealed record ResolveCommentRequest(string ResolvedBy);

public interface ICollaborationRepository
{
    Task<CollaborationEventRecord> AddEventAsync(Guid projectId, CreateCollaborationEventRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<CollaborationEventRecord>> ListEventsAsync(Guid projectId, CancellationToken cancellationToken);
    Task<CollaborationCommentRecord> AddCommentAsync(Guid projectId, CreateCommentRequest request, CancellationToken cancellationToken);
    Task<CollaborationCommentRecord> ResolveCommentAsync(Guid projectId, Guid commentId, ResolveCommentRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<CollaborationCommentRecord>> ListCommentsAsync(Guid projectId, bool includeResolved, CancellationToken cancellationToken);
}
