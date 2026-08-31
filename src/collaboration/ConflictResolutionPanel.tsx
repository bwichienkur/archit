import { useEffect,useMemo,useState } from 'react';
import { GitMerge } from 'lucide-react';
import { currentAuthSession } from '../auth/oidc';
import type { BuildingModelV2 } from '../domain/building';
import { useBuildingEditorStore } from '../editor/buildingStore';
import { HttpProjectGateway,type ProjectRevision } from '../projects/gateway';
import { isBuildingModelV2 } from '../projects/modelGuard';
import { useProjectPersistenceStore } from '../projects/store';
import { analyzeRevisionConflicts } from './conflicts';
import { conflictKey,mergeBuildingModels,type ConflictChoice,type ConflictDecisions } from './merge';
import './conflictResolution.css';

const gateway=new HttpProjectGateway();
type BimRevision=ProjectRevision<BuildingModelV2>;

export function ConflictResolutionPanel({projectId}:{projectId:string}){
  const currentHead=useProjectPersistenceStore(state=>state.revisionId);
  const [revisions,setRevisions]=useState<BimRevision[]>([]);
  const [baseId,setBaseId]=useState('');
  const [leftId,setLeftId]=useState('');
  const [rightId,setRightId]=useState('');
  const [decisions,setDecisions]=useState<ConflictDecisions>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let cancelled=false;
    void gateway.listRevisions(projectId).then(items=>{
      if(cancelled)return;
      const bim=items.filter((item):item is BimRevision=>isBuildingModelV2(item.model));
      setRevisions(bim);
      setRightId(current=>bim.some(item=>item.id===current)?current:(bim[0]?.id??''));
      setLeftId(current=>bim.some(item=>item.id===current)?current:(bim[1]?.id??bim[0]?.id??''));
      setBaseId(current=>bim.some(item=>item.id===current)?current:(bim[2]?.id??bim[1]?.id??bim[0]?.id??''));
    }).catch(reason=>setError(message(reason)));
    return()=>{cancelled=true;};
  },[projectId,currentHead]);

  useEffect(()=>setDecisions({}),[baseId,leftId,rightId]);
  const base=useMemo(()=>revisions.find(item=>item.id===baseId)??null,[revisions,baseId]);
  const left=useMemo(()=>revisions.find(item=>item.id===leftId)??null,[revisions,leftId]);
  const right=useMemo(()=>revisions.find(item=>item.id===rightId)??null,[revisions,rightId]);
  const analysis=useMemo(()=>base&&left&&right?analyzeRevisionConflicts(base.model,left.model,right.model):null,[base,left,right]);
  const merged=useMemo(()=>base&&left&&right?mergeBuildingModels(base.model,left.model,right.model,decisions):null,[base,left,right,decisions]);

  function choose(key:string,choice:ConflictChoice){setDecisions(current=>({...current,[key]:choice}));}

  async function saveResolution(){
    if(!merged||merged.unresolved.length||!currentHead)return;
    setBusy(true);setError(null);
    try{
      const session=await currentAuthSession();
      const revision=await gateway.createRevision<BuildingModelV2>(projectId,{
        parentRevisionId:currentHead,
        kind:'user-edit',
        createdBy:session.userId??'local-user',
        model:{...merged.model,projectId},
        note:`Resolve BIM conflicts between ${short(leftId)} and ${short(rightId)} from base ${short(baseId)}`,
      });
      useProjectPersistenceStore.setState({revisionId:revision.id,savedAt:revision.createdAt,error:null});
      useBuildingEditorStore.getState().clear();
      useBuildingEditorStore.setState({model:revision.model,selection:null,error:null,canUndo:false,canRedo:false});
    }catch(reason){setError(message(reason));}
    finally{setBusy(false);}
  }

  if(revisions.length<3)return <section className="conflict-resolution-panel"><header><small>THREE-WAY MERGE</small><strong>Conflict resolution</strong></header><p>At least three BIM snapshots are required to compare a base revision with two edited revisions.</p></section>;

  return <section className="conflict-resolution-panel">
    <header><div><small>THREE-WAY MERGE</small><strong>Conflict resolution</strong></div>{analysis&&<span>{analysis.conflicts.length} conflicts</span>}</header>
    {error&&<p className="platform-inline-error">{error}</p>}
    <div className="conflict-revision-selectors">
      <RevisionSelect label="Base" value={baseId} revisions={revisions} onChange={setBaseId}/>
      <RevisionSelect label="Left" value={leftId} revisions={revisions} onChange={setLeftId}/>
      <RevisionSelect label="Right" value={rightId} revisions={revisions} onChange={setRightId}/>
    </div>
    {analysis&&<div className="conflict-summary"><span>{analysis.compatible} compatible</span><span>{analysis.leftOnly} left-only</span><span>{analysis.rightOnly} right-only</span><span>{analysis.conflicts.length} conflicts</span></div>}
    <div className="conflict-list">{analysis?.conflicts.map(conflict=>{
      const key=conflictKey(conflict),choice=decisions[key];
      return <article key={key}>
        <div><strong>{conflict.kind} · {short(conflict.id)}</strong><small>{conflict.path} · {conflict.reason}</small></div>
        <div className="conflict-values"><Value label="Base" value={conflict.base}/><Value label="Left" value={conflict.left}/><Value label="Right" value={conflict.right}/></div>
        <div className="conflict-choices">{(['base','left','right'] as ConflictChoice[]).map(option=><button key={option} className={choice===option?'active':''} onClick={()=>choose(key,option)}>{option}</button>)}</div>
      </article>;
    })}</div>
    {analysis&&analysis.conflicts.length===0&&<p>No conflicting properties. Independent changes can be merged automatically.</p>}
    <button className="conflict-save" disabled={busy||!merged||merged.unresolved.length>0||!currentHead} onClick={()=>void saveResolution()}><GitMerge size={13}/>{busy?'Saving merge…':merged?.unresolved.length?`Resolve ${merged.unresolved.length} remaining`:'Save resolved revision'}</button>
  </section>;
}

function RevisionSelect({label,value,revisions,onChange}:{label:string;value:string;revisions:BimRevision[];onChange(value:string):void}){return <label>{label}<select value={value} onChange={event=>onChange(event.target.value)}>{revisions.map(item=><option value={item.id} key={item.id}>{short(item.id)} · {item.kind}</option>)}</select></label>;}
function Value({label,value}:{label:string;value:unknown}){return <div><small>{label}</small><code>{preview(value)}</code></div>;}
function preview(value:unknown){if(value===undefined)return'∅';const text=typeof value==='string'?value:JSON.stringify(value);return text.length>70?`${text.slice(0,67)}…`:text;}
function short(value:string){return value.length>10?`${value.slice(0,8)}…`:value;}
function message(value:unknown){return value instanceof Error?value.message:'Conflict resolution failed.';}
