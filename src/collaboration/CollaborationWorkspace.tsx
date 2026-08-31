import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useBuildingEditorStore } from '../editor/buildingStore';
import { useProjectPersistenceStore } from '../projects/store';
import { CollaborationPanel } from './CollaborationPanel';
import { ConflictResolutionPanel } from './ConflictResolutionPanel';
import type { CollaborationComment, CollaborationEvent, ObjectReference } from './events';
import { HttpCollaborationGateway } from './gateway';
import type { LiveEditLease, LivePresence } from './liveClient';
import { connectProjectCollaboration, type LiveCollaborationSession } from './session';

const gateway=new HttpCollaborationGateway();

export function CollaborationWorkspace(){
  const projectId=useProjectPersistenceStore(state=>state.projectId);
  const selection=useBuildingEditorStore(state=>state.selection);
  const select=useBuildingEditorStore(state=>state.select);
  const [events,setEvents]=useState<CollaborationEvent[]>([]);
  const [comments,setComments]=useState<CollaborationComment[]>([]);
  const [presence,setPresence]=useState<LivePresence[]>([]);
  const [leases,setLeases]=useState<LiveEditLease[]>([]);
  const [live,setLive]=useState<LiveCollaborationSession|null>(null);
  const [body,setBody]=useState('');
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!projectId){setEvents([]);setComments([]);setPresence([]);setLeases([]);setLive(null);return;}
    let cancelled=false;
    let connection:LiveCollaborationSession|null=null;
    setError(null);
    void Promise.all([gateway.listEvents(projectId),gateway.listComments(projectId,true)])
      .then(([nextEvents,nextComments])=>{if(!cancelled){setEvents(nextEvents);setComments(nextComments);}})
      .catch(reason=>{if(!cancelled)setError(message(reason));});
    void connectProjectCollaboration(projectId,{
      onPresence:items=>{if(!cancelled)setPresence(items);},
      onLeases:items=>{if(!cancelled)setLeases(items);},
      onProjectEvent:event=>{if(!cancelled)setEvents(items=>upsertEvent(items,event));},
      onCommentCreated:comment=>{if(!cancelled)setComments(items=>upsertComment(items,comment));},
      onCommentResolved:comment=>{if(!cancelled)setComments(items=>upsertComment(items,comment));},
      onReconnecting:()=>{if(!cancelled)setError('Live collaboration is reconnecting…');},
      onReconnected:()=>{if(!cancelled)setError(null);},
      onClosed:reason=>{if(!cancelled)setError(reason?.message??'Live collaboration disconnected.');},
    }).then(session=>{connection=session;if(!cancelled)setLive(session);else void session.client.stop();}).catch(reason=>{if(!cancelled)setError(message(reason));});
    return()=>{cancelled=true;if(connection)void connection.client.stop();};
  },[projectId]);

  useEffect(()=>{
    if(!live)return;
    void live.client.selectObject(selection?.kind??null,selection?.id??null).catch(reason=>setError(message(reason)));
  },[live,selection]);

  const selectedTarget=useMemo<ObjectReference|null>(()=>selection?{kind:selection.kind,id:selection.id}:null,[selection]);
  const activeLease=selectedTarget?leases.find(lease=>lease.objectKind===selectedTarget.kind&&lease.objectId===selectedTarget.id):undefined;

  async function addComment(){
    if(!projectId||!live||!selectedTarget||!body.trim())return;
    setBusy(true);setError(null);
    try{
      const created=await gateway.addComment(projectId,{authorId:live.userId,authorRole:live.role,target:selectedTarget,body:body.trim()});
      setComments(items=>upsertComment(items,created));setBody('');
    }catch(reason){setError(message(reason));}
    finally{setBusy(false);}
  }

  async function resolveComment(commentId:string){
    if(!projectId||!live)return;
    try{const resolved=await gateway.resolveComment(projectId,commentId,live.userId);setComments(items=>upsertComment(items,resolved));}
    catch(reason){setError(message(reason));}
  }

  function selectTarget(kind:string,id:string){
    if(kind==='wall'||kind==='room'||kind==='opening')select({kind,id});
  }

  if(!projectId)return <div className="platform-empty-state">Save the model or import a DWG to create an active project before opening collaboration.</div>;

  return <div className="collaboration-workspace">
    <div className="collaboration-live-summary"><span><Users size={15}/> {presence.length} online</span><span>{leases.length} active edit lease{leases.length===1?'':'s'}</span><span>{live?'Live':'Connecting…'}</span></div>
    {error&&<p className="platform-inline-error">{error}</p>}
    <div className="collaboration-presence">{presence.map(item=><span key={item.connectionId} title={item.selectedId?`Editing/viewing ${item.selectedKind} ${item.selectedId}`:item.role}><strong>{item.displayName}</strong><small>{item.role}</small></span>)}</div>
    <section className="collaboration-compose">
      <div><strong>Comment on selection</strong><small>{selectedTarget?`${selectedTarget.kind} ${selectedTarget.id}`:'Select a wall, room, or opening first.'}</small>{activeLease&&<small>Currently leased by {activeLease.userId}</small>}</div>
      <textarea value={body} onChange={event=>setBody(event.target.value)} disabled={!selectedTarget||busy} placeholder="Add a project comment…" rows={3}/>
      <button disabled={!selectedTarget||!body.trim()||busy||!live} onClick={()=>void addComment()}>{busy?'Posting…':'Post comment'}</button>
    </section>
    <CollaborationPanel events={events} comments={comments} onResolveComment={id=>void resolveComment(id)} onSelectTarget={selectTarget}/>
    <ConflictResolutionPanel projectId={projectId}/>
  </div>;
}

function upsertEvent(items:CollaborationEvent[],value:CollaborationEvent){return [...items.filter(item=>item.id!==value.id),value].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));}
function upsertComment(items:CollaborationComment[],value:CollaborationComment){return [...items.filter(item=>item.id!==value.id),value].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
function message(value:unknown){return value instanceof Error?value.message:'Collaboration request failed.';}
