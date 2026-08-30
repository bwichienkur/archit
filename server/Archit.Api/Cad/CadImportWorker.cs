using System.Collections.Concurrent;

namespace Archit.Api.Cad;

public sealed class CadImportWorker(
    ICadImportQueue queue,
    ICadArtifactStore artifacts,
    ICadImportProvider provider,
    ConcurrentDictionary<Guid, CadImportJob> jobs,
    ILogger<CadImportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            Guid jobId;
            try { jobId = await queue.DequeueAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }

            if (!jobs.TryGetValue(jobId, out var job))
            {
                logger.LogWarning("CAD import queue referenced missing job {JobId}", jobId);
                continue;
            }

            try
            {
                jobs[jobId] = job with { Status = "processing", Progress = 10, Error = null };
                await using var source = await artifacts.OpenSourceAsync(jobId, stoppingToken);
                var result = await provider.ImportAsync(source, job.FileName, stoppingToken);
                await artifacts.SaveResultsAsync(jobId, result.Document, result.Validation, stoppingToken);
                jobs[jobId] = job with
                {
                    Status = "completed",
                    Progress = 100,
                    Error = null,
                    Document = result.Document,
                    Validation = result.Validation,
                };
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                jobs[jobId] = job with { Status = "failed", Error = "Import interrupted by server shutdown." };
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "CAD import {JobId} failed", jobId);
                jobs[jobId] = job with { Status = "failed", Progress = 0, Error = ex.Message };
            }
        }
    }
}
