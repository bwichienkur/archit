using System.Collections.Concurrent;

namespace Archit.Api.Collaboration;

public sealed record ProjectPresence(
    Guid ProjectId,
    string ConnectionId,
    string UserId,
    string DisplayName,
    string Role,
    string? SelectedKind,
    string? SelectedId,
    DateTimeOffset LastSeenAt);

public sealed record EditLease(
    Guid ProjectId,
    string ObjectKind,
    string ObjectId,
    string UserId,
    string ConnectionId,
    DateTimeOffset AcquiredAt,
    DateTimeOffset ExpiresAt);

public sealed class ProjectPresenceRegistry
{
    private readonly ConcurrentDictionary<string, ProjectPresence> _presenceByConnection = new();
    private readonly ConcurrentDictionary<string, EditLease> _leases = new();

    public ProjectPresence UpsertPresence(Guid projectId,string connectionId,string userId,string displayName,string role,string? selectedKind=null,string? selectedId=null)
    {
        if(projectId==Guid.Empty)throw new InvalidOperationException("ProjectId is required.");
        if(string.IsNullOrWhiteSpace(userId)||string.IsNullOrWhiteSpace(displayName))throw new InvalidOperationException("UserId and display name are required.");
        var presence=new ProjectPresence(projectId,connectionId,userId.Trim(),displayName.Trim(),role.Trim(),selectedKind,selectedId,DateTimeOffset.UtcNow);
        _presenceByConnection[connectionId]=presence;
        return presence;
    }

    public ProjectPresence? UpdateSelection(string connectionId,string? selectedKind,string? selectedId)
    {
        if(!_presenceByConnection.TryGetValue(connectionId,out var current))return null;
        var next=current with{SelectedKind=selectedKind,SelectedId=selectedId,LastSeenAt=DateTimeOffset.UtcNow};
        _presenceByConnection[connectionId]=next;return next;
    }

    public IReadOnlyList<ProjectPresence> Snapshot(Guid projectId)
        => _presenceByConnection.Values.Where(item=>item.ProjectId==projectId).OrderBy(item=>item.DisplayName,StringComparer.OrdinalIgnoreCase).ToArray();

    public IReadOnlyList<Guid> RemoveConnection(string connectionId)
    {
        var projects=new HashSet<Guid>();
        if(_presenceByConnection.TryRemove(connectionId,out var presence))projects.Add(presence.ProjectId);
        foreach(var pair in _leases.Where(pair=>pair.Value.ConnectionId==connectionId).ToArray())if(_leases.TryRemove(pair.Key,out var removed))projects.Add(removed.ProjectId);
        return projects.ToArray();
    }

    public EditLease AcquireLease(Guid projectId,string objectKind,string objectId,string userId,string connectionId,TimeSpan ttl)
    {
        if(ttl<=TimeSpan.Zero||ttl>TimeSpan.FromMinutes(5))throw new InvalidOperationException("Edit lease TTL must be between zero and five minutes.");
        if(string.IsNullOrWhiteSpace(objectKind)||string.IsNullOrWhiteSpace(objectId)||string.IsNullOrWhiteSpace(userId))throw new InvalidOperationException("Object kind, object ID, and user ID are required.");
        var key=LeaseKey(projectId,objectKind,objectId);var now=DateTimeOffset.UtcNow;
        while(true)
        {
            if(_leases.TryGetValue(key,out var existing)&&existing.ExpiresAt>now&&existing.ConnectionId!=connectionId)throw new InvalidOperationException($"{objectKind} {objectId} is currently being edited by {existing.UserId}.");
            var next=new EditLease(projectId,objectKind.Trim(),objectId.Trim(),userId.Trim(),connectionId,existing?.AcquiredAt??now,now+ttl);
            if(existing is null){if(_leases.TryAdd(key,next))return next;continue;}
            if(_leases.TryUpdate(key,next,existing))return next;
        }
    }

    public EditLease? ReleaseLease(Guid projectId,string objectKind,string objectId,string connectionId)
    {
        var key=LeaseKey(projectId,objectKind,objectId);
        if(!_leases.TryGetValue(key,out var existing)||existing.ConnectionId!=connectionId)return null;
        return _leases.TryRemove(key,out var removed)?removed:null;
    }

    public IReadOnlyList<EditLease> ActiveLeases(Guid projectId)
    {
        PurgeExpired();return _leases.Values.Where(item=>item.ProjectId==projectId).OrderBy(item=>item.ObjectKind).ThenBy(item=>item.ObjectId).ToArray();
    }

    private void PurgeExpired(){var now=DateTimeOffset.UtcNow;foreach(var pair in _leases.Where(pair=>pair.Value.ExpiresAt<=now).ToArray())_leases.TryRemove(pair.Key,out _);}
    private static string LeaseKey(Guid projectId,string kind,string id)=>$"{projectId:N}:{kind.Trim().ToLowerInvariant()}:{id.Trim()}";
}
