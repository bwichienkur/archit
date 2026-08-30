import { useMemo } from 'react';
import type { BuildingModelV2 } from '../domain/building';
import { decomposeWallSolids } from '../domain/wallSolids';
import { RoomSurfaces3D, type SceneTransform2D } from './RoomSurfaces3D';

export type BuildingModelScene3DProps = {
  model: BuildingModelV2;
  selectedId?: string | null;
  showFloors?: boolean;
  showCeilings?: boolean;
  onSelect?(kind:'wall'|'room'|'stair'|'cabinet'|'fixture',id:string):void;
};

export function BuildingModelScene3D({model,selectedId,showFloors=true,showCeilings=false,onSelect}:BuildingModelScene3DProps){
  const transform=useMemo(()=>sceneTransform(model),[model]);
  return <>
    <RoomSurfaces3D model={model} transform={transform} showFloors={showFloors} showCeilings={showCeilings} onSelectRoom={id=>onSelect?.('room',id)}/>
    {model.walls.flatMap(wall=>wallMeshes(model,wall,transform,selectedId,onSelect))}
    {model.stairs.flatMap(stair=>stairMeshes(stair,transform,selectedId,onSelect))}
    {model.cabinets.map(cabinet=><mesh key={cabinet.id} position={objectPosition(cabinet.origin,cabinet.height/2,transform)} rotation={[0,-cabinet.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('cabinet',cabinet.id)}} castShadow><boxGeometry args={[cabinet.width*transform.scale,Math.max(cabinet.height*transform.scale,.02),cabinet.depth*transform.scale]}/><meshStandardMaterial color={selectedId===cabinet.id?'#d9a441':'#b7a48a'}/></mesh>)}
    {model.fixtures.map(fixture=>{const width=Math.max((fixture.width??.5)*transform.scale,.05),depth=Math.max((fixture.depth??.5)*transform.scale,.05),height=Math.max((fixture.height??.5)*transform.scale,.05);return <mesh key={fixture.id} position={objectPosition(fixture.origin,height/(2*transform.scale),transform)} rotation={[0,-fixture.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('fixture',fixture.id)}} castShadow><boxGeometry args={[width,height,depth]}/><meshStandardMaterial color={selectedId===fixture.id?'#d9a441':'#9db3bd'}/></mesh>})}
  </>;
}

export function sceneTransform(model:BuildingModelV2):SceneTransform2D {
  const points=[...model.walls.flatMap(wall=>[wall.start,wall.end]),...model.rooms.flatMap(room=>room.boundary),...model.cabinets.map(c=>c.origin),...model.fixtures.map(f=>f.origin)];
  if(points.length===0)return{centerX:0,centerY:0,scale:1};
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),span=Math.max(maxX-minX,maxY-minY,1);
  return{centerX:(minX+maxX)/2,centerY:(minY+maxY)/2,scale:10/span};
}

function wallMeshes(model:BuildingModelV2,wall:BuildingModelV2['walls'][number],transform:SceneTransform2D,selectedId:string|null|undefined,onSelect:BuildingModelScene3DProps['onSelect']){
  const dx=wall.end.x-wall.start.x,dz=wall.end.y-wall.start.y,length=Math.hypot(dx,dz)||1,ux=dx/length,uz=dz/length,angle=-Math.atan2(dz,dx),thickness=Math.max(wall.thickness*transform.scale,.03),hosted=model.openings.filter(opening=>opening.hostWallId===wall.id);
  return decomposeWallSolids(wall,hosted).map((solid,index)=>{const center=solid.startDistance+solid.length/2,mx=(wall.start.x+ux*center-transform.centerX)*transform.scale,mz=(wall.start.y+uz*center-transform.centerY)*transform.scale,height=Math.max(solid.height*transform.scale,.02),bottom=(wall.baseElevation+solid.bottom)*transform.scale;return <mesh key={`${wall.id}:${solid.role}:${solid.openingId??index}:${index}`} position={[mx,bottom+height/2,mz]} rotation={[0,angle,0]} onClick={event=>{event.stopPropagation();onSelect?.('wall',wall.id)}} castShadow receiveShadow><boxGeometry args={[solid.length*transform.scale,height,thickness]}/><meshStandardMaterial color={selectedId===wall.id?'#d9a441':wall.lineage.validationState==='modified'?'#d8bd83':'#d7dadd'}/></mesh>});
}

function stairMeshes(stair:BuildingModelV2['stairs'][number],transform:SceneTransform2D,selectedId:string|null|undefined,onSelect:BuildingModelScene3DProps['onSelect']){
  const meshes=[];for(let i=0;i<stair.riserCount;i++){const run=(i+.5)*stair.treadDepth,height=(i+1)*stair.riserHeight;const c=Math.cos(stair.rotation),s=Math.sin(stair.rotation),origin={x:stair.origin.x+run*c,y:stair.origin.y+run*s};meshes.push(<mesh key={`${stair.id}:${i}`} position={objectPosition(origin,height/2,transform)} rotation={[0,-stair.rotation,0]} onClick={event=>{event.stopPropagation();onSelect?.('stair',stair.id)}} castShadow><boxGeometry args={[stair.treadDepth*transform.scale,Math.max(height*transform.scale,.02),stair.width*transform.scale]}/><meshStandardMaterial color={selectedId===stair.id?'#d9a441':'#b3b0aa'}/></mesh>);}return meshes;
}

function objectPosition(origin:{x:number;y:number},height:number,transform:SceneTransform2D):[number,number,number]{return[(origin.x-transform.centerX)*transform.scale,height*transform.scale,(origin.y-transform.centerY)*transform.scale];}
