using System.Data.Common;

namespace Archit.Api.Infrastructure;

public interface IArchitDbConnectionFactory
{
    Task<DbConnection> OpenAsync(CancellationToken cancellationToken);
}

public sealed class ConfiguredDbConnectionFactory(IConfiguration configuration) : IArchitDbConnectionFactory
{
    public async Task<DbConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var provider = configuration["Database:Provider"] ?? "Npgsql";
        var connectionString = configuration.GetConnectionString("Archit") ?? Environment.GetEnvironmentVariable("ARCHIT_DATABASE_URL");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Archit database connection string is not configured.");
        DbProviderFactory factory;
        try { factory = DbProviderFactories.GetFactory(provider); }
        catch (ArgumentException ex) { throw new InvalidOperationException($"Database provider {provider} is not registered. Install/register the PostgreSQL provider before enabling database-backed repositories.", ex); }
        var connection = factory.CreateConnection() ?? throw new InvalidOperationException($"Database provider {provider} could not create a connection.");
        connection.ConnectionString = connectionString;
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
