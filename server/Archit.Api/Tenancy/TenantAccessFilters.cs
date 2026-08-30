using System.Security.Claims;
using Archit.Api.Collaboration;
using Archit.Api.Exports;
using Archit.Api.Infrastructure;
using Archit.Api.Projects;

namespace Archit.Api.Tenancy;

public sealed class TenantAccessService(ArchitAuthState auth,ITenantRepository tenants,IProjectRepository projects)
{
    public bool AuthEnabled=>auth.Enabled;

    public async Task<AccessDecision> CheckTenantAsync(HttpContext context,Guid tenantId,string permission,Guid? projectId,CancellationToken cancellationToken)
    {
        if(!auth.Enabled)return AccessDecision.Allow();
        var userId=Subject(context.User);if(userId is null)return AccessDecision.Unauthorized();
        var membership=await tenants.GetMembershipAsync(tenantId,userId,cancellationToken);
        if(membership is null||!TenantPermissions.Can(membership,permission,projectId))return AccessDecision.Forbidden();
        return AccessDecision.Allow(membership);
    }

    public async Task<AccessDecision> CheckProjectAsync(HttpContext context,Guid projectId,string permission,CancellationToken cancellationToken)
    {
        var project=await projects.GetAsync(projectId,cancellationToken);if(project is null)return AccessDecision.NotFound();
        if(!auth.Enabled)return AccessDecision.Allow(project:project);
        if(project.TenantId is not Guid tenantId)return AccessDecision.Forbidden("Authenticated project access requires a tenant-bound project.");
        var tenantDecision=await CheckTenantAsync(context,tenantId,permission,projectId,cancellationToken);
        return tenantDecision.Allowed?tenantDecision with{Project=project}:tenantDecision;
    }

    public static string? Subject(ClaimsPrincipal principal)=>principal.FindFirstValue("sub")??principal.FindFirstValue(ClaimTypes.NameIdentifier)??principal.Identity?.Name;
}

public sealed record AccessDecision(bool Allowed,int StatusCode,string? Message,TenantMembershipRecord? Membership=null,ProjectRecord? Project=null)
{
    public static AccessDecision Allow(TenantMembershipRecord? membership=null,ProjectRecord? project=null)=>new(true,200,null,membership,project);
    public static AccessDecision Unauthorized()=>new(false,401,"Authentication is required.");
    public static AccessDecision Forbidden(string? message=null)=>new(false,403,message??"You do not have permission for this tenant or project.");
    public static AccessDecision NotFound()=>new(false,404,"Project was not found.");
    public IResult ToResult()=>StatusCode switch{401=>Results.Unauthorized(),403=>Results.Json(new{error=Message},statusCode:403),404=>Results.NotFound(),_=>Results.StatusCode(StatusCode)};
}

public sealed class ProjectPermissionFilter(string permission) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context,EndpointFilterDelegate next)
    {
        if(!Guid.TryParse(context.HttpContext.Request.RouteValues["projectId"]?.ToString(),out var projectId))return Results.BadRequest(new{error="Project route ID is invalid."});
        var access=context.HttpContext.RequestServices.GetRequiredService<TenantAccessService>();
        var decision=await access.CheckProjectAsync(context.HttpContext,projectId,permission,context.HttpContext.RequestAborted);
        if(!decision.Allowed)return decision.ToResult();
        if(access.AuthEnabled&&decision.Membership is not null)
        {
            var userId=TenantAccessService.Subject(context.HttpContext.User);
            if(string.IsNullOrWhiteSpace(userId))return Results.Unauthorized();
            NormalizeAuditArguments(context,userId,decision.Membership.Role);
        }
        return await next(context);
    }

    private static void NormalizeAuditArguments(EndpointFilterInvocationContext context,string userId,string role)
    {
        for(var index=0;index<context.Arguments.Count;index++)
        {
            context.Arguments[index]=context.Arguments[index] switch
            {
                CreateRevisionRequest request=>request with{CreatedBy=userId},
                CreateExportRequest request=>request with{RequestedBy=userId},
                CreateCollaborationEventRequest request=>request with{ActorId=userId,ActorRole=role},
                CreateCommentRequest request=>request with{AuthorId=userId,AuthorRole=role},
                ResolveCommentRequest request=>request with{ResolvedBy=userId},
                var argument=>argument
            };
        }
    }
}

public sealed class TenantPermissionFilter(string permission) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context,EndpointFilterDelegate next)
    {
        if(!Guid.TryParse(context.HttpContext.Request.RouteValues["tenantId"]?.ToString(),out var tenantId))return Results.BadRequest(new{error="Tenant route ID is invalid."});
        var access=context.HttpContext.RequestServices.GetRequiredService<TenantAccessService>();
        var decision=await access.CheckTenantAsync(context.HttpContext,tenantId,permission,null,context.HttpContext.RequestAborted);
        return decision.Allowed?await next(context):decision.ToResult();
    }
}
