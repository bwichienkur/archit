import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { Box, ClipboardList, FolderOpen, Hammer, MessageSquare, X } from 'lucide-react';
import { useBuildingEditorStore } from '../editor/buildingStore';
import { BuildingModelScene3D } from '../editor/BuildingModelScene3D';
import { BuilderConfiguratorPanel } from '../builder/BuilderConfiguratorPanel';
import { CollaborationWorkspace } from '../collaboration/CollaborationWorkspace';
import { ScheduleExportPanel } from '../export/ScheduleExportPanel';
import { ServerExportPanel } from '../export/ServerExportPanel';
import { ProjectWorkspace } from '../projects/ProjectWorkspace';
import { usePlatformWorkspaceStore, type PlatformPanel } from './store';

export function PlatformDock(){
  const {model,selection,select}=useBuildingEditorStore();
  const {panel,setPanel,session,productsById,setSelectionStatus,removeTargetSelection}=usePlatformWorkspaceStore();
  const selectedId=selection?.id??null;
  const projectName=model?.projectName??'No BIM model';
  const tabs: Array<{id:Exclude<PlatformPanel,'closed'>;label:string;icon:typeof Box}>=[
    {id:'projects',label:'Projects',icon:FolderOpen},
    {id:'3d',label:'Advanced 3D',icon:Box},
    {id:'builder',label:'Builder',icon:Hammer},
    {id:'schedules',label:'Schedules',icon:ClipboardList},
    {id:'collaboration',label:'Collaboration',icon:MessageSquare},
  ];
  const download=useMemo(()=>downloadTextFile,[]);

  return <div className={`platform-dock ${panel==='closed'?'closed':'open'}`}>
    <nav className="platform-dock-tabs" aria-label="Archit workspaces">{tabs.map(tab=>{const Icon=tab.icon;return <button key={tab.id} className={panel===tab.id?'active':''} onClick={()=>setPanel(panel===tab.id?'closed':tab.id)} title={tab.label}><Icon size={17}/><span>{tab.label}</span></button>})}</nav>
    {panel!=='closed'&&<section className="platform-dock-panel"><header><div><small>ARCHIT PLATFORM</small><strong>{projectName}</strong></div><button onClick={()=>setPanel('closed')} title="Close platform panel"><X size={17}/></button></header>
      <div className="platform-dock-content">
        {panel==='projects'&&<ProjectWorkspace/>}
        {panel==='3d'&&<>{model?<div className="platform-3d"><Canvas camera={{position:[9,8,10],fov:45}} shadows><ambientLight intensity={1.2}/><directionalLight castShadow position={[8,12,7]} intensity={2}/><Grid args={[30,30]} cellSize={.5} sectionSize={2}/><BuildingModelScene3D model={model} selectedId={selectedId} showFloors showCeilings={false} onSelect={(kind,id)=>{if(kind==='wall'||kind==='room')select({kind,id});}}/><OrbitControls makeDefault/></Canvas></div>:<EmptyState text="Accept semantic candidates to create a BuildingModelV2 before opening the advanced 3D workspace."/>}</>}
        {panel==='builder'&&<BuilderConfiguratorPanel session={session} productsById={productsById} onStatusChange={setSelectionStatus} onRemove={removeTargetSelection}/>} 
        {panel==='schedules'&&<>{model?<><ScheduleExportPanel model={model} onDownload={download}/><ServerExportPanel/></>:<EmptyState text="A BuildingModelV2 is required before construction schedules can be generated."/>}</>}
        {panel==='collaboration'&&<CollaborationWorkspace/>}
      </div>
    </section>}
  </div>;
}

function EmptyState({text}:{text:string}){return <div className="platform-empty-state">{text}</div>;}

function downloadTextFile(fileName:string,content:string,mediaType:string){const blob=new Blob([content],{type:mediaType});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
