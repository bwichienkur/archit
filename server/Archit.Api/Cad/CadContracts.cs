namespace Archit.Api.Cad;

public sealed record CadImportJob(
    Guid Id,
    string FileName,
    string Status,
    int Progress,
    string? Error = null,
    NormalizedCadDocument? Document = null,
    CadImportValidation? Validation = null);

public sealed record NormalizedCadDocument(
    int SchemaVersion,
    string SourceFileName,
    string SourceSha256,
    string DrawingUnits,
    CadBounds Bounds,
    IReadOnlyList<CadLayer> Layers,
    IReadOnlyList<CadEntity> Entities,
    IReadOnlyList<string> Warnings);

public sealed record CadPoint(double X, double Y, double? Z = null);
public sealed record CadBounds(CadPoint Min, CadPoint Max);
public sealed record CadLayer(string Id, string Name, bool Visible, bool Locked, string? Color = null, string? LineType = null);
public sealed record CadEntity(
    string Id,
    string SourceHandle,
    string Type,
    string LayerId,
    CadBounds Bounds,
    IReadOnlyDictionary<string, object?> Geometry,
    IReadOnlyDictionary<string, object?> Properties,
    bool Unsupported = false);

public sealed record CadImportValidation(
    string SourceFileName,
    int SourceEntityCount,
    int NormalizedEntityCount,
    int UnsupportedEntityCount,
    IReadOnlyList<string> MissingReferences,
    IReadOnlyList<string> MissingFonts,
    IReadOnlyList<string> Warnings,
    bool Passed);

public interface ICadImportProvider
{
    string Name { get; }
    bool IsConfigured { get; }
    Task<(NormalizedCadDocument Document, CadImportValidation Validation)> ImportAsync(Stream source, string fileName, CancellationToken cancellationToken);
}
