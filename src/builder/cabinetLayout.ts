import type { ArchitecturalWall, Cabinet } from '../domain/building';

export type CabinetRunItem = Pick<Cabinet,'id'|'kind'|'width'|'depth'|'height'|'productVariantId'>;
export type SolvedCabinet = Cabinet & { offsetFromWallStart:number };
export type CabinetRunResult = { cabinets:SolvedCabinet[]; fillerWidth:number; issues:string[] };

export function solveCabinetRun(wall:ArchitecturalWall, items:CabinetRunItem[], startOffset:number, endClearance:number, roomId?:string):CabinetRunResult {
  const wallLength=Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y);
  if(startOffset<0||endClearance<0)throw new Error('Cabinet run offsets cannot be negative.');
  const available=wallLength-startOffset-endClearance; if(available<=0)throw new Error('Cabinet run has no available wall length.');
  const total=items.reduce((sum,item)=>sum+item.width,0); const issues:string[]=[]; if(total>available)issues.push(`Cabinet run exceeds available wall length by ${(total-available).toFixed(4)} units.`);
  const dx=(wall.end.x-wall.start.x)/(wallLength||1),dy=(wall.end.y-wall.start.y)/(wallLength||1),rotation=Math.atan2(dy,dx);
  let offset=startOffset;
  const cabinets:SolvedCabinet[]=items.map(item=>{const center=offset+item.width/2;const cabinet:SolvedCabinet={id:item.id,levelId:wall.levelId,roomId,kind:item.kind,origin:{x:wall.start.x+dx*center,y:wall.start.y+dy*center},rotation,width:item.width,depth:item.depth,height:item.height,hostWallId:wall.id,productVariantId:item.productVariantId,offsetFromWallStart:offset};offset+=item.width;return cabinet;});
  return {cabinets,fillerWidth:Math.max(0,available-total),issues};
}
