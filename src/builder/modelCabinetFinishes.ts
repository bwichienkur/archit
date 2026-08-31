import type { ArchitecturalWall,BuildingModelV2 } from '../domain/building';
import type { SolvedCabinet } from './cabinetLayout';
import { deriveCabinetFinishes,type CabinetFinishOptions,type CabinetFinishResult } from './cabinetSurfaces';

export type ModelCabinetFinishRun={hostWallId:string;result:CabinetFinishResult};

export function deriveModelCabinetFinishes(model:BuildingModelV2,options:CabinetFinishOptions={}):ModelCabinetFinishRun[]{
  const wallById=new Map(model.walls.map(wall=>[wall.id,wall]));
  const grouped=new Map<string,SolvedCabinet[]>();
  for(const cabinet of model.cabinets){
    if(!cabinet.hostWallId)continue;
    const wall=wallById.get(cabinet.hostWallId);if(!wall)continue;
    const solved=asSolved(cabinet,wall);
    const items=grouped.get(wall.id)??[];items.push(solved);grouped.set(wall.id,items);
  }
  return [...grouped.entries()].sort(([left],[right])=>left.localeCompare(right)).map(([hostWallId,cabinets])=>({hostWallId,result:deriveCabinetFinishes(cabinets,0,options)}));
}

function asSolved(cabinet:BuildingModelV2['cabinets'][number],wall:ArchitecturalWall):SolvedCabinet{
  const dx=wall.end.x-wall.start.x,dy=wall.end.y-wall.start.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
  const center=(cabinet.origin.x-wall.start.x)*ux+(cabinet.origin.y-wall.start.y)*uy;
  return{...cabinet,offsetFromWallStart:center-cabinet.width/2};
}
