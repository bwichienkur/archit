namespace Archit.Api.Cad;

public sealed class CadImportWorker(
    ICadImportQueue queue,
    ICadArtifactStore artifacts,
    ICadImportProvider provider,
    ICadImportJobStore jobs,
    ILogger<CadImportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverInterruptedJobsAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            Guid jobId;
            try { jobId = await queue.DequeueAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }

            var job = await jobs.GetAsync(jobId, stoppingToken);
            if (job is null)
            {
                logger.LogWarning("CAD import queue referenced missing job {JobId}", jobId);
                continue;
            }

            try
            {
                var processing = job with { Status = "processing", Progress = 10, Error = null, Document = null, Validation = null };
                await jobs.SaveAsync(processing, stoppingToken);
                await using var source = await artifacts.OpenSourceAsync(jobId, stoppingToken);
                var result = await provider.ImportAsync(source, job.FileName, stoppingToken);
                await artifacts.SaveResultsAsync(jobId, result.Document, result.Validation, stoppingToken);
                await jobs.SaveAsync(processing with
                {
                    Status = "completed",
                    Progress = 100,
                    Error = null,
                    Document = result.Document,
                    Validation = result.Validation,
                }, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                await jobs.SaveAsync(job with { Status = "queued", Progress = 0, Error = "Import interrupted by server shutdown; queued for retry." }, CancellationToken.None);
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "CAD import {JobId} failed", jobId);
                await jobs.SaveAsync(job with { Status = "failed", Progress = 0, Error = ex.Message }, stoppingToken);
            }
        }
    }

    private async Task RecoverInterruptedJobsAsync(CancellationToken cancellationToken)
    {
        var recoverable = await jobs.ListRecoverableAsync(cancellationToken);
        foreach (var job in recoverable)
        {
            var queued = job with { Status = "queued", Progress = 0, Error = job.Status == "processing" ? "Recovered after server restart." : job.Error, Document = null, Validation = null };
            await jobs.SaveAsync(queued, cancellationToken);
            await queue.EnqueueAsync(job.Id, cancellationToken);
            logger.LogInformation("Recovered CAD import {JobId} from persisted {PreviousStatus} state", job.Id, job.Status);
        }
    }
}
