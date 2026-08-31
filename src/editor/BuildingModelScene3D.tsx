import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { deriveModelCabinetFinishes } from '../builder/modelCabinetFinishes';
import type { BuildingModelV2 } from '../domain/building';
import { layoutStair } from '../domain/stairAdvanced';
import { buildStairRailingPaths } from '../domain/stairRailings';
import type { SolvedStair } from '../domain/stairSolver';
import { decomposeWallSolids } from '../domain/wallSolids';
import { RoomSurfaces3D, type SceneTransform2D } from './RoomSurfaces3D';
import { RoofPlanes3D } from './RoofPlanes3D';

export type BuildingModelScene3DProps = {
  model: BuildingModelV2;
  selectedId?: string | null;
  showFloors?: boolean;
  showCeilings?: boolean;
  onSelect?(kind:'wall'|'room'|'stair'|'roof'|'cabinet'|'fixture',id:string):void;
};

export function BuildingModelScene3D({model,selectedId,showFloors=true,showCeilings=false,onSelect}:BuildingModelScene3DProps){
  const transform=useMemo(()=>sceneTransform(model),[model]);
  const cabinetFinishes=useMemo(()=>deriveModelCabinetFinishes(model).flatMap(run=>run.result.boxes),[model]);
  return <>
    <RoomSurfaces3D model={model} transform={transform} showFloors={showFloors} showCeilings={showCeilings} onSelectRoom={id=>onSelect?.('room',id)}/>
    <RoofPlanes3D model={model} transform={transform} selectedId={selectedId} onSelect={id=>onSelect?.('roof',id)}/>
    {model.walls.flatMap(wall=>wallMeshes(model,wall,transform,selectedId,onSelect))}
    {model.stairs.flatMap(stair=>stairMeshes(stair,transform,selectedId,onSelect))}
    {model.cabinets.map(cabinet=><mesh key={cabinet.id} position={objectPosition(cabinet.origin,cabinet.height/2,transform)} rotation={[0,-cabinet.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('cabinet',cabinet.id)}} castShadow><boxGeometry args={[cabinet.width*transform.scale,Math.max(cabinet.height*transform.scale,.02),cabinet.depth*transform.scale]}/><meshStandardMaterial color={selectedId===cabinet.id?'#d9a441':'#b7a48a'}/></mesh>)}
    {cabinetFinishes.map(box=>{const selected=box.cabinetIds.some(id=>id===selectedId),target=box.cabinetIds[0];return <mesh key={box.id} position={objectPosition(box.origin,box.baseElevation+box.height/2,transform)} rotation={[0,-box.rotation,0]} onClick={event=>{event.stopPropagation();if(target)onSelect?.('cabinet',target)}} castShadow receiveShadow><boxGeometry args={[Math.max(box.width*transform.scale,.01),Math.max(box.height*transform.scale,.01),Math.max(box.depth*transform.scale,.01)]}/><meshStandardMaterial color={selected?'#d9a441':finishColor(box.kind)}/></mesh>})}
    {model.fixtures.map(fixture=>{const width=Math.max((fixture.width??.5)*transform.scale,.05),depth=Math.max((fixture.depth??.5)*transform.scale,.05),height=Math.max((fixture.height??.5)*transform.scale,.05);return <mesh key={fixture.id} position={objectPosition(fixture.origin,height/(2*transform.scale),transform)} rotation={[0,-fixture.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('fixture',fixture.id)}} castShadow><boxGeometry args={[width,height,depth]}/><meshStandardMaterial color={selectedId===fixture.id?'#d9a441':'#9db3bd'}/></mesh>})}
  </>;
}

export function sceneTransform(model:BuildingModelV2):SceneTransform2D {
  const points=[...model.walls.flatMap(wall=>[wall.start,wall.end]),...model.rooms.flatMap(room=>room.boundary),...model.roofPlanes.flatMap(plane=>plane.boundary),...model.cabinets.map(c=>c.origin),...model.fixtures.map(f=>f.origin)];
  if(points.length===0)return{centerX:0,centerY:0,scale:1};
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),span=Math.max(maxX-minX,maxY-minY,1);
  return{centerX:(minX+maxX)/2,centerY:(minY+maxY)/2,scale:10/span};
}

