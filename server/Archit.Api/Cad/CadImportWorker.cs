using System.Text.Json;
using Archit.Api.Projects;

namespace Archit.Api.Cad;

public sealed class CadImportWorker(
    ICadImportQueue queue,
    ICadArtifactStore artifacts,
    ICadImportProvider provider,
    ICadImportJobStore jobs,
    IProjectRepository projects,
    IConfiguration configuration,
    ILogger<CadImportWorker> logger) : BackgroundService
{
    private readonly TimeSpan _heartbeatInterval = TimeSpan.FromSeconds(Math.Max(10,configuration.GetValue("CadImport:HeartbeatSeconds",30)));

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
                var importTask = provider.ImportAsync(source, job.FileName, stoppingToken);

                while (!importTask.IsCompleted)
                {
                    var heartbeat = Task.Delay(_heartbeatInterval, stoppingToken);
                    var completed = await Task.WhenAny(importTask, heartbeat);
                    if (completed == importTask) break;
                    await jobs.SaveAsync(processing, stoppingToken);
                    logger.LogDebug("Refreshed CAD import {JobId} processing heartbeat",jobId);
                }

                var result = await importTask;
                await artifacts.SaveResultsAsync(jobId, result.Document, result.Validation, stoppingToken);
                await LinkImportRevisionAsync(processing,result.Document,result.Validation,stoppingToken);
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

    private async Task LinkImportRevisionAsync(CadImportJob job,NormalizedCadDocument document,CadImportValidation validation,CancellationToken cancellationToken)
    {
        if(job.ProjectId is not Guid projectId)return;
        var existing=await projects.ListRevisionsAsync(projectId,cancellationToken);
        if(existing.Any(revision=>revision.SourceImportId==job.Id))return;

        var manifest=JsonSerializer.SerializeToElement(new
        {
            schemaVersion=1,
            kind="cad-import",
            importJobId=job.Id,
            sourceFileName=document.SourceFileName,
            sourceSha256=document.SourceSha256,
            sourceCadVersion=document.SourceCadVersion,
            drawingUnits=document.DrawingUnits,
            unitScaleToMeters=document.UnitScaleToMeters,
            entityCount=document.Entities.Count,
            unsupportedEntityCount=validation.UnsupportedEntityCount,
            bounds=document.Bounds,
            validation=new
            {
                validation.Passed,
                validation.SourceEntityCount,
                validation.NormalizedEntityCount,
                validation.BoundsDelta,
                issueCount=validation.Issues.Count,
                warningCount=validation.Warnings.Count,
            }
        });
        await projects.AddRevisionAsync(projectId,new CreateRevisionRequest(
            ParentRevisionId:null,
            Kind:"import",
            CreatedBy:"system:cad-import",
            SourceImportId:job.Id,
            Model:manifest,
            Note:$"Imported {document.SourceFileName}"),cancellationToken);
    }

    private async Task RecoverInterruptedJobsAsync(CancellationToken cancellationToken)
    {
        var recoverable = await jobs.ListRecoverableAsync(cancellationToken);
        foreach (var job in recoverable)
        {
            var queued = job with { Status = "queued", Progress = 0, Error = job.Status == "processing" ? "Recovered after processing heartbeat expired." : job.Error, Document = null, Validation = null };
            await jobs.SaveAsync(queued, cancellationToken);
            await queue.EnqueueAsync(job.Id, cancellationToken);
            logger.LogInformation("Recovered CAD import {JobId} from persisted {PreviousStatus} state", job.Id, job.Status);
        }
    }
}
