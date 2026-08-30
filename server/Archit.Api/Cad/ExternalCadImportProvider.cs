using System.Diagnostics;
using System.Text.Json;

namespace Archit.Api.Cad;

/// <summary>
/// Adapter for a separately licensed native DWG worker (for example one built with ODA Drawings/Architecture SDK).
/// The worker receives input/output file paths and writes normalized JSON matching NormalizedCadDocument.
/// Keeping the licensed/native SDK out of the web process isolates crashes, licensing and platform constraints.
/// </summary>
public sealed class ExternalCadImportProvider(IConfiguration configuration) : ICadImportProvider
{
    private readonly string? _executable = configuration["CadImport:ExecutablePath"]
        ?? Environment.GetEnvironmentVariable("ARCHIT_CAD_IMPORTER_PATH");

    public string Name => "external-native-worker";
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_executable) && File.Exists(_executable);

    public async Task<(NormalizedCadDocument Document, CadImportValidation Validation)> ImportAsync(
        Stream source,
        string fileName,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("Native CAD worker executable is not configured.");

        var workDir = Path.Combine(Path.GetTempPath(), "archit-cad", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
        var inputPath = Path.Combine(workDir, Path.GetFileName(fileName));
        var outputPath = Path.Combine(workDir, "normalized.json");
        var validationPath = Path.Combine(workDir, "validation.json");

        try
        {
            await using (var file = File.Create(inputPath))
                await source.CopyToAsync(file, cancellationToken);

            var startInfo = new ProcessStartInfo
            {
                FileName = _executable!,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            startInfo.ArgumentList.Add("--input");
            startInfo.ArgumentList.Add(inputPath);
            startInfo.ArgumentList.Add("--output");
            startInfo.ArgumentList.Add(outputPath);
            startInfo.ArgumentList.Add("--validation");
            startInfo.ArgumentList.Add(validationPath);

            using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Failed to launch CAD worker.");
            var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            if (process.ExitCode != 0)
                throw new InvalidOperationException($"CAD worker exited with code {process.ExitCode}: {stderr}".Trim());
            if (!File.Exists(outputPath) || !File.Exists(validationPath))
                throw new InvalidOperationException($"CAD worker did not produce required output files. {stdout}".Trim());

            var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var document = JsonSerializer.Deserialize<NormalizedCadDocument>(await File.ReadAllTextAsync(outputPath, cancellationToken), jsonOptions)
                ?? throw new InvalidOperationException("CAD worker returned an invalid normalized document.");
            var validation = JsonSerializer.Deserialize<CadImportValidation>(await File.ReadAllTextAsync(validationPath, cancellationToken), jsonOptions)
                ?? throw new InvalidOperationException("CAD worker returned an invalid validation report.");
            return (document, validation);
        }
        finally
        {
            try { Directory.Delete(workDir, recursive: true); } catch { /* best effort temp cleanup */ }
        }
    }
}
