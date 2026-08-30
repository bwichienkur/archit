using System.Data.Common;
using System.Text.Json;
using Archit.Api.Infrastructure;

namespace Archit.Api.Catalog;

public sealed class PostgresCatalogRepository(IArchitDbConnectionFactory connections) : ICatalogRepository
{
    public async Task<CatalogProductRecord> UpsertAsync(UpsertCatalogProductRequest request,CancellationToken cancellationToken)
    {
        if(string.IsNullOrWhiteSpace(request.ExternalId)||string.IsNullOrWhiteSpace(request.Manufacturer)||string.IsNullOrWhiteSpace(request.Sku)||string.IsNullOrWhiteSpace(request.Name)||string.IsNullOrWhiteSpace(request.Category)||string.IsNullOrWhiteSpace(request.UnitOfMeasure))throw new InvalidOperationException("ExternalId, manufacturer, SKU, name, category, and unit of measure are required.");
        var now=DateTimeOffset.UtcNow;await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();
        command.CommandText="""
INSERT INTO catalog_products(id,external_id,manufacturer,sku,name,category,unit_of_measure,payload,created_at,updated_at)
VALUES(@id,@external,@manufacturer,@sku,@name,@category,@uom,CAST(@payload AS jsonb),@created,@updated)
ON CONFLICT(external_id) DO UPDATE SET manufacturer=EXCLUDED.manufacturer,sku=EXCLUDED.sku,name=EXCLUDED.name,category=EXCLUDED.category,unit_of_measure=EXCLUDED.unit_of_measure,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at
RETURNING id,external_id,manufacturer,sku,name,category,unit_of_measure,payload::text,created_at,updated_at
""";
        Add(command,"id",Guid.NewGuid());Add(command,"external",request.ExternalId.Trim());Add(command,"manufacturer",request.Manufacturer.Trim());Add(command,"sku",request.Sku.Trim());Add(command,"name",request.Name.Trim());Add(command,"category",request.Category.Trim());Add(command,"uom",request.UnitOfMeasure.Trim());Add(command,"payload",request.Payload.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null?"{}":request.Payload.GetRawText());Add(command,"created",now);Add(command,"updated",now);
        await using var reader=await command.ExecuteReaderAsync(cancellationToken);if(!await reader.ReadAsync(cancellationToken))throw new InvalidOperationException("Catalog upsert did not return a product.");return Read(reader);
    }

    public async Task<CatalogProductRecord?> GetAsync(Guid id,CancellationToken cancellationToken){await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText=Select+" WHERE id=@id";Add(command,"id",id);await using var reader=await command.ExecuteReaderAsync(cancellationToken);return await reader.ReadAsync(cancellationToken)?Read(reader):null;}

    public async Task<IReadOnlyList<CatalogProductRecord>> SearchAsync(string? manufacturer,string? category,string? query,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();var where=new List<string>{"1=1"};if(!string.IsNullOrWhiteSpace(manufacturer)){where.Add("lower(manufacturer)=lower(@manufacturer)");Add(command,"manufacturer",manufacturer.Trim());}if(!string.IsNullOrWhiteSpace(category)){where.Add("lower(category)=lower(@category)");Add(command,"category",category.Trim());}if(!string.IsNullOrWhiteSpace(query)){where.Add("(name ILIKE @query OR sku ILIKE @query OR external_id ILIKE @query OR manufacturer ILIKE @query)");Add(command,"query","%"+query.Trim()+"%");}command.CommandText=Select+" WHERE "+string.Join(" AND ",where)+" ORDER BY manufacturer,name LIMIT 1000";await using var reader=await command.ExecuteReaderAsync(cancellationToken);var items=new List<CatalogProductRecord>();while(await reader.ReadAsync(cancellationToken))items.Add(Read(reader));return items;
    }

    private const string Select="SELECT id,external_id,manufacturer,sku,name,category,unit_of_measure,payload::text,created_at,updated_at FROM catalog_products";
    private static CatalogProductRecord Read(DbDataReader reader){using var doc=JsonDocument.Parse(reader.GetString(7));return new CatalogProductRecord(reader.GetGuid(0),reader.GetString(1),reader.GetString(2),reader.GetString(3),reader.GetString(4),reader.GetString(5),reader.GetString(6),doc.RootElement.Clone(),reader.GetFieldValue<DateTimeOffset>(8),reader.GetFieldValue<DateTimeOffset>(9));}
    private static void Add(DbCommand command,string name,object? value){var parameter=command.CreateParameter();parameter.ParameterName="@"+name;parameter.Value=value??DBNull.Value;command.Parameters.Add(parameter);}
}
