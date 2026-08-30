using System.Security.Claims;
using Archit.Api.Tenancy;
using Microsoft.AspNetCore.SignalR;

namespace Archit.Api.Collaboration;

public sealed class ProjectHub(TenantAccessService access) : Hub
{
    private static readonly ProjectPresenceRegistry Presence = new();

    public async Task JoinProject(Guid projectId,string userId,string displayName,string role)
    {
        var decision=await RequireAccess(projectId,"project:read");
        var identity=ResolveIdentity(userId,displayName,role);
        var effectiveRole=decision.Membership?.Role??identity.Role;
        await Groups.AddToGroupAsync(Context.ConnectionId,GroupName(projectId));
        Presence.UpsertPresence(projectId,Context.ConnectionId,identity.UserId,identity.DisplayName,effectiveRole);
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
        await RequireAccess(projectId,"project:read");
        Presence.UpdateSelection(Context.ConnectionId,objectKind,objectId);
        await Clients.Group(GroupName(projectId)).SendAsync("presenceChanged",Presence.Snapshot(projectId));
    }

    public async Task<EditLease> AcquireEditLease(Guid projectId,string objectKind,string objectId,string userId,int ttlSeconds=30)
    {
        try
        {
            await RequireAccess(projectId,"project:edit");
            var identity=ResolveIdentity(userId,userId,"viewer");
            var lease=Presence.AcquireLease(projectId,objectKind,objectId,identity.UserId,Context.ConnectionId,TimeSpan.FromSeconds(ttlSeconds));
            await Clients.Group(GroupName(projectId)).SendAsync("editLeasesChanged",Presence.ActiveLeases(projectId));
            return lease;
        }
        catch(InvalidOperationException ex){throw new HubException(ex.Message);}
    }

    public async Task ReleaseEditLease(Guid projectId,string objectKind,string objectId)
    {
        await RequireAccess(projectId,"project:edit");
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

    private async Task<AccessDecision> RequireAccess(Guid projectId,string permission)
    {
        var http=Context.GetHttpContext()??throw new HubException("HTTP context is unavailable for project authorization.");
        var decision=await access.CheckProjectAsync(http,projectId,permission,http.RequestAborted);
        if(!decision.Allowed)throw new HubException(decision.Message??"Project access denied.");
        return decision;
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
