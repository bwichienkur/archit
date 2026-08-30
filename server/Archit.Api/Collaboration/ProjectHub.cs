using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace Archit.Api.Collaboration;

public sealed class ProjectHub : Hub
{
    private static readonly ProjectPresenceRegistry Presence = new();

    public async Task JoinProject(Guid projectId,string userId,string displayName,string role)
    {
        var identity=ResolveIdentity(userId,displayName,role);
        await Groups.AddToGroupAsync(Context.ConnectionId,GroupName(projectId));
        Presence.UpsertPresence(projectId,Context.ConnectionId,identity.UserId,identity.DisplayName,identity.Role);
        await Clients.Group(GroupName(projectId)).SendAsync("presenceChanged",Presence.Snapshot(projectId));
        await Clients.Caller.SendAsync("editLeasesChanged",Presence.ActiveLeases(projectId));
    }

    public async Task LeaveProject(Guid projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId,GroupName(projectId));
        Presence.RemoveConnection(Context.ConnectionId);
        await Clients.Group(GroupName(projectId)).SendAsync("presenceChanged",Presence.Snapshot(projectId));
        await Clients.Group(GroupName(projectId)).SendAsync("editLeasesChanged",Presence.ActiveLeases(projectId));
    }

    public async Task SelectObject(Guid projectId,string? objectKind,string? objectId)
    {
        Presence.UpdateSelection(Context.ConnectionId,objectKind,objectId);
        await Clients.Group(GroupName(projectId)).SendAsync("presenceChanged",Presence.Snapshot(projectId));
    }

    public async Task<EditLease> AcquireEditLease(Guid projectId,string objectKind,string objectId,string userId,int ttlSeconds=30)
    {
        try
        {
            var identity=ResolveIdentity(userId,userId,"viewer");
            var lease=Presence.AcquireLease(projectId,objectKind,objectId,identity.UserId,Context.ConnectionId,TimeSpan.FromSeconds(ttlSeconds));
            await Clients.Group(GroupName(projectId)).SendAsync("editLeasesChanged",Presence.ActiveLeases(projectId));
            return lease;
        }
        catch(InvalidOperationException ex){throw new HubException(ex.Message);}
    }

    public async Task ReleaseEditLease(Guid projectId,string objectKind,string objectId)
    {
        Presence.ReleaseLease(projectId,objectKind,objectId,Context.ConnectionId);
        await Clients.Group(GroupName(projectId)).SendAsync("editLeasesChanged",Presence.ActiveLeases(projectId));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var projects=Presence.RemoveConnection(Context.ConnectionId);
        foreach(var projectId in projects)
        {
            await Clients.Group(GroupName(projectId)).SendAsync("presenceChanged",Presence.Snapshot(projectId));
            await Clients.Group(GroupName(projectId)).SendAsync("editLeasesChanged",Presence.ActiveLeases(projectId));
        }
        await base.OnDisconnectedAsync(exception);
    }

    private (string UserId,string DisplayName,string Role) ResolveIdentity(string fallbackUserId,string fallbackDisplayName,string fallbackRole)
    {
        var principal=Context.User;
        if(principal?.Identity?.IsAuthenticated!=true)return(fallbackUserId,fallbackDisplayName,fallbackRole);
        var userId=principal.FindFirstValue("sub")??principal.FindFirstValue(ClaimTypes.NameIdentifier)??principal.Identity.Name??throw new HubException("Authenticated user is missing a stable subject identifier.");
        var displayName=principal.Identity.Name??principal.FindFirstValue("name")??userId;
        var role=principal.FindFirstValue(ClaimTypes.Role)??principal.FindFirstValue("role")??"viewer";
        return(userId,displayName,role);
    }

    public static string GroupName(Guid projectId) => $"project:{projectId:N}";
}

public interface IProjectEventBroadcaster
{
    Task BroadcastAsync(Guid projectId, string eventType, object payload, CancellationToken cancellationToken);
}

public sealed class SignalRProjectEventBroadcaster(IHubContext<ProjectHub> hub) : IProjectEventBroadcaster
{
    public Task BroadcastAsync(Guid projectId, string eventType, object payload, CancellationToken cancellationToken)
        => hub.Clients.Group(ProjectHub.GroupName(projectId)).SendAsync(eventType, payload, cancellationToken);
}
