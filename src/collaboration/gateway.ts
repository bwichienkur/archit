import { apiJson } from '../auth/apiFetch';
import type { CollaborationComment, CollaborationEvent, CollaborationEventType, CollaborationRole, ObjectReference } from './events';

type EventDto={id:string;projectId:string;revisionId:string|null;actorId:string;actorRole:CollaborationRole;type:CollaborationEventType;targetKind:string|null;targetId:string|null;createdAt:string;payload:Record<string,string|null>};
type CommentDto={id:string;projectId:string;revisionId:string|null;authorId:string;authorRole:CollaborationRole;targetKind:string;targetId:string;body:string;createdAt:string;resolvedAt:string|null;resolvedBy:string|null};

export class HttpCollaborationGateway {
  constructor(private readonly baseUrl=import.meta.env.VITE_API_URL??'http://localhost:5080'){}
  async listEvents(projectId:string){return (await apiJson<EventDto[]>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/events`)).map(toEvent);}
  async addEvent(projectId:string,input:{revisionId?:string|null;actorId:string;actorRole:CollaborationRole;type:CollaborationEventType;target?:ObjectReference;payload?:Record<string,string|null>}){return toEvent(await apiJson<EventDto>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId:input.revisionId??null,actorId:input.actorId,actorRole:input.actorRole,type:input.type,targetKind:input.target?.kind??null,targetId:input.target?.id??null,payload:input.payload??{}})}));}
  async listComments(projectId:string,includeResolved=true){return (await apiJson<CommentDto[]>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/comments?includeResolved=${includeResolved}`)).map(toComment);}
  async addComment(projectId:string,input:{revisionId?:string|null;authorId:string;authorRole:CollaborationRole;target:ObjectReference;body:string}){return toComment(await apiJson<CommentDto>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId:input.revisionId??null,authorId:input.authorId,authorRole:input.authorRole,targetKind:input.target.kind,targetId:input.target.id,body:input.body})}));}
  async resolveComment(projectId:string,commentId:string,resolvedBy:string){return toComment(await apiJson<CommentDto>(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/comments/${encodeURIComponent(commentId)}/resolve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolvedBy})}));}
}

function toEvent(dto:EventDto):CollaborationEvent{return{id:dto.id,projectId:dto.projectId,revisionId:dto.revisionId??undefined,actorId:dto.actorId,actorRole:dto.actorRole,type:dto.type,target:dto.targetKind&&dto.targetId?{kind:dto.targetKind as ObjectReference['kind'],id:dto.targetId}:undefined,timestamp:dto.createdAt,payload:dto.payload};}
function toComment(dto:CommentDto):CollaborationComment{return{id:dto.id,projectId:dto.projectId,revisionId:dto.revisionId??undefined,authorId:dto.authorId,authorRole:dto.authorRole,target:{kind:dto.targetKind as ObjectReference['kind'],id:dto.targetId},body:dto.body,createdAt:dto.createdAt,resolvedAt:dto.resolvedAt??undefined,resolvedBy:dto.resolvedBy??undefined};}
