using System.Text;
using System.Text.Json;
using Archit.Api.Projects;

namespace Archit.Api.Exports;

public sealed class ExportWorker(
    IExportJobRepository jobs,
    IExportArtifactStore artifacts,
    IProjectRepository projects,
    ILogger<ExportWorker> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

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
            if (job.Format != "json")
            {
                await jobs.SaveAsync(job with { Status="failed",Progress=0,UpdatedAt=now,Error=$"Export format {job.Format} does not yet have a configured server-side processor." },cancellationToken);
                return;
            }

            await jobs.SaveAsync(job with { Status="processing",Progress=25,UpdatedAt=now,Error=null },cancellationToken);
            var revision=await projects.GetRevisionAsync(job.ProjectId,job.RevisionId,cancellationToken);
            if (revision is null) throw new KeyNotFoundException($"Revision {job.RevisionId} was not found for project {job.ProjectId}.");
            var envelope=new
            {
                schemaVersion=1,
                projectId=job.ProjectId,
                revisionId=revision.Id,
                revisionKind=revision.Kind,
                sourceImportId=revision.SourceImportId,
                generatedAt=DateTimeOffset.UtcNow,
                model=revision.Model
            };
            var bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope,JsonOptions));
            var path=await artifacts.SaveAsync(job,$"archit-{job.ProjectId:N}-{revision.Id:N}.json",bytes,cancellationToken);
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
