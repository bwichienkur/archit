using Archit.Api.Projects;

namespace Archit.Api.Exports;

public sealed class ExportWorker(
    IExportJobRepository jobs,
    IExportArtifactStore artifacts,
    IProjectRepository projects,
    ExportProcessorRegistry processors,
    IConfiguration configuration,
    ILogger<ExportWorker> logger) : BackgroundService
{
    private readonly TimeSpan _processingStaleAfter=TimeSpan.FromSeconds(Math.Max(60,configuration.GetValue("Exports:ProcessingStaleSeconds",120)));
    private readonly TimeSpan _heartbeatInterval=TimeSpan.FromSeconds(Math.Max(10,configuration.GetValue("Exports:HeartbeatSeconds",30)));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            ExportJobRecord? job;
            try { job=await jobs.ClaimNextAsync(_processingStaleAfter,stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex,"Failed to claim the next export job.");
                await Task.Delay(TimeSpan.FromSeconds(2),stoppingToken);
                continue;
            }

            if(job is null)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(500),stoppingToken);
                continue;
            }

            await ProcessAsync(job,stoppingToken);
        }
    }

    private async Task ProcessAsync(ExportJobRecord job,CancellationToken cancellationToken)
    {
        try
        {
            if (!processors.Supports(job.Format))
            {
                await jobs.SaveAsync(job with { Status="failed",Progress=0,UpdatedAt=DateTimeOffset.UtcNow,Error=$"Export format {job.Format} does not have a configured server-side processor." },cancellationToken);
                return;
            }

            var revision=await projects.GetRevisionAsync(job.ProjectId,job.RevisionId,cancellationToken);
            if (revision is null) throw new KeyNotFoundException($"Revision {job.RevisionId} was not found for project {job.ProjectId}.");

            var processor=processors.GetRequired(job.Format);
            var processing=job with{Status="processing",Progress=Math.Max(job.Progress,25),Error=null};
            var processorTask=processor.ProcessAsync(processing,revision,cancellationToken);
            while(!processorTask.IsCompleted)
            {
                var heartbeat=Task.Delay(_heartbeatInterval,cancellationToken);
                var completed=await Task.WhenAny(processorTask,heartbeat);
                if(completed==processorTask)break;
                processing=processing with{UpdatedAt=DateTimeOffset.UtcNow};
                await jobs.SaveAsync(processing,cancellationToken);
                logger.LogDebug("Refreshed export job {JobId} processing heartbeat",job.Id);
            }

            var artifact=await processorTask;
            processing=processing with{Progress=75,UpdatedAt=DateTimeOffset.UtcNow};
            await jobs.SaveAsync(processing,cancellationToken);
            var path=await artifacts.SaveAsync(processing,artifact.FileName,artifact.Content,cancellationToken);
            await jobs.SaveAsync(processing with { Status="completed",Progress=100,UpdatedAt=DateTimeOffset.UtcNow,ArtifactPath=path,Error=null },cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await jobs.SaveAsync(job with{Status="queued",Progress=0,UpdatedAt=DateTimeOffset.UtcNow,Error="Export interrupted by server shutdown; queued for retry."},CancellationToken.None);
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex,"Export job {JobId} failed",job.Id);
            await jobs.SaveAsync(job with { Status="failed",Progress=0,UpdatedAt=DateTimeOffset.UtcNow,Error=ex.Message },CancellationToken.None);
        }
    }
}