function wallMeshes(model:BuildingModelV2,wall:BuildingModelV2['walls'][number],transform:SceneTransform2D,selectedId:string|null|undefined,onSelect:BuildingModelScene3DProps['onSelect']){
  const dx=wall.end.x-wall.start.x,dz=wall.end.y-wall.start.y,length=Math.hypot(dx,dz)||1,ux=dx/length,uz=dz/length,angle=-Math.atan2(dz,dx),thickness=Math.max(wall.thickness*transform.scale,.03),hosted=model.openings.filter(opening=>opening.hostWallId===wall.id);
  return decomposeWallSolids(wall,hosted).map((solid,index)=>{const center=solid.startDistance+solid.length/2,mx=(wall.start.x+ux*center-transform.centerX)*transform.scale,mz=(wall.start.y+uz*center-transform.centerY)*transform.scale,height=Math.max(solid.height*transform.scale,.02),bottom=(wall.baseElevation+solid.bottom)*transform.scale;return <mesh key={`${wall.id}:${solid.role}:${solid.openingId??index}:${index}`} position={[mx,bottom+height/2,mz]} rotation={[0,angle,0]} onClick={event=>{event.stopPropagation();onSelect?.('wall',wall.id)}} castShadow receiveShadow><boxGeometry args={[solid.length*transform.scale,height,thickness]}/><meshStandardMaterial color={selectedId===wall.id?'#d9a441':wall.lineage.validationState==='modified'?'#d8bd83':'#d7dadd'}/></mesh>});
}

function stairMeshes(stair:BuildingModelV2['stairs'][number],transform:SceneTransform2D,selectedId:string|null|undefined,onSelect:BuildingModelScene3DProps['onSelect']){
  const solved:SolvedStair={...stair,totalRise:stair.riserCount*stair.riserHeight,totalRun:Math.max(0,(stair.riserCount-1)*stair.treadDepth),landingCount:stair.kind==='l'||stair.kind==='u'?1:0};
  const layout=layoutStair(solved),selected=selectedId===stair.id,meshes=[];
  for(const flight of layout.flights){for(let i=0;i<flight.riserCount;i++){const run=(i+.5)*flight.treadDepth,height=(flight.riserStart+i+1)*flight.riserHeight,origin=advance(flight.start,flight.rotation,run);meshes.push(<mesh key={`${flight.id}:tread:${i}`} position={objectPosition(origin,height/2,transform)} rotation={[0,-flight.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('stair',stair.id)}} castShadow><boxGeometry args={[flight.treadDepth*transform.scale,Math.max(height*transform.scale,.02),flight.width*transform.scale]}/><meshStandardMaterial color={selected?'#d9a441':'#b3b0aa'}/></mesh>);}}
  for(const landing of layout.landings){const center=landingCenter(landing.origin,landing.rotation,landing.depth,landing.width),thickness=Math.max(stair.riserHeight*.35,.05);meshes.push(<mesh key={landing.id} position={objectPosition(center,landing.elevation-thickness/2,transform)} rotation={[0,-landing.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('stair',stair.id)}} castShadow><boxGeometry args={[landing.depth*transform.scale,thickness*transform.scale,landing.width*transform.scale]}/><meshStandardMaterial color={selected?'#d9a441':'#aaa79f'}/></mesh>);}
  for(const rail of buildStairRailingPaths(layout)){const start=scenePoint(rail.start,rail.startElevation+rail.guardHeight,transform),end=scenePoint(rail.end,rail.endElevation+rail.guardHeight,transform),segment=segmentTransform(start,end);meshes.push(<mesh key={rail.id} position={segment.position} quaternion={segment.quaternion} onClick={event=>{event.stopPropagation();onSelect?.('stair',stair.id)}} castShadow><boxGeometry args={[segment.length,Math.max(.06*transform.scale,.018),Math.max(.06*transform.scale,.018)]}/><meshStandardMaterial color={selected?'#d9a441':'#767d80'}/></mesh>);}
  return meshes;
}

function finishColor(kind:'countertop'|'backsplash'|'end-panel'|'filler'){return kind==='countertop'?'#c7c3b9':kind==='backsplash'?'#aaa9a2':'#aa967b';}
function advance(origin:{x:number;y:number},rotation:number,distance:number){return{x:origin.x+Math.cos(rotation)*distance,y:origin.y+Math.sin(rotation)*distance};}
function landingCenter(origin:{x:number;y:number},rotation:number,depth:number,width:number){const forward=advance(origin,rotation,depth/2);return advance(forward,rotation+Math.PI/2,width/2);}
function scenePoint(origin:{x:number;y:number},height:number,transform:SceneTransform2D):Vector3{return new Vector3((origin.x-transform.centerX)*transform.scale,height*transform.scale,(origin.y-transform.centerY)*transform.scale);}
function segmentTransform(start:Vector3,end:Vector3){const delta=end.clone().sub(start),length=Math.max(delta.length(),.001),direction=delta.clone().normalize(),quaternion=new Quaternion().setFromUnitVectors(new Vector3(1,0,0),direction);return{position:start.clone().add(end).multiplyScalar(.5),quaternion,length};}
function objectPosition(origin:{x:number;y:number},height:number,transform:SceneTransform2D):[number,number,number]{return[(origin.x-transform.centerX)*transform.scale,height*transform.scale,(origin.y-transform.centerY)*transform.scale];}
