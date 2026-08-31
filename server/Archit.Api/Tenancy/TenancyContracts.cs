namespace Archit.Api.Tenancy;

public sealed record TenantRecord(Guid Id,string Name,DateTimeOffset CreatedAt);
public sealed record TenantMembershipRecord(Guid TenantId,string UserId,string Role,IReadOnlyList<Guid> ProjectIds,DateTimeOffset CreatedAt);
public sealed record CreateTenantRequest(string Name);
public sealed record UpsertMembershipRequest(string UserId,string Role,IReadOnlyList<Guid>? ProjectIds);

public interface ITenantRepository
{
    Task<TenantRecord> CreateAsync(string name,CancellationToken cancellationToken);
    Task<TenantRecord?> GetAsync(Guid tenantId,CancellationToken cancellationToken);
    Task<TenantMembershipRecord> UpsertMembershipAsync(Guid tenantId,UpsertMembershipRequest request,CancellationToken cancellationToken);
    Task<TenantMembershipRecord?> GetMembershipAsync(Guid tenantId,string userId,CancellationToken cancellationToken);
}

public static class TenantPermissions
{
    private static readonly Dictionary<string,HashSet<string>> RolePermissions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["owner"] = new(["project:read","project:edit","cad:import","bim:edit","catalog:manage","pricing:manage","selection:approve","comment:create","export:create","admin:manage"]),
        ["admin"] = new(["project:read","project:edit","cad:import","bim:edit","catalog:manage","pricing:manage","selection:approve","comment:create","export:create","admin:manage"]),
        ["architect"] = new(["project:read","project:edit","cad:import","bim:edit","comment:create","export:create"]),
        ["builder"] = new(["project:read","project:edit","bim:edit","catalog:manage","pricing:manage","selection:approve","comment:create","export:create"]),
        ["designer"] = new(["project:read","project:edit","bim:edit","comment:create","export:create"]),
        ["customer"] = new(["project:read","selection:approve","comment:create"]),
        ["viewer"] = new(["project:read"]),
    };

    public static bool Can(TenantMembershipRecord membership,string permission,Guid? projectId=null)
    {
        if (!RolePermissions.TryGetValue(membership.Role,out var permissions) || !permissions.Contains(permission)) return false;
        return projectId is null || membership.ProjectIds.Count == 0 || membership.ProjectIds.Contains(projectId.Value);
    }
}
