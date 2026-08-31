using System.Data.Common;
using Archit.Api.Infrastructure;

namespace Archit.Api.Cad;

public sealed class PostgresCadImportQueue(IArchitDbConnectionFactory connections) : ICadImportQueue
{
    public async ValueTask EnqueueAsync(Guid jobId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);
        await using var command=connection.CreateCommand();
        command.CommandText="INSERT INTO cad_import_queue(job_id,enqueued_at) VALUES(@id,@at) ON CONFLICT(job_id) DO NOTHING";
        Add(command,"id",jobId);
        Add(command,"at",DateTimeOffset.UtcNow);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken)
    {
        while(true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await using var connection=await connections.OpenAsync(cancellationToken);
            await using var transaction=await connection.BeginTransactionAsync(cancellationToken);
            await using var command=connection.CreateCommand();
            command.Transaction=transaction;
            command.CommandText="""
                WITH next_job AS (
                    SELECT job_id
                    FROM cad_import_queue
                    ORDER BY enqueued_at,job_id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                DELETE FROM cad_import_queue AS queue
                USING next_job
                WHERE queue.job_id=next_job.job_id
                RETURNING queue.job_id
                """;
            var result=await command.ExecuteScalarAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            if(result is Guid jobId)return jobId;
            await Task.Delay(TimeSpan.FromMilliseconds(250),cancellationToken);
        }
    }

    private static void Add(DbCommand command,string name,object value)
    {
        var parameter=command.CreateParameter();
        parameter.ParameterName="@"+name;
        parameter.Value=value;
        command.Parameters.Add(parameter);
    }
}
