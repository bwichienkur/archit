import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import type { CollaborationComment, CollaborationEvent, CollaborationEventType, CollaborationRole, ObjectReference } from './events';

export type LivePresence={projectId:string;connectionId:string;userId:string;displayName:string;role:string;selectedKind:string|null;selectedId:string|null;lastSeenAt:string};
export type LiveEditLease={projectId:string;objectKind:string;objectId:string;userId:string;connectionId:string;acquiredAt:string;expiresAt:string};
export type CollaborationLiveHandlers={onPresence?(items:LivePresence[]):void;onLeases?(items:LiveEditLease[]):void;onProjectEvent?(event:CollaborationEvent):void;onCommentCreated?(comment:CollaborationComment):void;onCommentResolved?(comment:CollaborationComment):void;onReconnecting?(error?:Error):void;onReconnected?():void;onClosed?(error?:Error):void};
export type LiveAccessTokenFactory=()=>string|Promise<string>;

type LiveEventDto={id:string;projectId:string;revisionId:string|null;actorId:string;actorRole:CollaborationRole;type:CollaborationEventType;targetKind:string|null;targetId:string|null;createdAt:string;payload:Record<string,string|number|boolean|null>};
type LiveCommentDto={id:string;projectId:string;revisionId:string|null;authorId:string;authorRole:CollaborationRole;targetKind:string;targetId:string;body:string;createdAt:string;resolvedAt:string|null;resolvedBy:string|null};

export class ProjectLiveClient{
  private readonly connection:HubConnection;
  private joined:{projectId:string;userId:string;displayName:string;role:CollaborationRole}|null=null;
  constructor(baseUrl=import.meta.env.VITE_API_URL??'http://localhost:5080',handlers:CollaborationLiveHandlers={},accessTokenFactory?:LiveAccessTokenFactory){
    const builder=new HubConnectionBuilder();
    const url=`${baseUrl.replace(/\/$/,'')}/hubs/projects`;
    if(accessTokenFactory)builder.withUrl(url,{accessTokenFactory});
    else builder.withUrl(url);
    this.connection=builder.withAutomaticReconnect([0,1000,3000,10000]).configureLogging(LogLevel.Warning).build();
    this.connection.on('presenceChanged',(items:LivePresence[])=>handlers.onPresence?.(items));
    this.connection.on('editLeasesChanged',(items:LiveEditLease[])=>handlers.onLeases?.(items));
    this.connection.on('projectEvent',(event:LiveEventDto)=>handlers.onProjectEvent?.(toEvent(event)));
    this.connection.on('commentCreated',(comment:LiveCommentDto)=>handlers.onCommentCreated?.(toComment(comment)));
    this.connection.on('commentResolved',(comment:LiveCommentDto)=>handlers.onCommentResolved?.(toComment(comment)));
    this.connection.onreconnecting(error=>handlers.onReconnecting?.(error??undefined));
    this.connection.onreconnected(async()=>{handlers.onReconnected?.();if(this.joined)await this.invokeJoin(this.joined);});
    this.connection.onclose(error=>handlers.onClosed?.(error??undefined));
  }
  get state(){return this.connection.state;}
  async start(){if(this.connection.state===HubConnectionState.Disconnected)await this.connection.start();}
  async stop(){this.joined=null;await this.connection.stop();}
  async joinProject(projectId:string,userId:string,displayName:string,role:CollaborationRole){await this.start();this.joined={projectId,userId,displayName,role};await this.invokeJoin(this.joined);}
  async leaveProject(){if(!this.joined)return;const projectId=this.joined.projectId;this.joined=null;if(this.connection.state===HubConnectionState.Connected)await this.connection.invoke('LeaveProject',projectId);}
  async selectObject(kind:string|null,id:string|null){const joined=this.requireJoined();await this.connection.invoke('SelectObject',joined.projectId,kind,id);}
  async acquireEditLease(objectKind:string,objectId:string,ttlSeconds=30):Promise<LiveEditLease>{const joined=this.requireJoined();return this.connection.invoke<LiveEditLease>('AcquireEditLease',joined.projectId,objectKind,objectId,joined.userId,ttlSeconds);}
  async releaseEditLease(objectKind:string,objectId:string){const joined=this.requireJoined();await this.connection.invoke('ReleaseEditLease',joined.projectId,objectKind,objectId);}
  private requireJoined(){if(!this.joined)throw new Error('Join a project before using live collaboration.');if(this.connection.state!==HubConnectionState.Connected)throw new Error('Live collaboration connection is not connected.');return this.joined;}
  private invokeJoin(joined:{projectId:string;userId:string;displayName:string;role:CollaborationRole}){return this.connection.invoke('JoinProject',joined.projectId,joined.userId,joined.displayName,joined.role);}
}

function toEvent(dto:LiveEventDto):CollaborationEvent{return{id:dto.id,projectId:dto.projectId,revisionId:dto.revisionId??undefined,actorId:dto.actorId,actorRole:dto.actorRole,type:dto.type,target:dto.targetKind&&dto.targetId?{kind:dto.targetKind as ObjectReference['kind'],id:dto.targetId}:undefined,timestamp:dto.createdAt,payload:dto.payload};}
function toComment(dto:LiveCommentDto):CollaborationComment{return{id:dto.id,projectId:dto.projectId,revisionId:dto.revisionId??undefined,authorId:dto.authorId,authorRole:dto.authorRole,target:{kind:dto.targetKind as ObjectReference['kind'],id:dto.targetId},body:dto.body,createdAt:dto.createdAt,resolvedAt:dto.resolvedAt??undefined,resolvedBy:dto.resolvedBy??undefined};}
