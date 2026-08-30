using System.Text.Json;

namespace Archit.Api.Projects;

public sealed class LocalProjectRepository(IConfiguration configuration, IWebHostEnvironment environment) : IProjectRepository
{
    private readonly string _root = ResolveRoot(configuration, environment);
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public async Task<ProjectRecord> CreateAsync(string name, Guid? tenantId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var project = new ProjectRecord(Guid.NewGuid(), tenantId, name.Trim(), now, now);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(ProjectDirectory(project.Id));
            Directory.CreateDirectory(RevisionsDirectory(project.Id));
            await WriteAtomicAsync(ProjectPath(project.Id), project, cancellationToken);
        }
        finally { _gate.Release(); }
        return project;
    }

    public async Task<ProjectRecord?> GetAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var path = ProjectPath(projectId);
        return File.Exists(path) ? await ReadAsync<ProjectRecord>(path, cancellationToken) : null;
    }

    public async Task<IReadOnlyList<ProjectRecord>> ListAsync(CancellationToken cancellationToken)
    {
        var projects = new List<ProjectRecord>();
        foreach (var directory in Directory.EnumerateDirectories(_root))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var path = Path.Combine(directory, "project.json");
            if (!File.Exists(path)) continue;
            try
            {
                var project = await ReadAsync<ProjectRecord>(path, cancellationToken);
                if (project is not null) projects.Add(project);
            }
            catch (JsonException) { }
        }
        return projects.OrderByDescending(project => project.UpdatedAt).ToArray();
    }

    public async Task<ProjectRevision> AddRevisionAsync(Guid projectId, CreateRevisionRequest request, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var project = await GetAsync(projectId, cancellationToken)
                ?? throw new KeyNotFoundException($"Project {projectId} was not found.");
            if (request.ParentRevisionId is { } parentId && !File.Exists(RevisionPath(projectId, parentId)))
                throw new InvalidOperationException($"Parent revision {parentId} does not belong to project {projectId}.");

            var revision = new ProjectRevision(
                Guid.NewGuid(),
                projectId,
                request.ParentRevisionId,
                request.Kind.Trim(),
                DateTimeOffset.UtcNow,
                request.CreatedBy.Trim(),
                request.SourceImportId,
                request.Model.Clone(),
                request.Note);

            Directory.CreateDirectory(RevisionsDirectory(projectId));
            await WriteAtomicAsync(RevisionPath(projectId, revision.Id), revision, cancellationToken);
            await WriteAtomicAsync(ProjectPath(projectId), project with { UpdatedAt = revision.CreatedAt }, cancellationToken);
            return revision;
        }
        finally { _gate.Release(); }
    }

    public async Task<ProjectRevision?> GetRevisionAsync(Guid projectId, Guid revisionId, CancellationToken cancellationToken)
    {
        var path = RevisionPath(projectId, revisionId);
        return File.Exists(path) ? await ReadAsync<ProjectRevision>(path, cancellationToken) : null;
    }

    public async Task<IReadOnlyList<ProjectRevision>> ListRevisionsAsync(Guid projectId, CancellationToken cancellationToken)
    {
        if (!File.Exists(ProjectPath(projectId))) throw new KeyNotFoundException($"Project {projectId} was not found.");
        var directory = RevisionsDirectory(projectId);
        if (!Directory.Exists(directory)) return Array.Empty<ProjectRevision>();

        var revisions = new List<ProjectRevision>();
        foreach (var path in Directory.EnumerateFiles(directory, "*.json", SearchOption.TopDirectoryOnly))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var revision = await ReadAsync<ProjectRevision>(path, cancellationToken);
            if (revision is not null) revisions.Add(revision);
        }
        return revisions.OrderByDescending(revision => revision.CreatedAt).ToArray();
    }

    private async Task<T?> ReadAsync<T>(string path, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, cancellationToken);
    }

    private async Task WriteAtomicAsync<T>(string target, T value, CancellationToken cancellationToken)
    {
        var temporary = target + ".tmp";
        await using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            await JsonSerializer.SerializeAsync(stream, value, JsonOptions, cancellationToken);
        File.Move(temporary, target, overwrite: true);
    }

    private string ProjectDirectory(Guid projectId) => Path.Combine(_root, projectId.ToString("N"));
    private string ProjectPath(Guid projectId) => Path.Combine(ProjectDirectory(projectId), "project.json");
    private string RevisionsDirectory(Guid projectId) => Path.Combine(ProjectDirectory(projectId), "revisions");
    private string RevisionPath(Guid projectId, Guid revisionId) => Path.Combine(RevisionsDirectory(projectId), $"{revisionId:N}.json");

    private static string ResolveRoot(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["Projects:DataPath"] ?? Environment.GetEnvironmentVariable("ARCHIT_PROJECT_DATA_PATH");
        var root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, ".archit-data", "projects")
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(root);
        return root;
    }
}
