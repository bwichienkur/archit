using Archit.Api.Projects;

namespace Archit.Api.Exports;

public sealed class ExportWorker(
    IExportJobRepository jobs,
    IExportArtifactStore artifacts,
    IProjectRepository projects,
    ExportProcessorRegistry processors,
    ILogger<ExportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            IReadOnlyList<ExportJobRecord> pending;
            try { pending = await jobs.ListPendingAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex,"Failed to discover pending export jobs.");
                await Task.Delay(TimeSpan.FromSeconds(2),stoppingToken);
                continue;
            }

            if (pending.Count == 0)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(500),stoppingToken);
                continue;
            }

            foreach (var job in pending)
            {
                if (stoppingToken.IsCancellationRequested) break;
                await ProcessAsync(job,stoppingToken);
            }
        }
    }

    private async Task ProcessAsync(ExportJobRecord job,CancellationToken cancellationToken)
    {
        var now=DateTimeOffset.UtcNow;
        try
        {
            if (!processors.Supports(job.Format))
            {
                await jobs.SaveAsync(job with { Status="failed",Progress=0,UpdatedAt=now,Error=$"Export format {job.Format} does not have a configured server-side processor." },cancellationToken);
                return;
            }

            await jobs.SaveAsync(job with { Status="processing",Progress=25,UpdatedAt=now,Error=null },cancellationToken);
            var revision=await projects.GetRevisionAsync(job.ProjectId,job.RevisionId,cancellationToken);
            if (revision is null) throw new KeyNotFoundException($"Revision {job.RevisionId} was not found for project {job.ProjectId}.");

            var processor=processors.GetRequired(job.Format);
            var artifact=await processor.ProcessAsync(job,revision,cancellationToken);
            await jobs.SaveAsync(job with { Status="processing",Progress=75,UpdatedAt=DateTimeOffset.UtcNow },cancellationToken);
            var path=await artifacts.SaveAsync(job,artifact.FileName,artifact.Content,cancellationToken);
            await jobs.SaveAsync(job with { Status="completed",Progress=100,UpdatedAt=DateTimeOffset.UtcNow,ArtifactPath=path,Error=null },cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex,"Export job {JobId} failed",job.Id);
            await jobs.SaveAsync(job with { Status="failed",Progress=0,UpdatedAt=DateTimeOffset.UtcNow,Error=ex.Message },CancellationToken.None);
        }
    }
}
