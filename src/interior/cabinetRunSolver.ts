import type { Cabinet, Point2 } from '../domain/building';

export type CabinetModuleSpec = {
  id:string;
  kind:Cabinet['kind'];
  width:number;
  depth:number;
  height:number;
  productVariantId?:string;
};

export type CabinetRunInput = {
  runId:string;
  levelId:string;
  roomId?:string;
  hostWallId:string;
  wallStart:Point2;
  wallEnd:Point2;
  startOffset:number;
  endOffset:number;
  modules:CabinetModuleSpec[];
  minimumFiller:number;
  maximumFiller:number;
  countertopDepth:number;
  countertopOverhang:number;
};

export type CountertopSurface = {
  id:string;
  runId:string;
  boundary:Point2[];
  depth:number;
  length:number;
};

export type SolvedCabinetRun = {
  cabinets:Cabinet[];
  fillers:Array<{id:string;width:number;centerOffset:number}>;
  countertop:CountertopSurface;
  availableLength:number;
  usedLength:number;
};

export function solveCabinetRun(input:CabinetRunInput):SolvedCabinetRun {
  validate(input);
  const wallLength=distance(input.wallStart,input.wallEnd);
  const available=wallLength-input.startOffset-input.endOffset;
  const moduleWidth=input.modules.reduce((sum,module)=>sum+module.width,0);
  const leftover=available-moduleWidth;
  if(leftover<0)throw new Error(`Cabinet modules exceed the available run by ${Math.abs(leftover)}.`);
  const fillers=solveFillers(input.runId,leftover,input.minimumFiller,input.maximumFiller,available);
  const startFiller=fillers.find(item=>item.id.endsWith(':start'))?.width??0;
  let cursor=input.startOffset+startFiller;
  const direction=unit(input.wallStart,input.wallEnd),normal={x:-direction.y,y:direction.x},rotation=Math.atan2(direction.y,direction.x);
  const cabinets=input.modules.map(module=>{
    const centerOffset=cursor+module.width/2;
    const center=advance(input.wallStart,direction,centerOffset);
    const origin={x:center.x+normal.x*module.depth/2,y:center.y+normal.y*module.depth/2};
    cursor+=module.width;
    return {id:`${input.runId}:${module.id}`,levelId:input.levelId,roomId:input.roomId,kind:module.kind,origin,rotation,width:module.width,depth:module.depth,height:module.height,hostWallId:input.hostWallId,productVariantId:module.productVariantId} satisfies Cabinet;
  });
  const counterStart=Math.max(0,input.startOffset-input.countertopOverhang);
  const counterEnd=Math.min(wallLength,wallLength-input.endOffset+input.countertopOverhang);
  const countertop=countertopFor(input.runId,input.wallStart,direction,normal,counterStart,counterEnd,input.countertopDepth,input.countertopOverhang);
  return {cabinets,fillers,countertop,availableLength:available,usedLength:moduleWidth+leftover};
}

function solveFillers(runId:string,leftover:number,min:number,max:number,available:number){
  if(leftover===0)return [];
  if(leftover<min)throw new Error(`Remaining cabinet-run gap ${leftover} is below the minimum filler ${min}.`);
  if(leftover<=max)return[{id:`${runId}:filler:end`,width:leftover,centerOffset:available-leftover/2}];
  const each=leftover/2;
  if(each<min||each>max)throw new Error(`Remaining gap ${leftover} cannot be distributed within filler limits ${min}-${max}.`);
  return[{id:`${runId}:filler:start`,width:each,centerOffset:each/2},{id:`${runId}:filler:end`,width:each,centerOffset:available-each/2}];
}

function countertopFor(runId:string,start:Point2,direction:Point2,normal:Point2,startOffset:number,endOffset:number,depth:number,overhang:number):CountertopSurface{
  const p0=advance(start,direction,startOffset);const p1=advance(start,direction,endOffset);
  const backShift=Math.max(0,overhang);const frontDepth=depth+Math.max(0,overhang);
  const a={x:p0.x-normal.x*backShift,y:p0.y-normal.y*backShift};const b={x:p1.x-normal.x*backShift,y:p1.y-normal.y*backShift};
  const c={x:p1.x+normal.x*frontDepth,y:p1.y+normal.y*frontDepth};const d={x:p0.x+normal.x*frontDepth,y:p0.y+normal.y*frontDepth};
  return{id:`${runId}:countertop`,runId,boundary:[a,b,c,d],depth:backShift+frontDepth,length:endOffset-startOffset};
}
function validate(input:CabinetRunInput){const length=distance(input.wallStart,input.wallEnd);if(length<=0)throw new Error('Cabinet run host wall must have positive length.');if(input.startOffset<0||input.endOffset<0||input.startOffset+input.endOffset>=length)throw new Error('Cabinet run offsets leave no usable wall length.');if(input.modules.length===0)throw new Error('Cabinet run requires at least one module.');for(const module of input.modules)if(module.width<=0||module.depth<=0||module.height<=0)throw new Error(`Cabinet module ${module.id} has invalid dimensions.`);if(input.minimumFiller<0||input.maximumFiller<input.minimumFiller)throw new Error('Cabinet filler limits are invalid.');if(input.countertopDepth<=0)throw new Error('Countertop depth must be positive.');}
function distance(a:Point2,b:Point2){return Math.hypot(b.x-a.x,b.y-a.y);}
function unit(a:Point2,b:Point2){const d=distance(a,b)||1;return{x:(b.x-a.x)/d,y:(b.y-a.y)/d};}
function advance(origin:Point2,direction:Point2,distanceValue:number):Point2{return{x:origin.x+direction.x*distanceValue,y:origin.y+direction.y*distanceValue};}
