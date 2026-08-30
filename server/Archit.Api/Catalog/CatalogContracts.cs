using System.Text.Json;

namespace Archit.Api.Catalog;

public sealed record CatalogProductRecord(
    Guid Id,
    string ExternalId,
    string Manufacturer,
    string Sku,
    string Name,
    string Category,
    string UnitOfMeasure,
    JsonElement Payload,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record UpsertCatalogProductRequest(
    string ExternalId,
    string Manufacturer,
    string Sku,
    string Name,
    string Category,
    string UnitOfMeasure,
    JsonElement Payload);

public interface ICatalogRepository
{
    Task<CatalogProductRecord> UpsertAsync(UpsertCatalogProductRequest request, CancellationToken cancellationToken);
    Task<CatalogProductRecord?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<CatalogProductRecord>> SearchAsync(string? manufacturer, string? category, string? query, CancellationToken cancellationToken);
}
