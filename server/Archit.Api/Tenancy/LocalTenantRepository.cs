using System.Text.Json;

namespace Archit.Api.Tenancy;

public sealed class LocalTenantRepository : ITenantRepository
{
    private readonly string _root;
    private readonly SemaphoreSlim _gate = new(1,1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public LocalTenantRepository(IConfiguration configuration,IWebHostEnvironment environment)
    {
        _root = configuration["Tenancy:DataPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_TENANCY_PATH") ?? Path.Combine(environment.ContentRootPath,".archit-data","tenancy");
        Directory.CreateDirectory(_root);
    }

    public async Task<TenantRecord> CreateAsync(string name,CancellationToken cancellationToken)
    {
        if(string.IsNullOrWhiteSpace(name))throw new InvalidOperationException("Tenant name is required.");
        var tenant=new TenantRecord(Guid.NewGuid(),name.Trim(),DateTimeOffset.UtcNow);await WriteAsync(TenantPath(tenant.Id),tenant,cancellationToken);return tenant;
    }

    public async Task<TenantRecord?> GetAsync(Guid tenantId,CancellationToken cancellationToken)
    {
        var path=TenantPath(tenantId);if(!File.Exists(path))return null;await using var stream=File.OpenRead(path);return await JsonSerializer.DeserializeAsync<TenantRecord>(stream,JsonOptions,cancellationToken);
    }

    public async Task<TenantMembershipRecord> UpsertMembershipAsync(Guid tenantId,UpsertMembershipRequest request,CancellationToken cancellationToken)
    {
        if(await GetAsync(tenantId,cancellationToken) is null)throw new KeyNotFoundException($"Tenant {tenantId} was not found.");
        if(string.IsNullOrWhiteSpace(request.UserId)||string.IsNullOrWhiteSpace(request.Role))throw new InvalidOperationException("UserId and Role are required.");
        var membership=new TenantMembershipRecord(tenantId,request.UserId.Trim(),request.Role.Trim().ToLowerInvariant(),request.ProjectIds?.Distinct().ToArray()??Array.Empty<Guid>(),DateTimeOffset.UtcNow);
        await WriteAsync(MembershipPath(tenantId,membership.UserId),membership,cancellationToken);return membership;
    }

    public async Task<TenantMembershipRecord?> GetMembershipAsync(Guid tenantId,string userId,CancellationToken cancellationToken)
    {
        var path=MembershipPath(tenantId,userId);if(!File.Exists(path))return null;await using var stream=File.OpenRead(path);return await JsonSerializer.DeserializeAsync<TenantMembershipRecord>(stream,JsonOptions,cancellationToken);
    }

    private async Task WriteAsync<T>(string path,T value,CancellationToken cancellationToken){await _gate.WaitAsync(cancellationToken);try{Directory.CreateDirectory(Path.GetDirectoryName(path)!);var temp=path+".tmp";await File.WriteAllTextAsync(temp,JsonSerializer.Serialize(value,JsonOptions),cancellationToken);File.Move(temp,path,overwrite:true);}finally{_gate.Release();}}
    private string TenantPath(Guid id)=>Path.Combine(_root,$"tenant-{id:N}.json");
    private string MembershipPath(Guid tenantId,string userId)=>Path.Combine(_root,tenantId.ToString("N"),"members",Safe(userId)+".json");
    private static string Safe(string value)=>string.Concat(value.Select(ch=>char.IsLetterOrDigit(ch)||ch is '-' or '_' or '.'?ch:'_'));
}
