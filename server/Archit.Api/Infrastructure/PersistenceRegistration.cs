using Archit.Api.Cad;
using Archit.Api.Catalog;
using Archit.Api.Collaboration;
using Archit.Api.Exports;
using Archit.Api.Projects;
using Archit.Api.Tenancy;

namespace Archit.Api.Infrastructure;

public static class PersistenceRegistration
{
    public static IServiceCollection AddConfiguredPersistence(this IServiceCollection services,IConfiguration configuration)
    {
        var connectionString=configuration.GetConnectionString("Archit")??Environment.GetEnvironmentVariable("ARCHIT_DATABASE_URL");
        if(!string.IsNullOrWhiteSpace(connectionString))
        {
            services.AddSingleton<IArchitDbConnectionFactory,ConfiguredDbConnectionFactory>();
            services.AddSingleton<IProjectRepository,PostgresProjectRepository>();
            services.AddSingleton<ICatalogRepository,PostgresCatalogRepository>();
            services.AddSingleton<ICollaborationRepository,PostgresCollaborationRepository>();
            services.AddSingleton<ITenantRepository,PostgresTenantRepository>();
            services.AddSingleton<IExportJobRepository,PostgresExportJobRepository>();
        }

        var blobConnection=configuration["Storage:AzureBlob:ConnectionString"]??Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING");
        if(!string.IsNullOrWhiteSpace(blobConnection))
        {
            services.AddSingleton<ICadArtifactStore,AzureBlobCadArtifactStore>();
            services.AddSingleton<IExportArtifactStore,AzureBlobExportArtifactStore>();
        }
        return services;
    }
}
