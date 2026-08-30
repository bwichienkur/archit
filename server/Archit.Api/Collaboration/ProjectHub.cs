using Microsoft.AspNetCore.SignalR;

namespace Archit.Api.Collaboration;

public sealed class ProjectHub : Hub
{
    public Task JoinProject(Guid projectId) => Groups.AddToGroupAsync(Context.ConnectionId, GroupName(projectId));
    public Task LeaveProject(Guid projectId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(projectId));
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
