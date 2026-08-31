using System.Text.Json;

namespace Archit.Api.Catalog;

public sealed class LocalCatalogRepository : ICatalogRepository
{
    private readonly string _root;
    private readonly SemaphoreSlim _gate = new(1,1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public LocalCatalogRepository(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _root = configuration["Catalog:DataPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_CATALOG_PATH") ?? Path.Combine(environment.ContentRootPath, ".archit-data", "catalog");
        Directory.CreateDirectory(_root);
    }

    public async Task<CatalogProductRecord> UpsertAsync(UpsertCatalogProductRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var existing = (await ReadAllUnsafeAsync(cancellationToken)).FirstOrDefault(item => string.Equals(item.ExternalId, request.ExternalId.Trim(), StringComparison.OrdinalIgnoreCase));
            var now = DateTimeOffset.UtcNow;
            var record = new CatalogProductRecord(existing?.Id ?? Guid.NewGuid(), request.ExternalId.Trim(), request.Manufacturer.Trim(), request.Sku.Trim(), request.Name.Trim(), request.Category.Trim(), request.UnitOfMeasure.Trim(), request.Payload.Clone(), existing?.CreatedAt ?? now, now);
            await WriteUnsafeAsync(record, cancellationToken);
            return record;
        }
        finally { _gate.Release(); }
    }

    public async Task<CatalogProductRecord?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var path = Path.Combine(_root, $"{id:N}.json");
        if (!File.Exists(path)) return null;
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<CatalogProductRecord>(stream, JsonOptions, cancellationToken);
    }

    public async Task<IReadOnlyList<CatalogProductRecord>> SearchAsync(string? manufacturer, string? category, string? query, CancellationToken cancellationToken)
    {
        var all = await ReadAllUnsafeAsync(cancellationToken);
        IEnumerable<CatalogProductRecord> filtered = all;
        if (!string.IsNullOrWhiteSpace(manufacturer)) filtered = filtered.Where(item => item.Manufacturer.Equals(manufacturer.Trim(), StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(category)) filtered = filtered.Where(item => item.Category.Equals(category.Trim(), StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = query.Trim();
            filtered = filtered.Where(item => item.Name.Contains(q, StringComparison.OrdinalIgnoreCase) || item.Sku.Contains(q, StringComparison.OrdinalIgnoreCase) || item.ExternalId.Contains(q, StringComparison.OrdinalIgnoreCase));
        }
        return filtered.OrderBy(item => item.Manufacturer).ThenBy(item => item.Name).ToArray();
    }

    private async Task<CatalogProductRecord[]> ReadAllUnsafeAsync(CancellationToken cancellationToken)
    {
        var results = new List<CatalogProductRecord>();
        foreach (var path in Directory.EnumerateFiles(_root, "*.json", SearchOption.TopDirectoryOnly))
        {
            await using var stream = File.OpenRead(path);
            var record = await JsonSerializer.DeserializeAsync<CatalogProductRecord>(stream, JsonOptions, cancellationToken);
            if (record is not null) results.Add(record);
        }
        return results.ToArray();
    }

    private async Task WriteUnsafeAsync(CatalogProductRecord record, CancellationToken cancellationToken)
    {
        var target = Path.Combine(_root, $"{record.Id:N}.json");
        var temp = target + ".tmp";
        await File.WriteAllTextAsync(temp, JsonSerializer.Serialize(record, JsonOptions), cancellationToken);
        File.Move(temp, target, overwrite: true);
    }

    private static void Validate(UpsertCatalogProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ExternalId)) throw new InvalidOperationException("ExternalId is required.");
        if (string.IsNullOrWhiteSpace(request.Manufacturer)) throw new InvalidOperationException("Manufacturer is required.");
        if (string.IsNullOrWhiteSpace(request.Sku)) throw new InvalidOperationException("Sku is required.");
        if (string.IsNullOrWhiteSpace(request.Name)) throw new InvalidOperationException("Name is required.");
        if (string.IsNullOrWhiteSpace(request.Category)) throw new InvalidOperationException("Category is required.");
        if (string.IsNullOrWhiteSpace(request.UnitOfMeasure)) throw new InvalidOperationException("UnitOfMeasure is required.");
    }
}
