import { useMemo, useRef, useState } from 'react';
import { Box, BoxSelect, ChevronDown, CircleDot, FileUp, Grid3X3, Layers3, MousePointer2, Redo2, Ruler, Save, Settings2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import type { BuildingModel } from './domain/model';
import { useEditorStore } from './editor/store';
import { HttpCadImportGateway, type CadImportJob } from './cad/importer';

type ViewMode = '2d' | '3d' | 'split';
const cadGateway = new HttpCadImportGateway();

function Plan({ model, selected, onSelect }: { model: BuildingModel; selected: string | null; onSelect: (id: string) => void }) {
  return <div className="plan-wrap"><svg className="plan" viewBox="0 0 700 500">
    <defs><pattern id="minorGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth=".5"/></pattern><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#minorGrid)"/><path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity=".13" strokeWidth=".8"/></pattern></defs>
    <rect width="700" height="500" fill="url(#grid)"/>
    {model.walls.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} onClick={() => onSelect(w.id)} className={selected === w.id ? 'wall selected' : `wall ${w.validationState}`} strokeWidth={w.thickness} />)}
    <text x="190" y="235" className="room-label">LIVING ROOM<tspan x="207" dy="17">412 SF</tspan></text>
    <text x="455" y="170" className="room-label">KITCHEN<tspan x="464" dy="17">238 SF</tspan></text>
    <text x="445" y="345" className="room-label">PRIMARY BEDROOM<tspan x="485" dy="17">296 SF</tspan></text>
  </svg><div className="scale">1/4&quot; = 1&apos;-0&quot; <span>•</span> 1:48</div></div>
}

function Model3D({ model, selected, onSelect }: { model: BuildingModel; selected: string | null; onSelect: (id: string) => void }) {
  return <Canvas camera={{ position: [8, 8, 9], fov: 45 }}><ambientLight intensity={1.5}/><directionalLight position={[5,10,5]} intensity={2}/><Grid args={[20,20]} cellSize={.5} sectionSize={2}/>{model.walls.map(w => { const dx=(w.end.x-w.start.x)/60, dz=(w.end.y-w.start.y)/60, len=Math.hypot(dx,dz), mx=(w.start.x+w.end.x-700)/120, mz=(w.start.y+w.end.y-500)/120, angle=-Math.atan2(dz,dx); return <mesh key={w.id} position={[mx,w.height/6,mz]} rotation={[0,angle,0]} onClick={(e)=>{e.stopPropagation();onSelect(w.id)}}><boxGeometry args={[len,w.height/3,w.thickness/30]}/><meshStandardMaterial color={selected===w.id ? '#d9a441' : w.validationState==='inferred' ? '#8290a0' : '#d7dadd'}/></mesh>})}<OrbitControls makeDefault/></Canvas>
}

