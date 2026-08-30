using System.Data.Common;
using System.Text.Json;
using Archit.Api.Infrastructure;

namespace Archit.Api.Cad;

public sealed class PostgresCadImportJobStore(IArchitDbConnectionFactory connections) : ICadImportJobStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string SelectColumns = "SELECT id,project_id,file_name,status,progress,error,document::text,validation::text FROM cad_import_jobs";

    public async Task<CadImportJob?> GetAsync(Guid jobId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);
        await using var command=connection.CreateCommand();
        command.CommandText=SelectColumns+" WHERE id=@id";
        Add(command,"id",jobId);
        await using var reader=await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)?ReadJob(reader):null;
    }

    public async Task SaveAsync(CadImportJob job,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);
        await using var command=connection.CreateCommand();
        command.CommandText="""
            INSERT INTO cad_import_jobs(id,project_id,file_name,status,progress,error,document,validation,updated_at)
            VALUES(@id,@project,@file,@status,@progress,@error,CAST(@document AS jsonb),CAST(@validation AS jsonb),@updated)
            ON CONFLICT(id) DO UPDATE SET
                project_id=EXCLUDED.project_id,
                file_name=EXCLUDED.file_name,
                status=EXCLUDED.status,
                progress=EXCLUDED.progress,
                error=EXCLUDED.error,
                document=EXCLUDED.document,
                validation=EXCLUDED.validation,
                updated_at=EXCLUDED.updated_at
            """;
        Add(command,"id",job.Id);
        Add(command,"project",job.ProjectId);
        Add(command,"file",job.FileName);
        Add(command,"status",job.Status);
        Add(command,"progress",job.Progress);
        Add(command,"error",job.Error);
        Add(command,"document",job.Document is null?null:JsonSerializer.Serialize(job.Document,JsonOptions));
        Add(command,"validation",job.Validation is null?null:JsonSerializer.Serialize(job.Validation,JsonOptions));
        Add(command,"updated",DateTimeOffset.UtcNow);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid jobId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);
        await using var command=connection.CreateCommand();
        command.CommandText="DELETE FROM cad_import_jobs WHERE id=@id";
        Add(command,"id",jobId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CadImportJob>> ListRecoverableAsync(CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);
        await using var command=connection.CreateCommand();
        command.CommandText=SelectColumns+" WHERE status IN ('queued','processing') ORDER BY updated_at,id";
        await using var reader=await command.ExecuteReaderAsync(cancellationToken);
        var items=new List<CadImportJob>();
        while(await reader.ReadAsync(cancellationToken)) items.Add(ReadJob(reader));
        return items;
    }

    private static CadImportJob ReadJob(DbDataReader reader)
    {
        var document=reader.IsDBNull(6)?null:JsonSerializer.Deserialize<NormalizedCadDocument>(reader.GetString(6),JsonOptions);
        var validation=reader.IsDBNull(7)?null:JsonSerializer.Deserialize<CadImportValidation>(reader.GetString(7),JsonOptions);
        return new CadImportJob(
            reader.GetGuid(0),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetInt32(4),
            reader.IsDBNull(5)?null:reader.GetString(5),
            document,
            validation,
            reader.IsDBNull(1)?null:reader.GetGuid(1));
    }

    private static void Add(DbCommand command,string name,object? value)
    {
        var parameter=command.CreateParameter();
        parameter.ParameterName="@"+name;
        parameter.Value=value??DBNull.Value;
        command.Parameters.Add(parameter);
    }
}
