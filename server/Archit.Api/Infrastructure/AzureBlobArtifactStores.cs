using System.Text.Json;
using Archit.Api.Cad;
using Archit.Api.Exports;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Archit.Api.Infrastructure;

public sealed class AzureBlobCadArtifactStore : ICadArtifactStore
{
    private readonly BlobContainerClient _container;
    private static readonly JsonSerializerOptions JsonOptions=new(JsonSerializerDefaults.Web);
    public AzureBlobCadArtifactStore(IConfiguration configuration)
    {
        _container=CreateContainer(configuration,"CadImport:BlobContainer","ARCHIT_CAD_BLOB_CONTAINER","archit-cad-imports");
    }
    public async Task SaveSourceAsync(Guid jobId,string fileName,Stream source,CancellationToken cancellationToken)
    {
        var safeName=Path.GetFileName(fileName);var extension=string.Equals(Path.GetExtension(safeName),".dwg",StringComparison.OrdinalIgnoreCase)?".dwg":".bin";await _container.CreateIfNotExistsAsync(cancellationToken:cancellationToken);await _container.GetBlobClient($"{jobId:N}/source{extension}").UploadAsync(source,overwrite:false,cancellationToken);using var nameStream=new MemoryStream(System.Text.Encoding.UTF8.GetBytes(safeName));await _container.GetBlobClient($"{jobId:N}/filename.txt").UploadAsync(nameStream,overwrite:true,cancellationToken);
    }
    public async Task<Stream> OpenSourceAsync(Guid jobId,CancellationToken cancellationToken)
    {
        await foreach(var blob in _container.GetBlobsAsync(BlobTraits.None,BlobStates.None,$"{jobId:N}/source",cancellationToken)){var response=await _container.GetBlobClient(blob.Name).DownloadStreamingAsync(cancellationToken:cancellationToken);return response.Value.Content;}throw new FileNotFoundException($"Source artifact for CAD import {jobId} was not found.");
    }
    public async Task SaveResultsAsync(Guid jobId,NormalizedCadDocument document,CadImportValidation validation,CancellationToken cancellationToken)
    {
        await _container.CreateIfNotExistsAsync(cancellationToken:cancellationToken);await UploadJson($"{jobId:N}/normalized.json",document,cancellationToken);await UploadJson($"{jobId:N}/validation.json",validation,cancellationToken);
    }
    private async Task UploadJson<T>(string path,T value,CancellationToken cancellationToken){var bytes=JsonSerializer.SerializeToUtf8Bytes(value,JsonOptions);using var stream=new MemoryStream(bytes);await _container.GetBlobClient(path).UploadAsync(stream,new BlobUploadOptions{HttpHeaders=new BlobHttpHeaders{ContentType="application/json"}},cancellationToken);}
    private static BlobContainerClient CreateContainer(IConfiguration configuration,string containerKey,string containerEnvironment,string fallback){var connection=configuration["Storage:AzureBlob:ConnectionString"]??Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING")??throw new InvalidOperationException("Azure Blob connection string is not configured.");var name=configuration[containerKey]??Environment.GetEnvironmentVariable(containerEnvironment)??fallback;return new BlobContainerClient(connection,name);}
}

public sealed class AzureBlobExportArtifactStore : IExportArtifactStore
{
    private readonly BlobContainerClient _container;
    public AzureBlobExportArtifactStore(IConfiguration configuration)
    {
        var connection=configuration["Storage:AzureBlob:ConnectionString"]??Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING")??throw new InvalidOperationException("Azure Blob connection string is not configured.");var name=configuration["Exports:BlobContainer"]??Environment.GetEnvironmentVariable("ARCHIT_EXPORT_BLOB_CONTAINER")??"archit-exports";_container=new BlobContainerClient(connection,name);
    }
    public async Task<string> SaveAsync(ExportJobRecord job,string fileName,ReadOnlyMemory<byte> content,CancellationToken cancellationToken)
    {
        var safeName=Path.GetFileName(fileName);if(string.IsNullOrWhiteSpace(safeName))throw new InvalidOperationException("Export artifact filename is required.");await _container.CreateIfNotExistsAsync(cancellationToken:cancellationToken);var blobName=$"{job.ProjectId:N}/{job.Id:N}/{safeName}";using var stream=new MemoryStream(content.ToArray());await _container.GetBlobClient(blobName).UploadAsync(stream,new BlobUploadOptions{HttpHeaders=new BlobHttpHeaders{ContentType=ContentType(safeName)}},cancellationToken);return "azureblob://"+_container.Name+"/"+blobName;
    }
    public async Task<Stream> OpenAsync(ExportJobRecord job,CancellationToken cancellationToken)
    {
        if(string.IsNullOrWhiteSpace(job.ArtifactPath)||!job.ArtifactPath.StartsWith("azureblob://",StringComparison.OrdinalIgnoreCase))throw new FileNotFoundException($"Export artifact for job {job.Id} was not found in Azure Blob storage.");var prefix=$"azureblob://{_container.Name}/";if(!job.ArtifactPath.StartsWith(prefix,StringComparison.OrdinalIgnoreCase))throw new FileNotFoundException("Export artifact belongs to a different blob container.");var blobName=job.ArtifactPath[prefix.Length..];try{return (await _container.GetBlobClient(blobName).DownloadStreamingAsync(cancellationToken:cancellationToken)).Value.Content;}catch(Azure.RequestFailedException ex)when(ex.Status==404){throw new FileNotFoundException($"Export artifact for job {job.Id} was not found.",ex);}
    }
    private static string ContentType(string name)=>Path.GetExtension(name).ToLowerInvariant() switch{".json"=>"application/json",".svg"=>"image/svg+xml",".csv"=>"text/csv",".gltf"=>"model/gltf+json",".glb"=>"model/gltf-binary",".pdf"=>"application/pdf",_=>"application/octet-stream"};
}