function App() {
  const [view, setView] = useState<ViewMode>('2d');
  const [importJob, setImportJob] = useState<CadImportJob | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { model, selectedId, setSelectedId, cadVisible, modelVisible, setCadVisible, setModelVisible, confirmWall, updateWall, undo, redo } = useEditorStore();
  const wall = useMemo(() => model.walls.find(x => x.id === selectedId) ?? null, [model, selectedId]);

  async function importDwg(file?: File) {
    if (!file) return;
    setImportBusy(true);
    try { setImportJob(await cadGateway.upload(file)); }
    catch (error) { setImportJob({ id: 'local-error', fileName: file.name, status: 'failed', progress: 0, error: error instanceof Error ? error.message : 'Import failed' }); }
    finally { setImportBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  return <div className="app">
    <input ref={fileInput} type="file" accept=".dwg" hidden onChange={e=>void importDwg(e.target.files?.[0])}/>
    <header><div className="brand"><div className="brand-mark"><Box size={18}/></div><strong>ARCHIT</strong><span className="project">{model.projectName}<ChevronDown size={14}/></span></div><div className="header-actions"><button onClick={undo} title="Undo"><Undo2 size={16}/></button><button onClick={redo} title="Redo"><Redo2 size={16}/></button><div className="view-switch"><button className={view==='2d'?'active':''} onClick={()=>setView('2d')}>2D</button><button className={view==='3d'?'active':''} onClick={()=>setView('3d')}>3D</button><button className={view==='split'?'active':''} onClick={()=>setView('split')}>Split</button></div><button><Save size={16}/> Save</button><button className="primary" disabled={importBusy} onClick={()=>fileInput.current?.click()}><FileUp size={16}/> {importBusy ? 'Importing…' : 'Import DWG'}</button></div></header>
    <div className="workspace"><aside className="left"><section><h3>PROJECT</h3><div className="tree active-row"><ChevronDown size={14}/><Layers3 size={15}/> Ground Floor</div><div className="tree indent"><Box size={14}/> Rooms <span>{model.rooms.length}</span></div><div className="tree indent"><BoxSelect size={14}/> Walls <span>{model.walls.length}</span></div></section><section><h3>LAYERS</h3><label><input type="checkbox" checked={cadVisible} onChange={e=>setCadVisible(e.target.checked)}/> <span className="dot cad"></span>Original CAD <small>immutable</small></label><label><input type="checkbox" checked={modelVisible} onChange={e=>setModelVisible(e.target.checked)}/> <span className="dot model"></span>Building Model</label><label><input type="checkbox" defaultChecked/> <span className="dot annotation"></span>Annotations</label></section><section><h3>IMPORT STATUS</h3>{importJob ? <><div className={`status ${importJob.status==='completed'?'good':''}`}><CircleDot size={13}/> {importJob.status}: {importJob.fileName}</div>{importJob.error && <p className="import-error">{importJob.error}</p>}<div className="metric"><span>Progress</span><b>{importJob.progress}%</b></div><div className="metric"><span>CAD entities</span><b>{importJob.document?.entities.length ?? '—'}</b></div></> : <><div className="status good"><CircleDot size={13}/> Demo model ready</div><div className="metric"><span>CAD entities</span><b>—</b></div></>}<div className="metric"><span>Wall candidates</span><b>{model.walls.length}</b></div><div className="metric"><span>Needs review</span><b>{model.walls.filter(w=>w.validationState==='inferred').length}</b></div><button className="full">Open validation report</button></section></aside>
      <main><div className="toolrail"><button className="selected"><MousePointer2/></button><button><Ruler/></button><button><BoxSelect/></button><button><Grid3X3/></button><hr/><button><ZoomIn/></button><button><ZoomOut/></button></div><div className={`viewport ${view}`}>{view!=='3d' && <div className="pane">{cadVisible && <div className="cad-badge">CAD REFERENCE</div>}{modelVisible && <Plan model={model} selected={selectedId} onSelect={setSelectedId}/>}</div>}{view!=='2d' && <div className="pane three"><div className="cad-badge">BUILDING MODEL</div><Model3D model={model} selected={selectedId} onSelect={setSelectedId}/></div>}</div></main>
      <aside className="right"><div className="inspector-title"><div><small>SELECTED OBJECT</small><strong>{wall?.name ?? 'Nothing selected'}</strong></div><Settings2 size={17}/></div>{wall && <><div className={`validation ${wall.validationState}`}>{wall.validationState==='inferred'?'Needs confirmation':'Confirmed building object'}</div><section><h3>GEOMETRY</h3><NumericField label="Thickness (in)" value={wall.thickness} onChange={value=>updateWall(wall.id,{thickness:value})}/><NumericField label="Height (ft)" value={wall.height} onChange={value=>updateWall(wall.id,{height:value})}/><Field label="Length" value={`${(Math.hypot(wall.end.x-wall.start.x, wall.end.y-wall.start.y)/30).toFixed(2)} ft`}/><Field label="Base elevation" value="0 ft"/></section><section><h3>CLASSIFICATION</h3><Field label="Type" value={wall.thickness > 6 ? 'Exterior Wall' : 'Interior Partition'}/><Field label="State" value={wall.validationState}/></section><section><h3>CAD LINEAGE</h3><p className="muted">Generated from {wall.sourceCadEntityIds.length} source {wall.sourceCadEntityIds.length===1?'entity':'entities'}.</p>{wall.sourceCadEntityIds.map(id=><div className="cad-id" key={id}>{id}<span>WALLS</span></div>)}</section>{wall.validationState==='inferred' && <div className="confirm"><p>Confirm this geometry as an architectural wall?</p><button onClick={()=>confirmWall(wall.id)}>Confirm wall</button><button className="ghost">Change type</button></div>}</>}</aside></div>
    <footer><span><CircleDot size={12}/> Ready</span><span>Units: Architectural (ft/in)</span><span>Snap: Endpoint, Midpoint, Intersection</span><span className="footer-right">Source geometry remains immutable</span></footer>
  </div>
}

function Field({label,value}:{label:string,value:string}) { return <div className="field"><label>{label}</label><div>{value}</div></div> }
function NumericField({label,value,onChange}:{label:string,value:number,onChange:(value:number)=>void}) { return <div className="field"><label>{label}</label><input value={value} type="number" min="0" step="0.25" onChange={e=>{const next=Number(e.target.value); if(Number.isFinite(next)&&next>0) onChange(next)}}/></div> }
export default App;
