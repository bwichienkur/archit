namespace Archit.Api.Cad;

public sealed class UnconfiguredCadImportProvider : ICadImportProvider
{
    public string Name => "unconfigured";
    public bool IsConfigured => false;

    public Task<(NormalizedCadDocument Document, CadImportValidation Validation)> ImportAsync(
        Stream source,
        string fileName,
        CancellationToken cancellationToken)
    {
        throw new InvalidOperationException(
            "No licensed DWG provider is configured. Configure an ODA Drawings/Architecture SDK or Autodesk-compatible provider before importing DWG files.");
    }
}
