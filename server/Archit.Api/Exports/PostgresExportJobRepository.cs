using System.Data.Common;
using Archit.Api.Infrastructure;

namespace Archit.Api.Exports;

public sealed class PostgresExportJobRepository(IArchitDbConnectionFactory connections) : IExportJobRepository
{
    public async Task<ExportJobRecord> CreateAsync(Guid projectId,CreateExportRequest request,CancellationToken cancellationToken)
    {
        if(request.RevisionId==Guid.Empty)throw new InvalidOperationException("RevisionId is required.");if(string.IsNullOrWhiteSpace(request.Format)||string.IsNullOrWhiteSpace(request.RequestedBy))throw new InvalidOperationException("Format and RequestedBy are required.");
        var now=DateTimeOffset.UtcNow;var job=new ExportJobRecord(Guid.NewGuid(),projectId,request.RevisionId,request.Format.Trim().ToLowerInvariant(),"queued",0,request.RequestedBy.Trim(),now,now,null,null);await SaveAsync(job,cancellationToken);return job;
    }
    public async Task<ExportJobRecord?> GetAsync(Guid jobId,CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText=Select+" WHERE id=@id";Add(command,"id",jobId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);return await reader.ReadAsync(cancellationToken)?Read(reader):null;}
    public async Task<IReadOnlyList<ExportJobRecord>> ListAsync(Guid projectId,CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText=Select+" WHERE project_id=@project ORDER BY created_at DESC";Add(command,"project",projectId);return await ReadAll(command,cancellationToken);}
    public async Task<IReadOnlyList<ExportJobRecord>> ListPendingAsync(CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText=Select+" WHERE status IN ('queued','processing') ORDER BY created_at";return await ReadAll(command,cancellationToken);}
    public async Task SaveAsync(ExportJobRecord job,CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="""
INSERT INTO export_jobs(id,project_id,revision_id,format,status,progress,requested_by,created_at,updated_at,artifact_path,error)
VALUES(@id,@project,@revision,@format,@status,@progress,@requested,@created,@updated,@artifact,@error)
ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,progress=EXCLUDED.progress,updated_at=EXCLUDED.updated_at,artifact_path=EXCLUDED.artifact_path,error=EXCLUDED.error
""";Add(command,"id",job.Id);Add(command,"project",job.ProjectId);Add(command,"revision",job.RevisionId);Add(command,"format",job.Format);Add(command,"status",job.Status);Add(command,"progress",job.Progress);Add(command,"requested",job.RequestedBy);Add(command,"created",job.CreatedAt);Add(command,"updated",job.UpdatedAt);Add(command,"artifact",job.ArtifactPath);Add(command,"error",job.Error);await command.ExecuteNonQueryAsync(cancellationToken);}
    private const string Select="SELECT id,project_id,revision_id,format,status,progress,requested_by,created_at,updated_at,artifact_path,error FROM export_jobs";
    private static ExportJobRecord Read(DbDataReader r)=>new(r.GetGuid(0),r.GetGuid(1),r.GetGuid(2),r.GetString(3),r.GetString(4),r.GetInt32(5),r.GetString(6),r.GetFieldValue<DateTimeOffset>(7),r.GetFieldValue<DateTimeOffset>(8),r.IsDBNull(9)?null:r.GetString(9),r.IsDBNull(10)?null:r.GetString(10));
    private static async Task<IReadOnlyList<ExportJobRecord>> ReadAll(DbCommand command,CancellationToken ct){await using var reader=await command.ExecuteReaderAsync(ct);var list=new List<ExportJobRecord>();while(await reader.ReadAsync(ct))list.Add(Read(reader));return list;}
    private static void Add(DbCommand command,string name,object? value){var parameter=command.CreateParameter();parameter.ParameterName="@"+name;parameter.Value=value??DBNull.Value;command.Parameters.Add(parameter);}
}
