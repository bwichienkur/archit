import type { ArchitecturalRoom, ArchitecturalWall, BuildingModelV2, Level, Point2 } from './building';

export function addLevel(model:BuildingModelV2,level:Level):BuildingModelV2{if(model.levels.some(item=>item.id===level.id))throw new Error(`Level ${level.id} already exists.`);return{...model,levels:[...model.levels,level].sort((a,b)=>a.elevation-b.elevation)};}

export function copyLevelGeometry(model:BuildingModelV2,sourceLevelId:string,targetLevelId:string,offset:Point2={x:0,y:0}):BuildingModelV2 {
  if(!model.levels.some(level=>level.id===targetLevelId))throw new Error(`Target level ${targetLevelId} does not exist.`);
  const sourceWalls=model.walls.filter(wall=>wall.levelId===sourceLevelId); const idMap=new Map<string,string>();
  const walls:ArchitecturalWall[]=sourceWalls.map(wall=>{const id=`${wall.id}:copy:${targetLevelId}`;idMap.set(wall.id,id);return{...wall,id,levelId:targetLevelId,start:{x:wall.start.x+offset.x,y:wall.start.y+offset.y},end:{x:wall.end.x+offset.x,y:wall.end.y+offset.y},openingIds:[],lineage:{...wall.lineage,validationState:'modified'}};});
  const rooms:ArchitecturalRoom[]=model.rooms.filter(room=>room.levelId===sourceLevelId).map(room=>({...room,id:`${room.id}:copy:${targetLevelId}`,levelId:targetLevelId,boundary:room.boundary.map(point=>({x:point.x+offset.x,y:point.y+offset.y})),lineage:{...room.lineage,validationState:'modified'}}));
  const openings=model.openings.filter(opening=>idMap.has(opening.hostWallId)).map(opening=>({...opening,id:`${opening.id}:copy:${targetLevelId}`,hostWallId:idMap.get(opening.hostWallId)!,lineage:{...opening.lineage,validationState:'modified'}}));
  const openingIdsByWall=new Map<string,string[]>();for(const opening of openings){const list=openingIdsByWall.get(opening.hostWallId)??[];list.push(opening.id);openingIdsByWall.set(opening.hostWallId,list);}const updatedWalls=walls.map(wall=>({...wall,openingIds:openingIdsByWall.get(wall.id)??[]}));
  return{...model,walls:[...model.walls,...updatedWalls],rooms:[...model.rooms,...rooms],openings:[...model.openings,...openings]};
}

export function stackedWallPairs(model:BuildingModelV2,tolerance=1e-4){const pairs:Array<{lowerWallId:string;upperWallId:string}>=[];const sorted=[...model.levels].sort((a,b)=>a.elevation-b.elevation);for(let i=1;i<sorted.length;i++){const lower=model.walls.filter(w=>w.levelId===sorted[i-1].id),upper=model.walls.filter(w=>w.levelId===sorted[i].id);for(const a of lower)for(const b of upper)if(sameSegment(a.start,a.end,b.start,b.end,tolerance))pairs.push({lowerWallId:a.id,upperWallId:b.id});}return pairs;}
function near(a:Point2,b:Point2,t:number){return Math.hypot(a.x-b.x,a.y-b.y)<=t;}function sameSegment(a1:Point2,a2:Point2,b1:Point2,b2:Point2,t:number){return(near(a1,b1,t)&&near(a2,b2,t))||(near(a1,b2,t)&&near(a2,b1,t));}
