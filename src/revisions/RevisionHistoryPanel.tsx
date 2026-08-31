import { useEffect,useMemo,useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { currentAuthSession } from '../auth/oidc';
import type { BuildingModelV2 } from '../domain/building';
import { useBuildingEditorStore } from '../editor/buildingStore';
import { HttpProjectGateway,type ProjectRevision } from '../projects/gateway';
import { isBuildingModelV2 } from '../projects/modelGuard';
import { useProjectPersistenceStore } from '../projects/store';
import { RevisionDiffPanel } from './RevisionDiffPanel';

const gateway=new HttpProjectGateway();

type BimRevision=ProjectRevision<BuildingModelV2>;

export function RevisionHistoryPanel({projectId}:{projectId:string}){
  const currentHead=useProjectPersistenceStore(state=>state.revisionId);
  const [revisions,setRevisions]=useState<BimRevision[]>([]);
  const [beforeId,setBeforeId]=useState('');
  const [afterId,setAfterId]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function refresh(){
    setError(null);
    try{
      const all=await gateway.listRevisions(projectId);
      const bim=all.filter((revision):revision is BimRevision=>isBuildingModelV2(revision.model));
      setRevisions(bim);
      setAfterId(current=>bim.some(item=>item.id===current)?current:(bim[0]?.id??''));
      setBeforeId(current=>bim.some(item=>item.id===current)?current:(bim[1]?.id??bim[0]?.id??''));
    }catch(reason){setError(message(reason));}
  }

  useEffect(()=>{void refresh();},[projectId,currentHead]);

  const before=useMemo(()=>revisions.find(revision=>revision.id===beforeId)??null,[revisions,beforeId]);
  const after=useMemo(()=>revisions.find(revision=>revision.id===afterId)??null,[revisions,afterId]);

  async function restore(revision:BimRevision){
    setBusy(true);setError(null);
    try{
      const session=await currentAuthSession();
      const restored=await gateway.createRevision<BuildingModelV2>(projectId,{
        parentRevisionId:currentHead,
        kind:'user-edit',
        createdBy:session.userId??'local-user',
        model:{...revision.model,projectId},
        note:`Restore BIM snapshot from revision ${revision.id}`,
      });
      useProjectPersistenceStore.setState({revisionId:restored.id,savedAt:restored.createdAt,error:null});
      useBuildingEditorStore.getState().clear();
      useBuildingEditorStore.setState({model:restored.model,selection:null,error:null,canUndo:false,canRedo:false});
      await refresh();
    }catch(reason){setError(message(reason));}
    finally{setBusy(false);}
  }

  return <section className="revision-history-panel">
    <header><div><small>REVISION HISTORY</small><strong>Compare & restore</strong></div><span>{revisions.length} BIM snapshots</span></header>
    {error&&<p className="platform-inline-error">{error}</p>}
    {revisions.length===0?<p className="revision-history-empty">No saved BIM snapshots exist for this project yet.</p>:<>
      <div className="revision-compare-selectors">
        <label>Before<select value={beforeId} onChange={event=>setBeforeId(event.target.value)}>{revisions.map(revision=><option key={revision.id} value={revision.id}>{label(revision,currentHead)}</option>)}</select></label>
        <label>After<select value={afterId} onChange={event=>setAfterId(event.target.value)}>{revisions.map(revision=><option key={revision.id} value={revision.id}>{label(revision,currentHead)}</option>)}</select></label>
      </div>
      {before&&after&&<RevisionDiffPanel before={before.model} after={after.model} beforeLabel={short(before.id)} afterLabel={short(after.id)} onSelectObject={(kind,id)=>selectObject(kind,id)}/>} 
      {after&&<div className="revision-restore-row"><div><strong>{short(after.id)}</strong><small>{formatDate(after.createdAt)} · {after.kind}</small></div><button disabled={busy||after.id===currentHead} onClick={()=>void restore(after)}><RotateCcw size={12}/>{busy?'Restoring…':after.id===currentHead?'Current head':'Restore as new revision'}</button></div>}
    </>}
  </section>;
}

function selectObject(kind:string,id:string){
  if(kind==='wall'||kind==='room'||kind==='opening')useBuildingEditorStore.getState().select({kind,id});
}
function label(revision:BimRevision,currentHead:string|null){return`${short(revision.id)} · ${revision.kind}${revision.id===currentHead?' · HEAD':''}`;}
function short(value:string){return value.length>10?`${value.slice(0,8)}…`:value;}
function formatDate(value:string){const date=new Date(value);return Number.isNaN(date.valueOf())?value:date.toLocaleString();}
function message(value:unknown){return value instanceof Error?value.message:'Revision request failed.';}
