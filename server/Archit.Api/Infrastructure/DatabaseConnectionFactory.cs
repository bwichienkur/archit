using System.Data.Common;
using Npgsql;

namespace Archit.Api.Infrastructure;

public interface IArchitDbConnectionFactory
{
    Task<DbConnection> OpenAsync(CancellationToken cancellationToken);
}

public sealed class ConfiguredDbConnectionFactory(IConfiguration configuration) : IArchitDbConnectionFactory
{
    public async Task<DbConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("Archit") ?? Environment.GetEnvironmentVariable("ARCHIT_DATABASE_URL");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Archit PostgreSQL connection string is not configured.");
        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
