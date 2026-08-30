import type { BuildingModelV2 } from '../domain/building';
import { roofSlopeArea } from '../domain/roofSolver';

export type BuildingTakeoff = {
  wallGrossArea:number;
  wallOpeningArea:number;
  wallNetArea:number;
  floorArea:number;
  ceilingArea:number;
  baseboardLength:number;
  crownLength:number;
  roofArea:number;
  doorCount:number;
  windowCount:number;
  cabinetCount:number;
  fixtureCounts:Record<string,number>;
};

export function calculateBuildingTakeoff(model:BuildingModelV2):BuildingTakeoff {
  let wallGrossArea=0,wallOpeningArea=0,baseboardLength=0;
  const openingByWall=new Map<string,BuildingModelV2['openings']>();
  for(const opening of model.openings){const list=openingByWall.get(opening.hostWallId)??[];list.push(opening);openingByWall.set(opening.hostWallId,list);}
  for(const wall of model.walls){const length=Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y);wallGrossArea+=length*wall.height;const openings=openingByWall.get(wall.id)??[];wallOpeningArea+=openings.reduce((sum,o)=>sum+o.width*o.height,0);}
  let floorArea=0,ceilingArea=0,crownLength=0;
  for(const room of model.rooms){const area=polygonArea(room.boundary);const perimeter=polygonPerimeter(room.boundary);floorArea+=area;ceilingArea+=area;baseboardLength+=perimeter;crownLength+=perimeter;}
  const fixtureCounts:Record<string,number>={};for(const fixture of model.fixtures)fixtureCounts[fixture.category]=(fixtureCounts[fixture.category]??0)+1;
  return {wallGrossArea,wallOpeningArea,wallNetArea:Math.max(0,wallGrossArea-wallOpeningArea),floorArea,ceilingArea,baseboardLength,crownLength,roofArea:model.roofPlanes.reduce((sum,plane)=>sum+roofSlopeArea(plane),0),doorCount:model.openings.filter(o=>o.kind==='door').length,windowCount:model.openings.filter(o=>o.kind==='window').length,cabinetCount:model.cabinets.length,fixtureCounts};
}

function polygonArea(points:Array<{x:number;y:number}>){let s=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;}
function polygonPerimeter(points:Array<{x:number;y:number}>){let p=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];p+=Math.hypot(b.x-a.x,b.y-a.y);}return p;}
