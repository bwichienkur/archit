import { useMemo, useRef, useState } from 'react';
import { Box, BoxSelect, ChevronDown, CircleDot, FileUp, Grid3X3, Layers3, MousePointer2, Redo2, Ruler, Save, Settings2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import type { BuildingModel } from './domain/model';
import type { BuildingModelV2 } from './domain/building';
import { decomposeWallSolids } from './domain/wallSolids';
import type { CadEntity } from './cad/types';
import { useEditorStore } from './editor/store';
import { useBuildingEditorStore } from './editor/buildingStore';
import { BuildingOverlay } from './editor/BuildingOverlay';
import { HttpCadImportGateway, type CadImportJob } from './cad/importer';
import { CadReferenceLayer } from './cad/CadReferenceLayer';
import { ValidationReport } from './cad/ValidationReport';
import { useCadStore } from './cad/store';
import { SemanticReviewPanel } from './semantic/SemanticReviewPanel';
import { useSemanticStore } from './semantic/store';
import { useProjectPersistenceStore } from './projects/store';

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

function BuildingModel3D({ model, selectedWallId, onSelectWall }: { model: BuildingModelV2; selectedWallId: string | null; onSelectWall: (id: string) => void }) {
  const geometry = useMemo(() => {
    if (model.walls.length === 0) return { centerX: 0, centerY: 0, scale: 1 };
    const xs = model.walls.flatMap(wall => [wall.start.x, wall.end.x]);
    const ys = model.walls.flatMap(wall => [wall.start.y, wall.end.y]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, scale: 10 / span };
  }, [model.walls]);

  return <Canvas camera={{ position: [8, 8, 9], fov: 45 }}><ambientLight intensity={1.5}/><directionalLight position={[5,10,5]} intensity={2}/><Grid args={[20,20]} cellSize={.5} sectionSize={2}/>{model.walls.flatMap(wall => {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.y - wall.start.y;
    const rawLength = Math.hypot(dx, dz) || 1;
    const ux = dx / rawLength;
    const uz = dz / rawLength;
    const thickness = Math.max(wall.thickness * geometry.scale, .03);
    const angle = -Math.atan2(dz, dx);
    const hosted = model.openings.filter(opening => opening.hostWallId === wall.id);
    const solids = decomposeWallSolids(wall, hosted);
    return solids.map((solid,index) => {
      const centerDistance = solid.startDistance + solid.length / 2;
      const mx = (wall.start.x + ux * centerDistance - geometry.centerX) * geometry.scale;
      const mz = (wall.start.y + uz * centerDistance - geometry.centerY) * geometry.scale;
      const height = Math.max(solid.height * geometry.scale, .02);
      const bottom = solid.bottom * geometry.scale;
      return <mesh key={`${wall.id}:${solid.role}:${solid.openingId ?? index}:${index}`} position={[mx,bottom + height/2,mz]} rotation={[0,angle,0]} onClick={event=>{event.stopPropagation();onSelectWall(wall.id)}}><boxGeometry args={[solid.length*geometry.scale,height,thickness]}/><meshStandardMaterial color={selectedWallId===wall.id ? '#d9a441' : wall.lineage.validationState==='modified' ? '#d8bd83' : '#d7dadd'}/></mesh>;
    });
  })}<OrbitControls makeDefault/></Canvas>;
}

function App() {
  const [view, setView] = useState<ViewMode>('2d');
  const [importJob, setImportJob] = useState<CadImportJob | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { model, selectedId, setSelectedId, cadVisible, modelVisible, setCadVisible, setModelVisible, confirmWall, updateWall, undo, redo } = useEditorStore();
  const { model: buildingModel, selection: buildingSelection, select: selectBuilding, updateWall: updateBuildingWall, undo: buildingUndo, redo: buildingRedo, canUndo: buildingCanUndo, canRedo: buildingCanRedo, clear: clearBuilding } = useBuildingEditorStore();
  const { document, validation, hiddenLayerIds, selection, setImportedCad, setEntitySelection, setLayerVisible, isolateLayer, showAllLayers } = useCadStore();
  const { candidates: semanticCandidates, runExtraction } = useSemanticStore();
  const { save, saving, savedAt, error: saveError } = useProjectPersistenceStore();
  const wall = useMemo(() => model.walls.find(x => x.id === selectedId) ?? null, [model, selectedId]);
  const buildingWall = useMemo(() => buildingSelection?.kind === 'wall' ? buildingModel?.walls.find(item => item.id === buildingSelection.id) ?? null : null, [buildingModel, buildingSelection]);
  const buildingRoom = useMemo(() => buildingSelection?.kind === 'room' ? buildingModel?.rooms.find(item => item.id === buildingSelection.id) ?? null : null, [buildingModel, buildingSelection]);
  const buildingOpening = useMemo(() => buildingSelection?.kind === 'opening' ? buildingModel?.openings.find(item => item.id === buildingSelection.id) ?? null : null, [buildingModel, buildingSelection]);
  const cadEntity = useMemo(() => document?.entities.find(entity => entity.id === selection.entityId) ?? null, [document, selection.entityId]);
  const cadLayer = useMemo(() => document?.layers.find(layer => layer.id === cadEntity?.layerId) ?? null, [document, cadEntity]);
  const pendingSemanticCount = semanticCandidates.filter(item => item.reviewState === 'pending').length;
  const activeRoomCount = buildingModel?.rooms.length ?? model.rooms.length;
  const activeWallCount = buildingModel?.walls.length ?? model.walls.length;
  const activeOpeningCount = buildingModel?.openings.length ?? 0;

  async function importDwg(file?: File) {
    if (!file) return;
    setImportBusy(true);
    try {
      const job = await cadGateway.upload(file);
      setImportJob(job);
      if (job.document) {
        setImportedCad(job.document, job.validation ?? null);
        runExtraction(job.document);
        clearBuilding();
      }
      if (job.validation && !job.validation.passed) setValidationOpen(true);
      setEntitySelection(null);
      selectBuilding(null);
      setSelectedId(null);
      setView('2d');
    } catch (error) {
      setImportJob({ id: 'local-error', fileName: file.name, status: 'failed', progress: 0, error: error instanceof Error ? error.message : 'Import failed' });
    } finally {
      setImportBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const persistedModel = buildingModel ?? model;
  const handleUndo = () => buildingModel ? buildingUndo() : undo();
  const handleRedo = () => buildingModel ? buildingRedo() : redo();

  return <div className="app">
    <input ref={fileInput} type="file" accept=".dwg" hidden onChange={e=>void importDwg(e.target.files?.[0])}/>
    <header><div className="brand"><div className="brand-mark"><Box size={18}/></div><strong>ARCHIT</strong><span className="project">{model.projectName}<ChevronDown size={14}/></span></div><div className="header-actions"><button onClick={handleUndo} disabled={buildingModel ? !buildingCanUndo : false} title="Undo"><Undo2 size={16}/></button><button onClick={handleRedo} disabled={buildingModel ? !buildingCanRedo : false} title="Redo"><Redo2 size={16}/></button><div className="view-switch"><button className={view==='2d'?'active':''} onClick={()=>setView('2d')}>2D</button><button className={view==='3d'?'active':''} onClick={()=>setView('3d')}>3D</button><button className={view==='split'?'active':''} onClick={()=>setView('split')}>Split</button></div><button disabled={saving} onClick={()=>void save(model.projectName, persistedModel, 'Editor save')}><Save size={16}/> {saving ? 'Saving…' : 'Save'}</button><button className="primary" disabled={importBusy} onClick={()=>fileInput.current?.click()}><FileUp size={16}/> {importBusy ? 'Importing…' : 'Import DWG'}</button></div></header>
    <div className="workspace"><aside className="left"><section><h3>PROJECT</h3><div className="tree active-row"><ChevronDown size={14}/><Layers3 size={15}/> Ground Floor</div><div className="tree indent"><Box size={14}/> Rooms <span>{activeRoomCount}</span></div><div className="tree indent"><BoxSelect size={14}/> Walls <span>{activeWallCount}</span></div><div className="tree indent"><BoxSelect size={14}/> Openings <span>{activeOpeningCount}</span></div></section>
      <section><h3>DISPLAY</h3><label><input type="checkbox" checked={cadVisible} onChange={e=>setCadVisible(e.target.checked)}/> <span className="dot cad"></span>Original CAD <small>immutable</small></label><label><input type="checkbox" checked={modelVisible} onChange={e=>setModelVisible(e.target.checked)}/> <span className="dot model"></span>Building Model</label><label><input type="checkbox" defaultChecked/> <span className="dot annotation"></span>Annotations</label></section>
      {document && <section className="cad-layers"><div className="section-heading"><h3>CAD LAYERS</h3><button onClick={showAllLayers}>Show all</button></div>{document.layers.map(layer => { const visible=layer.visible && !hiddenLayerIds.has(layer.id); return <div className="layer-row" key={layer.id}><input type="checkbox" checked={visible} disabled={!layer.visible} onChange={e=>setLayerVisible(layer.id,e.target.checked)}/><button className="layer-name" title={`Double-click to isolate ${layer.name}`} onDoubleClick={()=>isolateLayer(layer.id)}><span className="layer-swatch" style={{background:layer.color || '#9aa3a8'}}></span>{layer.name}</button><small>{layer.locked?'locked':layer.frozen?'frozen':''}</small></div>})}<p className="layer-hint">Double-click a layer name to isolate it.</p></section>}
      <section><h3>IMPORT STATUS</h3>{importJob ? <><div className={`status ${importJob.status==='completed'?'good':''}`}><CircleDot size={13}/> {importJob.status}: {importJob.fileName}</div>{importJob.error && <p className="import-error">{importJob.error}</p>}<div className="metric"><span>Progress</span><b>{importJob.progress}%</b></div><div className="metric"><span>CAD entities</span><b>{document?.entities.length ?? '—'}</b></div><div className="metric"><span>Unsupported</span><b>{validation?.unsupportedEntityCount ?? '—'}</b></div></> : <><div className="status good"><CircleDot size={13}/> Demo model ready</div><div className="metric"><span>CAD entities</span><b>—</b></div></>}<div className="metric"><span>Semantic candidates</span><b>{semanticCandidates.length || '—'}</b></div><div className="metric"><span>Needs review</span><b>{pendingSemanticCount || '—'}</b></div>{saveError && <p className="import-error">Save: {saveError}</p>}<button className="full" disabled={!validation} onClick={()=>setValidationOpen(true)}>Open validation report</button></section></aside>
      <main><div className="toolrail"><button className="selected"><MousePointer2/></button><button><Ruler/></button><button><BoxSelect/></button><button><Grid3X3/></button><hr/><button><ZoomIn/></button><button><ZoomOut/></button></div><div className={`viewport ${view}`}>{view!=='3d' && <div className="pane">{document ? <div className="cad-wrap">{cadVisible && <><div className="cad-badge">CAD SOURCE • IMMUTABLE</div><CadReferenceLayer document={document} hiddenLayerIds={hiddenLayerIds} selectedEntityId={selection.entityId} onSelectEntity={id=>{setEntitySelection(id);selectBuilding(null);setSelectedId(null)}}/></>}{modelVisible && buildingModel && <BuildingOverlay document={document} model={buildingModel} selection={buildingSelection} onSelect={next=>{selectBuilding(next);setEntitySelection(null);setSelectedId(null)}}/>}{!cadVisible && !buildingModel && <div className="empty-model-state">Accept semantic candidates to create the editable BIM.</div>}</div> : modelVisible && <Plan model={model} selected={selectedId} onSelect={id=>{setSelectedId(id);setEntitySelection(null);selectBuilding(null)}}/>}</div>}{view!=='2d' && <div className="pane three"><div className="cad-badge">BUILDING MODEL</div>{buildingModel ? <BuildingModel3D model={buildingModel} selectedWallId={buildingSelection?.kind==='wall'?buildingSelection.id:null} onSelectWall={id=>{selectBuilding({kind:'wall',id});setEntitySelection(null);setSelectedId(null)}}/> : <Model3D model={model} selected={selectedId} onSelect={id=>{setSelectedId(id);setEntitySelection(null);selectBuilding(null)}}/>}</div>}</div></main>
      <aside className="right"><div className="inspector-title"><div><small>SELECTED OBJECT</small><strong>{buildingWall?.name ?? buildingRoom?.name ?? (buildingOpening ? `${buildingOpening.kind} opening` : cadEntity ? `${cadEntity.type} • ${cadEntity.sourceHandle}` : wall?.name ?? 'Nothing selected')}</strong></div><Settings2 size={17}/></div>{buildingWall ? <BuildingWallInspector wall={buildingWall} units={buildingModel!.geometryUnits} onUpdate={patch=>updateBuildingWall(buildingWall.id,patch)}/> : buildingRoom ? <BuildingRoomInspector room={buildingRoom} units={buildingModel!.geometryUnits}/> : buildingOpening ? <BuildingOpeningInspector opening={buildingOpening} units={buildingModel!.geometryUnits}/> : cadEntity ? <CadInspector entity={cadEntity} layerName={cadLayer?.name ?? cadEntity.layerId}/> : wall && <><div className={`validation ${wall.validationState}`}>{wall.validationState==='inferred'?'Needs confirmation':'Confirmed building object'}</div><section><h3>GEOMETRY</h3><NumericField label="Thickness (in)" value={wall.thickness} onChange={value=>updateWall(wall.id,{thickness:value})}/><NumericField label="Height (ft)" value={wall.height} onChange={value=>updateWall(wall.id,{height:value})}/><Field label="Length" value={`${(Math.hypot(wall.end.x-wall.start.x, wall.end.y-wall.start.y)/30).toFixed(2)} ft`}/><Field label="Base elevation" value="0 ft"/></section><section><h3>CLASSIFICATION</h3><Field label="Type" value={wall.thickness > 6 ? 'Exterior Wall' : 'Interior Partition'}/><Field label="State" value={wall.validationState}/></section></>}<SemanticReviewPanel projectName={model.projectName}/></aside></div>
    <footer><span><CircleDot size={12}/> {document ? `CAD loaded: ${document.sourceFileName}` : 'Ready'}</span><span>Units: {buildingModel?.geometryUnits ?? document?.drawingUnits ?? 'Architectural (ft/in)'}</span><span>{savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Not yet saved'}</span><span className="footer-right">Source geometry remains immutable</span></footer>
    {validationOpen && validation && <ValidationReport validation={validation} onClose={()=>setValidationOpen(false)}/>} 
  </div>
}

function BuildingWallInspector({ wall, units, onUpdate }: { wall: BuildingModelV2['walls'][number]; units: BuildingModelV2['geometryUnits']; onUpdate: (patch: Partial<Pick<BuildingModelV2['walls'][number], 'thickness'|'height'>>) => void }) {
  const length = Math.hypot(wall.end.x-wall.start.x, wall.end.y-wall.start.y);
  return <><div className={`validation ${wall.lineage.validationState}`}>Editable BIM wall • {wall.lineage.validationState}</div><section><h3>GEOMETRY</h3><NumericField label={`Thickness (${units})`} value={wall.thickness} onChange={value=>onUpdate({thickness:value})}/><NumericField label={`Height (${units})`} value={wall.height} onChange={value=>onUpdate({height:value})}/><Field label="Length" value={`${length.toFixed(3)} ${units}`}/><Field label="Start" value={`${wall.start.x.toFixed(3)}, ${wall.start.y.toFixed(3)}`}/><Field label="End" value={`${wall.end.x.toFixed(3)}, ${wall.end.y.toFixed(3)}`}/></section><section><h3>CAD LINEAGE</h3><p className="muted">{wall.lineage.sourceCadEntityIds.length} immutable source entities • {Math.round((wall.lineage.confidence ?? 1)*100)}% inference confidence</p>{wall.lineage.sourceCadEntityIds.map(id=><div className="cad-id" key={id}>{id}</div>)}</section></>;
}

function BuildingRoomInspector({ room, units }: { room: BuildingModelV2['rooms'][number]; units: BuildingModelV2['geometryUnits'] }) {
  return <><div className={`validation ${room.lineage.validationState}`}>BIM room • {room.lineage.validationState}</div><section><h3>ROOM</h3><Field label="Type" value={room.roomType}/><Field label="Boundary vertices" value={String(room.boundary.length)}/><Field label="Ceiling height" value={`${room.ceilingHeight.toFixed(3)} ${units}`}/></section><section><h3>CAD LINEAGE</h3><p className="muted">{room.lineage.sourceCadEntityIds.length} contributing source entities.</p></section></>;
}

function BuildingOpeningInspector({ opening, units }: { opening: BuildingModelV2['openings'][number]; units: BuildingModelV2['geometryUnits'] }) {
  return <><div className={`validation ${opening.lineage.validationState}`}>Hosted BIM {opening.kind} • {opening.lineage.validationState}</div><section><h3>OPENING</h3><Field label="Host wall" value={opening.hostWallId}/><Field label="Width" value={`${opening.width.toFixed(3)} ${units}`}/><Field label="Height" value={`${opening.height.toFixed(3)} ${units}`}/><Field label="Offset" value={`${opening.offsetFromWallStart.toFixed(3)} ${units}`}/>{opening.kind==='window' && <Field label="Sill height" value={`${(opening.sillHeight ?? 0).toFixed(3)} ${units}`}/>}<Field label="Subtype" value={opening.subtype ?? '—'}/></section><section><h3>CAD LINEAGE</h3><p className="muted">{opening.lineage.sourceCadEntityIds.length} immutable source entities • {Math.round((opening.lineage.confidence ?? 1)*100)}% inference confidence</p>{opening.lineage.sourceCadEntityIds.map(id=><div className="cad-id" key={id}>{id}</div>)}</section></>;
}

function CadInspector({ entity, layerName }: { entity: CadEntity; layerName: string }) {
  return <><div className={`validation ${entity.unsupported?'inferred':'confirmed'}`}>{entity.unsupported ? `Unsupported: ${entity.unsupportedReason ?? 'renderer support pending'}` : 'Exact source CAD entity'}</div><section><h3>SOURCE</h3><Field label="Handle" value={entity.sourceHandle}/><Field label="Type" value={entity.type}/><Field label="Layer" value={layerName}/>{entity.sourceBlockName && <Field label="Block" value={entity.sourceBlockName}/>}</section><section><h3>BOUNDS</h3><Field label="Minimum" value={formatPoint(entity.bounds.min)}/><Field label="Maximum" value={formatPoint(entity.bounds.max)}/></section><section><h3>PROPERTIES</h3>{Object.keys(entity.properties).length === 0 ? <p className="muted">No normalized properties.</p> : Object.entries(entity.properties).slice(0,12).map(([key,value])=><Field key={key} label={key} value={String(value ?? '—')}/>)}</section></>;
}

function formatPoint(point: {x:number;y:number;z?:number}) { return point.z == null ? `${point.x.toFixed(3)}, ${point.y.toFixed(3)}` : `${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)}`; }
function Field({label,value}:{label:string,value:string}) { return <div className="field"><label>{label}</label><div>{value}</div></div> }
function NumericField({label,value,onChange}:{label:string,value:number,onChange:(value:number)=>void}) { return <div className="field"><label>{label}</label><input value={value} type="number" min="0" step="0.25" onChange={e=>{const next=Number(e.target.value); if(Number.isFinite(next)&&next>0) onChange(next)}}/></div> }
export default App;
