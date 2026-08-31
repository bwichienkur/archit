using System.Reflection;

namespace Archit.Api.Infrastructure;

public sealed class PostgresSchemaInitializer(
    IArchitDbConnectionFactory connections,
    IConfiguration configuration,
    ILogger<PostgresSchemaInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var enabled = configuration.GetValue("Database:AutoInitialize", true);
        if (!enabled)
        {
            logger.LogInformation("PostgreSQL schema auto-initialization is disabled.");
            return;
        }

        var assembly = typeof(PostgresSchemaInitializer).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .SingleOrDefault(name => name.EndsWith("Infrastructure.PostgresSchema.sql", StringComparison.Ordinal));
        if (resourceName is null)
            throw new InvalidOperationException("Embedded PostgreSQL schema resource was not found.");

        await using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded PostgreSQL schema resource {resourceName} could not be opened.");
        using var reader = new StreamReader(stream);
        var sql = await reader.ReadToEndAsync(cancellationToken);

        await using var connection = await connections.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken);
        logger.LogInformation("PostgreSQL bootstrap schema is ready.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
