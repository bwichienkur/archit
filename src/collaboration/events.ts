export type CollaborationRole = 'architect'|'builder'|'designer'|'customer'|'admin';
export type CollaborationEventType = 'comment-created'|'comment-resolved'|'object-changed'|'revision-created'|'approval-requested'|'approval-recorded'|'selection-changed';

export type ObjectReference = { kind:'wall'|'opening'|'room'|'stair'|'roof'|'cabinet'|'fixture'|'selection'|'project'; id:string };
export type CollaborationComment = { id:string; projectId:string; revisionId?:string; authorId:string; authorRole:CollaborationRole; target:ObjectReference; body:string; createdAt:string; resolvedAt?:string; resolvedBy?:string };
export type CollaborationEvent = { id:string; projectId:string; revisionId?:string; actorId:string; actorRole:CollaborationRole; type:CollaborationEventType; target?:ObjectReference; timestamp:string; payload:Record<string,string|number|boolean|null> };

export class CollaborationTimeline {
  private events: CollaborationEvent[] = [];
  private comments = new Map<string, CollaborationComment>();

  append(event: CollaborationEvent) {
    if (this.events.some(existing => existing.id === event.id)) return false;
    this.events.push(structuredClone(event));
    this.events.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id));
    return true;
  }

  addComment(comment: CollaborationComment) {
    if (this.comments.has(comment.id)) throw new Error(`Comment ${comment.id} already exists.`);
    if (!comment.body.trim()) throw new Error('Comment body is required.');
    this.comments.set(comment.id, structuredClone(comment));
  }

  resolveComment(commentId:string, resolvedBy:string, resolvedAt:string) {
    const comment=this.comments.get(commentId); if(!comment)throw new Error(`Comment ${commentId} was not found.`);
    this.comments.set(commentId,{...comment,resolvedBy,resolvedAt});
  }

  listEvents(projectId:string){return this.events.filter(event=>event.projectId===projectId).map(event=>structuredClone(event));}
  listComments(projectId:string, includeResolved=true){return [...this.comments.values()].filter(comment=>comment.projectId===projectId&&(includeResolved||!comment.resolvedAt)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(comment=>structuredClone(comment));}
}
