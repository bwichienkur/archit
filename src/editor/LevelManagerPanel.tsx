import { useMemo,useState } from 'react';
import { CopyPlus,Layers3 } from 'lucide-react';
import { addLevel,copyLevelGeometry,stackedWallPairs } from '../domain/levelOperations';
import { useBuildingEditorStore } from './buildingStore';
import './levelManager.css';

export function LevelManagerPanel(){
  const model=useBuildingEditorStore(state=>state.model);
  const replaceModel=useBuildingEditorStore(state=>state.replaceModel);
  const [name,setName]=useState('Level 2');
  const [elevation,setElevation]=useState('10');
  const [wallHeight,setWallHeight]=useState('10');
  const [ceilingHeight,setCeilingHeight]=useState('9');
  const [sourceLevelId,setSourceLevelId]=useState('');
  const [copyGeometry,setCopyGeometry]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const stacked=useMemo(()=>model?stackedWallPairs(model):[],[model]);

  if(!model)return <div className="platform-empty-state">Create or reopen a BuildingModelV2 before managing levels.</div>;
  const sorted=[...model.levels].sort((a,b)=>a.elevation-b.elevation);
  const selectedSource=sourceLevelId||sorted[0]?.id||'';

  function create(){
    setError(null);
    const nextElevation=Number(elevation),nextWallHeight=Number(wallHeight),nextCeilingHeight=Number(ceilingHeight);
    if(!name.trim()){setError('Level name is required.');return;}
    if(!Number.isFinite(nextElevation)||!(nextWallHeight>0)||!(nextCeilingHeight>0)){setError('Elevation must be numeric and wall/ceiling heights must be positive.');return;}
    try{
      const id=uniqueLevelId(model.levels.map(level=>level.id),name);
      let next=addLevel(model,{id,name:name.trim(),elevation:nextElevation,defaultWallHeight:nextWallHeight,defaultCeilingHeight:nextCeilingHeight});
      if(copyGeometry&&selectedSource)next=copyLevelGeometry(next,selectedSource,id);
      replaceModel(next);
      setName(`Level ${next.levels.length+1}`);
      setElevation(String(nextElevation+nextWallHeight));
    }catch(reason){setError(reason instanceof Error?reason.message:'Level creation failed.');}
  }

  return <section className="level-manager-panel">
    <header><div><small>MULTI-STORY BIM</small><strong>Level manager</strong></div><span>{model.levels.length} levels · {stacked.length} stacked wall pairs</span></header>
    {error&&<p className="platform-inline-error">{error}</p>}
    <div className="level-list">{sorted.map(level=>{
      const walls=model.walls.filter(wall=>wall.levelId===level.id).length,rooms=model.rooms.filter(room=>room.levelId===level.id).length,openings=model.openings.filter(opening=>model.walls.some(wall=>wall.id===opening.hostWallId&&wall.levelId===level.id)).length;
      return <article key={level.id}><Layers3 size={15}/><div><strong>{level.name}</strong><small>{level.id}</small></div><dl><div><dt>Elevation</dt><dd>{level.elevation}</dd></div><div><dt>Walls</dt><dd>{walls}</dd></div><div><dt>Rooms</dt><dd>{rooms}</dd></div><div><dt>Openings</dt><dd>{openings}</dd></div></dl></article>;
    })}</div>
    <section className="level-create-card"><header><CopyPlus size={14}/><strong>Add level</strong></header><div className="level-form-grid">
      <label>Name<input value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>Elevation<input inputMode="decimal" value={elevation} onChange={event=>setElevation(event.target.value)}/></label>
      <label>Default wall height<input inputMode="decimal" value={wallHeight} onChange={event=>setWallHeight(event.target.value)}/></label>
      <label>Default ceiling height<input inputMode="decimal" value={ceilingHeight} onChange={event=>setCeilingHeight(event.target.value)}/></label>
      <label>Copy source<select value={selectedSource} onChange={event=>setSourceLevelId(event.target.value)}>{sorted.map(level=><option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
      <label className="level-copy-toggle"><input type="checkbox" checked={copyGeometry} onChange={event=>setCopyGeometry(event.target.checked)}/> Copy walls, rooms & openings</label>
    </div><button onClick={create}>Add level</button></section>
  </section>;
}

function uniqueLevelId(existing:string[],name:string){const base=(name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'level');let id=base,index=2;while(existing.includes(id))id=`${base}-${index++}`;return id;}
