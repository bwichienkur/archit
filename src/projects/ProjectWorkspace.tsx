import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { currentAuthSession } from '../auth/oidc';
import { HttpCadImportGateway } from '../cad/importer';
import { useCadStore } from '../cad/store';
import { useBuildingEditorStore } from '../editor/buildingStore';
import { RevisionHistoryPanel } from '../revisions/RevisionHistoryPanel';
import { useSemanticStore } from '../semantic/store';
import { setActiveProject } from './activeProject';
import { HttpProjectGateway, type ProjectRecord, type ProjectRevision } from './gateway';
import { isBuildingModelV2 } from './modelGuard';
import { useProjectPersistenceStore } from './store';

const gateway=new HttpProjectGateway();
const cadGateway=new HttpCadImportGateway();

type ProjectSummary={project:ProjectRecord;revisions:ProjectRevision[];latestBim:ProjectRevision|null;latestImport:ProjectRevision|null};

export function ProjectWorkspace(){
  const activeProjectId=useProjectPersistenceStore(state=>state.projectId);
  const [items,setItems]=useState<ProjectSummary[]>([]);
  const [loading,setLoading]=useState(false);
  const [opening,setOpening]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function refresh(){
    setLoading(true);setError(null);
    try{
      const session=await currentAuthSession();
      const projects=await gateway.listProjects(session.tenantId);
      const summaries=await Promise.all(projects.map(async project=>{
        const revisions=await gateway.listRevisions(project.id);
        const latestBim=revisions.find(revision=>isBuildingModelV2(revision.model))??null;
        const latestImport=revisions.find(revision=>revision.kind==='import'&&Boolean(revision.sourceImportId))??null;
        return{project,revisions,latestBim,latestImport};
      }));
      setItems(summaries);
    }catch(reason){setError(message(reason));}
    finally{setLoading(false);}
  }

  useEffect(()=>{void refresh();},[]);

  async function open(summary:ProjectSummary){
    setOpening(summary.project.id);setError(null);
    try{
      const importJob=summary.latestImport?.sourceImportId?await cadGateway.getJob(summary.latestImport.sourceImportId):null;
      setActiveProject(summary.project);
      const revisionHead=summary.revisions[0]?.id??null;
      useProjectPersistenceStore.setState({projectId:summary.project.id,revisionId:revisionHead,error:null});

      useCadStore.getState().clearCad();
      useSemanticStore.getState().clear();
      if(importJob?.status==='completed'&&importJob.document){
        useCadStore.getState().setImportedCad(importJob.document,importJob.validation??null);
        useSemanticStore.getState().runExtraction(importJob.document);
      }

      const editor=useBuildingEditorStore.getState();
      editor.clear();
      if(summary.latestBim&&isBuildingModelV2(summary.latestBim.model)){
        useBuildingEditorStore.setState({model:summary.latestBim.model,selection:null,error:null,canUndo:false,canRedo:false});
      }
    }catch(reason){setError(message(reason));}
    finally{setOpening(null);}
  }

  const totals=useMemo(()=>({projects:items.length,revisions:items.reduce((sum,item)=>sum+item.revisions.length,0)}),[items]);

  return <section className="project-workspace">
    <header><div><small>PROJECT LIBRARY</small><strong>Projects</strong></div><button onClick={()=>void refresh()} disabled={loading} title="Refresh projects"><RefreshCw size={14}/></button></header>
    <div className="project-workspace-summary"><span>{totals.projects} projects</span><span>{totals.revisions} revisions</span></div>
    {error&&<p className="platform-inline-error">{error}</p>}
    {loading&&items.length===0&&<div className="platform-empty-state">Loading projects…</div>}
    {!loading&&items.length===0&&<div className="platform-empty-state">No projects yet. Import a DWG or save the current model to create one.</div>}
    <div className="project-list">{items.map(summary=>{
      const latest=summary.revisions[0];const isActive=summary.project.id===activeProjectId;
      return <article key={summary.project.id} className={isActive?'active':''}>
        <div className="project-list-title"><FolderOpen size={16}/><div><strong>{summary.project.name}</strong><small>{summary.project.id}</small></div></div>
        <dl><div><dt>Updated</dt><dd>{formatDate(summary.project.updatedAt)}</dd></div><div><dt>Revisions</dt><dd>{summary.revisions.length}</dd></div><div><dt>Latest</dt><dd>{latest?.kind??'empty'}</dd></div></dl>
        <p>{summary.latestBim?'Editable BIM snapshot available.':summary.latestImport?'Normalized CAD import available; semantic/BIM model has not been saved yet.':summary.revisions.length?'Revision history exists, but no resumable BIM/CAD snapshot was found.':'Empty project.'}</p>
        <button disabled={opening===summary.project.id} onClick={()=>void open(summary)}>{opening===summary.project.id?'Opening…':isActive?'Reload project':'Open project'}</button>
      </article>;
    })}</div>
    {activeProjectId&&<RevisionHistoryPanel projectId={activeProjectId}/>} 
  </section>;
}

function formatDate(value:string){const date=new Date(value);return Number.isNaN(date.valueOf())?value:date.toLocaleString();}
function message(value:unknown){return value instanceof Error?value.message:'Project request failed.';}
