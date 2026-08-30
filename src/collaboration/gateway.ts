import type { CollaborationComment, CollaborationEvent, CollaborationRole, ObjectReference } from './events';
import { readJson } from '../projects/gateway';

export class HttpCollaborationGateway {
  constructor(private readonly baseUrl=import.meta.env.VITE_API_URL??'http://localhost:5080'){}
  async listEvents(projectId:string){return readJson<CollaborationEvent[]>(await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/events`));}
  async addEvent(projectId:string,input:{revisionId?:string|null;actorId:string;actorRole:CollaborationRole;type:string;target?:ObjectReference;payload?:Record<string,string|null>}){return readJson<CollaborationEvent>(await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId:input.revisionId??null,actorId:input.actorId,actorRole:input.actorRole,type:input.type,targetKind:input.target?.kind??null,targetId:input.target?.id??null,payload:input.payload??{}})}));}
  async listComments(projectId:string,includeResolved=true){return readJson<CollaborationComment[]>(await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/comments?includeResolved=${includeResolved}`));}
  async addComment(projectId:string,input:{revisionId?:string|null;authorId:string;authorRole:CollaborationRole;target:ObjectReference;body:string}){return readJson<CollaborationComment>(await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId:input.revisionId??null,authorId:input.authorId,authorRole:input.authorRole,targetKind:input.target.kind,targetId:input.target.id,body:input.body})}));}
  async resolveComment(projectId:string,commentId:string,resolvedBy:string){return readJson<CollaborationComment>(await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/collaboration/comments/${encodeURIComponent(commentId)}/resolve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolvedBy})}));}
}
