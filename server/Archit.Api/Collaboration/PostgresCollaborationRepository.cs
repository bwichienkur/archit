using System.Data.Common;
using System.Text.Json;
using Archit.Api.Infrastructure;

namespace Archit.Api.Collaboration;

public sealed class PostgresCollaborationRepository(IArchitDbConnectionFactory connections) : ICollaborationRepository
{
    public async Task<CollaborationEventRecord> AddEventAsync(Guid projectId,CreateCollaborationEventRequest request,CancellationToken cancellationToken)
    {
        ValidateEvent(request);var record=new CollaborationEventRecord(Guid.NewGuid(),projectId,request.RevisionId,request.ActorId.Trim(),request.ActorRole.Trim(),request.Type.Trim(),request.TargetKind?.Trim(),request.TargetId?.Trim(),DateTimeOffset.UtcNow,request.Payload??new());
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="INSERT INTO collaboration_events(id,project_id,revision_id,actor_id,actor_role,type,target_kind,target_id,created_at,payload) VALUES(@id,@project,@revision,@actor,@role,@type,@targetKind,@targetId,@created,CAST(@payload AS jsonb))";Add(command,"id",record.Id);Add(command,"project",projectId);Add(command,"revision",record.RevisionId);Add(command,"actor",record.ActorId);Add(command,"role",record.ActorRole);Add(command,"type",record.Type);Add(command,"targetKind",record.TargetKind);Add(command,"targetId",record.TargetId);Add(command,"created",record.CreatedAt);Add(command,"payload",JsonSerializer.Serialize(record.Payload));await command.ExecuteNonQueryAsync(cancellationToken);return record;
    }

    public async Task<IReadOnlyList<CollaborationEventRecord>> ListEventsAsync(Guid projectId,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="SELECT id,project_id,revision_id,actor_id,actor_role,type,target_kind,target_id,created_at,payload::text FROM collaboration_events WHERE project_id=@project ORDER BY created_at";Add(command,"project",projectId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);var items=new List<CollaborationEventRecord>();while(await reader.ReadAsync(cancellationToken))items.Add(ReadEvent(reader));return items;
    }

    public async Task<CollaborationCommentRecord> AddCommentAsync(Guid projectId,CreateCommentRequest request,CancellationToken cancellationToken)
    {
        ValidateComment(request);var record=new CollaborationCommentRecord(Guid.NewGuid(),projectId,request.RevisionId,request.AuthorId.Trim(),request.AuthorRole.Trim(),request.TargetKind.Trim(),request.TargetId.Trim(),request.Body.Trim(),DateTimeOffset.UtcNow,null,null);
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="INSERT INTO collaboration_comments(id,project_id,revision_id,author_id,author_role,target_kind,target_id,body,created_at,resolved_at,resolved_by) VALUES(@id,@project,@revision,@author,@role,@kind,@target,@body,@created,NULL,NULL)";Add(command,"id",record.Id);Add(command,"project",projectId);Add(command,"revision",record.RevisionId);Add(command,"author",record.AuthorId);Add(command,"role",record.AuthorRole);Add(command,"kind",record.TargetKind);Add(command,"target",record.TargetId);Add(command,"body",record.Body);Add(command,"created",record.CreatedAt);await command.ExecuteNonQueryAsync(cancellationToken);return record;
    }

    public async Task<CollaborationCommentRecord> ResolveCommentAsync(Guid projectId,Guid commentId,ResolveCommentRequest request,CancellationToken cancellationToken)
    {
        if(string.IsNullOrWhiteSpace(request.ResolvedBy))throw new InvalidOperationException("ResolvedBy is required.");var now=DateTimeOffset.UtcNow;await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="UPDATE collaboration_comments SET resolved_at=@resolved,resolved_by=@by WHERE project_id=@project AND id=@id RETURNING id,project_id,revision_id,author_id,author_role,target_kind,target_id,body,created_at,resolved_at,resolved_by";Add(command,"resolved",now);Add(command,"by",request.ResolvedBy.Trim());Add(command,"project",projectId);Add(command,"id",commentId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);if(!await reader.ReadAsync(cancellationToken))throw new KeyNotFoundException($"Comment {commentId} was not found.");return ReadComment(reader);
    }

    public async Task<IReadOnlyList<CollaborationCommentRecord>> ListCommentsAsync(Guid projectId,bool includeResolved,CancellationToken cancellationToken)
    {
        await using var connection=await connections.OpenAsync(cancellationToken);await using var command=connection.CreateCommand();command.CommandText="SELECT id,project_id,revision_id,author_id,author_role,target_kind,target_id,body,created_at,resolved_at,resolved_by FROM collaboration_comments WHERE project_id=@project"+(includeResolved?"":" AND resolved_at IS NULL")+" ORDER BY created_at";Add(command,"project",projectId);await using var reader=await command.ExecuteReaderAsync(cancellationToken);var items=new List<CollaborationCommentRecord>();while(await reader.ReadAsync(cancellationToken))items.Add(ReadComment(reader));return items;
    }

    private static CollaborationEventRecord ReadEvent(DbDataReader r)=>new(r.GetGuid(0),r.GetGuid(1),r.IsDBNull(2)?null:r.GetGuid(2),r.GetString(3),r.GetString(4),r.GetString(5),r.IsDBNull(6)?null:r.GetString(6),r.IsDBNull(7)?null:r.GetString(7),r.GetFieldValue<DateTimeOffset>(8),JsonSerializer.Deserialize<Dictionary<string,string?>>(r.GetString(9))??new());
    private static CollaborationCommentRecord ReadComment(DbDataReader r)=>new(r.GetGuid(0),r.GetGuid(1),r.IsDBNull(2)?null:r.GetGuid(2),r.GetString(3),r.GetString(4),r.GetString(5),r.GetString(6),r.GetString(7),r.GetFieldValue<DateTimeOffset>(8),r.IsDBNull(9)?null:r.GetFieldValue<DateTimeOffset>(9),r.IsDBNull(10)?null:r.GetString(10));
    private static void ValidateEvent(CreateCollaborationEventRequest r){if(string.IsNullOrWhiteSpace(r.ActorId)||string.IsNullOrWhiteSpace(r.ActorRole)||string.IsNullOrWhiteSpace(r.Type))throw new InvalidOperationException("ActorId, actor role, and event type are required.");}
    private static void ValidateComment(CreateCommentRequest r){if(string.IsNullOrWhiteSpace(r.AuthorId)||string.IsNullOrWhiteSpace(r.AuthorRole)||string.IsNullOrWhiteSpace(r.TargetKind)||string.IsNullOrWhiteSpace(r.TargetId)||string.IsNullOrWhiteSpace(r.Body))throw new InvalidOperationException("Author, role, target, and comment body are required.");}
    private static void Add(DbCommand command,string name,object? value){var parameter=command.CreateParameter();parameter.ParameterName="@"+name;parameter.Value=value??DBNull.Value;command.Parameters.Add(parameter);}
}
