using System.Text.Json;

namespace Archit.Api.Collaboration;

public sealed class LocalCollaborationRepository : ICollaborationRepository
{
    private readonly string _root;
    private readonly SemaphoreSlim _gate = new(1,1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public LocalCollaborationRepository(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _root = configuration["Collaboration:DataPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_COLLABORATION_PATH") ?? Path.Combine(environment.ContentRootPath, ".archit-data", "collaboration");
        Directory.CreateDirectory(_root);
    }

    public async Task<CollaborationEventRecord> AddEventAsync(Guid projectId, CreateCollaborationEventRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ActorId) || string.IsNullOrWhiteSpace(request.ActorRole) || string.IsNullOrWhiteSpace(request.Type)) throw new InvalidOperationException("ActorId, ActorRole, and Type are required.");
        var record = new CollaborationEventRecord(Guid.NewGuid(), projectId, request.RevisionId, request.ActorId.Trim(), request.ActorRole.Trim(), request.Type.Trim(), request.TargetKind?.Trim(), request.TargetId?.Trim(), DateTimeOffset.UtcNow, request.Payload ?? new());
        await AppendAsync(EventPath(projectId), record, cancellationToken);
        return record;
    }

    public async Task<IReadOnlyList<CollaborationEventRecord>> ListEventsAsync(Guid projectId, CancellationToken cancellationToken)
        => (await ReadLinesAsync<CollaborationEventRecord>(EventPath(projectId), cancellationToken)).OrderBy(item => item.CreatedAt).ToArray();

    public async Task<CollaborationCommentRecord> AddCommentAsync(Guid projectId, CreateCommentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.AuthorId) || string.IsNullOrWhiteSpace(request.AuthorRole) || string.IsNullOrWhiteSpace(request.TargetKind) || string.IsNullOrWhiteSpace(request.TargetId) || string.IsNullOrWhiteSpace(request.Body)) throw new InvalidOperationException("Comment author, target, and body are required.");
        var record = new CollaborationCommentRecord(Guid.NewGuid(), projectId, request.RevisionId, request.AuthorId.Trim(), request.AuthorRole.Trim(), request.TargetKind.Trim(), request.TargetId.Trim(), request.Body.Trim(), DateTimeOffset.UtcNow, null, null);
        await AppendAsync(CommentPath(projectId), record, cancellationToken);
        return record;
    }

    public async Task<CollaborationCommentRecord> ResolveCommentAsync(Guid projectId, Guid commentId, ResolveCommentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ResolvedBy)) throw new InvalidOperationException("ResolvedBy is required.");
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var comments = (await ReadLinesAsync<CollaborationCommentRecord>(CommentPath(projectId), cancellationToken)).ToList();
            var index = comments.FindIndex(item => item.Id == commentId);
            if (index < 0) throw new KeyNotFoundException($"Comment {commentId} was not found.");
            var resolved = comments[index] with { ResolvedAt = DateTimeOffset.UtcNow, ResolvedBy = request.ResolvedBy.Trim() };
            comments[index] = resolved;
            await RewriteLinesUnsafeAsync(CommentPath(projectId), comments, cancellationToken);
            return resolved;
        }
        finally { _gate.Release(); }
    }

    public async Task<IReadOnlyList<CollaborationCommentRecord>> ListCommentsAsync(Guid projectId, bool includeResolved, CancellationToken cancellationToken)
    {
        var comments = await ReadLinesAsync<CollaborationCommentRecord>(CommentPath(projectId), cancellationToken);
        return comments.Where(item => includeResolved || item.ResolvedAt is null).OrderBy(item => item.CreatedAt).ToArray();
    }

    private async Task AppendAsync<T>(string path, T value, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.AppendAllTextAsync(path, JsonSerializer.Serialize(value, JsonOptions) + Environment.NewLine, cancellationToken);
        }
        finally { _gate.Release(); }
    }

    private static async Task<List<T>> ReadLinesAsync<T>(string path, CancellationToken cancellationToken)
    {
        var result = new List<T>();
        if (!File.Exists(path)) return result;
        foreach (var line in await File.ReadAllLinesAsync(path, cancellationToken))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var value = JsonSerializer.Deserialize<T>(line, JsonOptions);
            if (value is not null) result.Add(value);
        }
        return result;
    }

    private static async Task RewriteLinesUnsafeAsync<T>(string path, IEnumerable<T> values, CancellationToken cancellationToken)
    {
        var temp = path + ".tmp";
        var lines = values.Select(value => JsonSerializer.Serialize(value, JsonOptions));
        await File.WriteAllLinesAsync(temp, lines, cancellationToken);
        File.Move(temp, path, overwrite: true);
    }

    private string EventPath(Guid projectId) => Path.Combine(_root, projectId.ToString("N"), "events.ndjson");
    private string CommentPath(Guid projectId) => Path.Combine(_root, projectId.ToString("N"), "comments.ndjson");
}
