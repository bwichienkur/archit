using System.Data.Common;
using System.Text.Json;
using Archit.Api.Infrastructure;

namespace Archit.Api.Tenancy;

public sealed class PostgresTenantRepository(IArchitDbConnectionFactory connections) : ITenantRepository
{
    public async Task<TenantRecord> CreateAsync(string name,CancellationToken cancellationToken)
    {
        if(string.IsNullOrWhiteSpace(name))throw new InvalidOperationException("Tenant name is required.");
        var tenant=new TenantRecord(Guid.NewGuid(),name.Trim(),DateTimeOffset.UtcNow);await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="INSERT INTO tenants(id,name,created_at) VALUES(@id,@name,@created)";Add(command,"id",tenant.Id);Add(command,"name",tenant.Name);Add(command,"created",tenant.CreatedAt);await command.ExecuteNonQueryAsync(cancellationToken);return tenant;
    }

    public async Task<TenantRecord?> GetAsync(Guid tenantId,CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="SELECT id,name,created_at FROM tenants WHERE id=@id";Add(command,"id",tenantId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);return await reader.ReadAsync(cancellationToken)?new TenantRecord(reader.GetGuid(0),reader.GetString(1),reader.GetFieldValue<DateTimeOffset>(2)):null;}

    public async Task<TenantMembershipRecord> UpsertMembershipAsync(Guid tenantId,UpsertMembershipRequest request,CancellationToken cancellationToken)
    {
        if(string.IsNullOrWhiteSpace(request.UserId)||string.IsNullOrWhiteSpace(request.Role))throw new InvalidOperationException("UserId and role are required.");
        await using var connection=await connections.OpenAsync(cancellationToken);if(!await TenantExists(connection,tenantId,cancellationToken))throw new KeyNotFoundException($"Tenant {tenantId} was not found.");
        var projects=(request.ProjectIds??Array.Empty<Guid>()).Distinct().ToArray();var created=DateTimeOffset.UtcNow;await using var command=connection.CreateCommand();command.CommandText="""
INSERT INTO tenant_memberships(tenant_id,user_id,role,project_ids,created_at)
VALUES(@tenant,@user,@role,CAST(@projects AS jsonb),@created)
ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=EXCLUDED.role,project_ids=EXCLUDED.project_ids
RETURNING tenant_id,user_id,role,project_ids::text,created_at
""";Add(command,"tenant",tenantId);Add(command,"user",request.UserId.Trim());Add(command,"role",request.Role.Trim().ToLowerInvariant());Add(command,"projects",JsonSerializer.Serialize(projects));Add(command,"created",created);await using var reader=await command.ExecuteReaderAsync(cancellationToken);if(!await reader.ReadAsync(cancellationToken))throw new InvalidOperationException("Membership upsert did not return a record.");return ReadMembership(reader);
    }

    public async Task<TenantMembershipRecord?> GetMembershipAsync(Guid tenantId,string userId,CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="SELECT tenant_id,user_id,role,project_ids::text,created_at FROM tenant_memberships WHERE tenant_id=@tenant AND user_id=@user";Add(command,"tenant",tenantId);Add(command,"user",userId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);return await reader.ReadAsync(cancellationToken)?ReadMembership(reader):null;}

    private static TenantMembershipRecord ReadMembership(DbDataReader reader){var projects=JsonSerializer.Deserialize<Guid[]>(reader.GetString(3))??Array.Empty<Guid>();return new TenantMembershipRecord(reader.GetGuid(0),reader.GetString(1),reader.GetString(2),projects,reader.GetFieldValue<DateTimeOffset>(4));}
    private static async Task<bool> TenantExists(DbConnection connection,Guid tenantId,CancellationToken cancellationToken){await using var command=connection.CreateCommand();command.CommandText="SELECT 1 FROM tenants WHERE id=@id";Add(command,"id",tenantId);return await command.ExecuteScalarAsync(cancellationToken)is not null;}
    private static void Add(DbCommand command,string name,object? value){var parameter=command.CreateParameter();parameter.ParameterName="@"+name;parameter.Value=value??DBNull.Value;command.Parameters.Add(parameter);}
}
