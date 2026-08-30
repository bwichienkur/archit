using System.Diagnostics;
using System.Security.Cryptography;
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
    private readonly int _timeoutSeconds = ResolveTimeoutSeconds(configuration["CadImport:TimeoutSeconds"]);

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

            var sourceSha256 = await ComputeSha256Async(inputPath, cancellationToken);
            var startInfo = new ProcessStartInfo
            {
                FileName = _executable!,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = workDir,
            };
            startInfo.ArgumentList.Add("--input");
            startInfo.ArgumentList.Add(inputPath);
            startInfo.ArgumentList.Add("--output");
            startInfo.ArgumentList.Add(outputPath);
            startInfo.ArgumentList.Add("--validation");
            startInfo.ArgumentList.Add(validationPath);

            using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Failed to launch CAD worker.");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(_timeoutSeconds));
            var stdoutTask = process.StandardOutput.ReadToEndAsync(timeout.Token);
            var stderrTask = process.StandardError.ReadToEndAsync(timeout.Token);

            try
            {
                await process.WaitForExitAsync(timeout.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                TryKill(process);
                throw new TimeoutException($"CAD worker exceeded the {_timeoutSeconds}-second execution limit.");
            }

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

            ValidateWorkerOutput(document, validation, sourceSha256);
            return (document, validation);
        }
        finally
        {
            try { Directory.Delete(workDir, recursive: true); } catch { /* best effort temp cleanup */ }
        }
    }

    private static void ValidateWorkerOutput(NormalizedCadDocument document, CadImportValidation validation, string sourceSha256)
    {
        if (document.SchemaVersion != 2)
            throw new InvalidOperationException($"CAD worker returned schema version {document.SchemaVersion}; Archit requires schema version 2.");
        if (!string.Equals(document.SourceSha256, sourceSha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("CAD worker source SHA-256 does not match the uploaded DWG.");
        if (document.Entities.Select(entity => entity.Id).Distinct(StringComparer.Ordinal).Count() != document.Entities.Count)
            throw new InvalidOperationException("CAD worker returned duplicate normalized entity IDs.");
        if (document.Layers.Select(layer => layer.Id).Distinct(StringComparer.Ordinal).Count() != document.Layers.Count)
            throw new InvalidOperationException("CAD worker returned duplicate layer IDs.");
        if (validation.NormalizedEntityCount != document.Entities.Count)
            throw new InvalidOperationException("CAD validation entity count does not match the normalized document.");
        if (!string.Equals(validation.SourceFileName, document.SourceFileName, StringComparison.Ordinal))
            throw new InvalidOperationException("CAD validation source filename does not match the normalized document.");
    }

    private static async Task<string> ComputeSha256Async(string path, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(path);
        using var sha = SHA256.Create();
        var hash = await sha.ComputeHashAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static int ResolveTimeoutSeconds(string? configured)
    {
        if (!int.TryParse(configured, out var seconds)) return 120;
        return Math.Clamp(seconds, 10, 900);
    }

    private static void TryKill(Process process)
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { /* process may already be gone */ }
    }
}
