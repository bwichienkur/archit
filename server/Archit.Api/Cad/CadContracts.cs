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
    IReadOnlyList<CadBlockDefinition> Blocks,
    IReadOnlyList<CadEntity> Entities,
    IReadOnlyList<string> Warnings,
    string? SourceCadVersion = null,
    double? UnitScaleToMeters = null);

public sealed record CadPoint(double X, double Y, double? Z = null);
public sealed record CadBounds(CadPoint Min, CadPoint Max);

public sealed record CadLayer(
    string Id,
    string Name,
    bool Visible,
    bool Locked,
    bool Frozen = false,
    string? Color = null,
    string? LineType = null,
    double? LineWeight = null,
    double? Transparency = null);

public sealed record CadStyle(
    string? Color = null,
    string? LineType = null,
    double? LineWeight = null,
    double? Transparency = null);

public sealed record CadBlockDefinition(
    string Id,
    string Name,
    string SourceHandle,
    CadPoint BasePoint,
    IReadOnlyList<string> EntityIds,
    bool IsExternalReference = false,
    string? ExternalPath = null);

public sealed record CadEntity(
    string Id,
    string SourceHandle,
    string Type,
    string LayerId,
    CadBounds Bounds,
    IReadOnlyDictionary<string, object?> Geometry,
    IReadOnlyDictionary<string, object?> Properties,
    string? OwnerHandle = null,
    IReadOnlyList<double>? Transform = null,
    CadStyle? Style = null,
    string? SourceBlockName = null,
    bool Unsupported = false,
    string? UnsupportedReason = null);

public sealed record CadValidationIssue(
    string Code,
    string Severity,
    string Message,
    string? EntityId = null,
    string? SourceHandle = null,
    string? LayerId = null,
    double? Delta = null);

public sealed record CadImportValidation(
    string SourceFileName,
    int SourceEntityCount,
    int NormalizedEntityCount,
    int UnsupportedEntityCount,
    IReadOnlyList<string> MissingReferences,
    IReadOnlyList<string> MissingFonts,
    IReadOnlyList<CadValidationIssue> Issues,
    IReadOnlyList<string> Warnings,
    bool Passed,
    CadBounds? SourceBounds = null,
    CadBounds? NormalizedBounds = null,
    double? BoundsDelta = null);

public interface ICadImportProvider
{
    string Name { get; }
    bool IsConfigured { get; }
    Task<(NormalizedCadDocument Document, CadImportValidation Validation)> ImportAsync(Stream source, string fileName, CancellationToken cancellationToken);
}
