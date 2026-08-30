using System.Data.Common;
using System.Text.Json;
using Archit.Api.Infrastructure;

namespace Archit.Api.Projects;

public sealed class PostgresProjectRepository(IArchitDbConnectionFactory connections) : IProjectRepository
{
    public async Task<ProjectRecord> CreateAsync(string name,CancellationToken cancellationToken)
    {
        var project=new ProjectRecord(Guid.NewGuid(),name.Trim(),DateTimeOffset.UtcNow,DateTimeOffset.UtcNow);
        await using var connection=await connections.OpenAsync(cancellationToken);
        await using var command=connection.CreateCommand();
        command.CommandText="INSERT INTO projects(id,name,created_at,updated_at) VALUES(@id,@name,@created,@updated)";
        Add(command,"id",project.Id);Add(command,"name",project.Name);Add(command,"created",project.CreatedAt);Add(command,"updated",project.UpdatedAt);
        await command.ExecuteNonQueryAsync(cancellationToken);return project;
    }

    public async Task<ProjectRecord?> GetAsync(Guid projectId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="SELECT id,name,created_at,updated_at FROM projects WHERE id=@id";Add(command,"id",projectId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);return await reader.ReadAsync(cancellationToken)?ReadProject(reader):null;
    }

    public async Task<IReadOnlyList<ProjectRecord>> ListAsync(CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="SELECT id,name,created_at,updated_at FROM projects ORDER BY updated_at DESC";await using var reader=await command.ExecuteReaderAsync(cancellationToken);var items=new List<ProjectRecord>();while(await reader.ReadAsync(cancellationToken))items.Add(ReadProject(reader));return items;
    }

    public async Task<ProjectRevision> AddRevisionAsync(Guid projectId,CreateRevisionRequest request,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var transaction=await connection.BeginTransactionAsync(cancellationToken);
        if(!await Exists(connection,transaction,"SELECT 1 FROM projects WHERE id=@id",projectId,cancellationToken))throw new KeyNotFoundException($"Project {projectId} was not found.");
        if(request.ParentRevisionId is Guid parentId&&!await Exists(connection,transaction,"SELECT 1 FROM project_revisions WHERE id=@id AND project_id=@project",parentId,cancellationToken,projectId))throw new InvalidOperationException($"Parent revision {parentId} does not belong to project {projectId}.");
        var revision=new ProjectRevision(Guid.NewGuid(),projectId,request.ParentRevisionId,request.Kind.Trim(),DateTimeOffset.UtcNow,request.CreatedBy.Trim(),request.SourceImportId,request.Model.Clone(),request.Note);
        await using(var insert=connection.CreateCommand()){insert.Transaction=transaction;insert.CommandText="INSERT INTO project_revisions(id,project_id,parent_revision_id,kind,created_at,created_by,source_import_id,model,note) VALUES(@id,@project,@parent,@kind,@created,@by,@source,CAST(@model AS jsonb),@note)";Add(insert,"id",revision.Id);Add(insert,"project",projectId);Add(insert,"parent",revision.ParentRevisionId);Add(insert,"kind",revision.Kind);Add(insert,"created",revision.CreatedAt);Add(insert,"by",revision.CreatedBy);Add(insert,"source",revision.SourceImportId);Add(insert,"model",revision.Model.GetRawText());Add(insert,"note",revision.Note);await insert.ExecuteNonQueryAsync(cancellationToken);}
        await using(var update=connection.CreateCommand()){update.Transaction=transaction;update.CommandText="UPDATE projects SET updated_at=@updated WHERE id=@id";Add(update,"updated",revision.CreatedAt);Add(update,"id",projectId);await update.ExecuteNonQueryAsync(cancellationToken);}await transaction.CommitAsync(cancellationToken);return revision;
    }

    public async Task<ProjectRevision?> GetRevisionAsync(Guid projectId,Guid revisionId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText=RevisionSelect+" WHERE project_id=@project AND id=@id";Add(command,"project",projectId);Add(command,"id",revisionId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);return await reader.ReadAsync(cancellationToken)?ReadRevision(reader):null;
    }

    public async Task<IReadOnlyList<ProjectRevision>> ListRevisionsAsync(Guid projectId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);if(!await Exists(connection,null,"SELECT 1 FROM projects WHERE id=@id",projectId,cancellationToken))throw new KeyNotFoundException($"Project {projectId} was not found.");await using var command=connection.CreateCommand();command.CommandText=RevisionSelect+" WHERE project_id=@project ORDER BY created_at DESC";Add(command,"project",projectId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);var items=new List<ProjectRevision>();while(await reader.ReadAsync(cancellationToken))items.Add(ReadRevision(reader));return items;
    }

    private const string RevisionSelect="SELECT id,project_id,parent_revision_id,kind,created_at,created_by,source_import_id,model::text,note FROM project_revisions";
    private static ProjectRecord ReadProject(DbDataReader reader)=>new(reader.GetGuid(0),reader.GetString(1),reader.GetFieldValue<DateTimeOffset>(2),reader.GetFieldValue<DateTimeOffset>(3));
    private static ProjectRevision ReadRevision(DbDataReader reader){using var doc=JsonDocument.Parse(reader.GetString(7));return new ProjectRevision(reader.GetGuid(0),reader.GetGuid(1),reader.IsDBNull(2)?null:reader.GetGuid(2),reader.GetString(3),reader.GetFieldValue<DateTimeOffset>(4),reader.GetString(5),reader.IsDBNull(6)?null:reader.GetGuid(6),doc.RootElement.Clone(),reader.IsDBNull(8)?null:reader.GetString(8));}
    private static async Task<bool> Exists(DbConnection connection,DbTransaction? transaction,string sql,Guid id,CancellationToken cancellationToken,Guid? projectId=null){await using var command=connection.CreateCommand();command.Transaction=transaction;command.CommandText=sql;Add(command,"id",id);if(projectId.HasValue)Add(command,"project",projectId.Value);return await command.ExecuteScalarAsync(cancellationToken)is not null;}
    private static void Add(DbCommand command,string name,object? value){var parameter=command.CreateParameter();parameter.ParameterName="@"+name;parameter.Value=value??DBNull.Value;command.Parameters.Add(parameter);}
}
