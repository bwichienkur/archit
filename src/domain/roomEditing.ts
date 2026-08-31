import type { ArchitecturalRoom, Point2 } from './building';

export function renameRoom(room:ArchitecturalRoom,name:string,roomType?:string):ArchitecturalRoom {
  const trimmed=name.trim(); if(!trimmed)throw new Error('Room name is required.');
  return {...room,name:trimmed,roomType:roomType?.trim()||room.roomType,lineage:{...room.lineage,validationState:'modified'}};
}

export function overrideRoomBoundary(room:ArchitecturalRoom,boundary:Point2[]):ArchitecturalRoom {
  if(boundary.length<3)throw new Error('Room boundary requires at least three vertices.');
  if(Math.abs(polygonAreaSigned(boundary))<1e-8)throw new Error('Room boundary area must be non-zero.');
  if(hasSelfIntersection(boundary))throw new Error('Room boundary cannot self-intersect.');
  return {...room,boundary:boundary.map(point=>({...point})),lineage:{...room.lineage,inferenceMethod:'manual-room-boundary',confidence:1,validationState:'modified'}};
}

export function roomLabelPoint(room:ArchitecturalRoom):Point2 {
  let area=0,cx=0,cy=0;
  for(let i=0;i<room.boundary.length;i++){const a=room.boundary[i],b=room.boundary[(i+1)%room.boundary.length],cross=a.x*b.y-b.x*a.y;area+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;}
  area*=.5;if(Math.abs(area)<1e-8){const sum=room.boundary.reduce((acc,p)=>({x:acc.x+p.x,y:acc.y+p.y}),{x:0,y:0});return{x:sum.x/room.boundary.length,y:sum.y/room.boundary.length};}
  return{x:cx/(6*area),y:cy/(6*area)};
}

function polygonAreaSigned(points:Point2[]){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.y-b.x*a.y;}return area/2;}
function hasSelfIntersection(points:Point2[]){for(let i=0;i<points.length;i++){const a1=points[i],a2=points[(i+1)%points.length];for(let j=i+1;j<points.length;j++){if(Math.abs(i-j)<=1||(i===0&&j===points.length-1))continue;const b1=points[j],b2=points[(j+1)%points.length];if(intersects(a1,a2,b1,b2))return true;}}return false;}
function intersects(a:Point2,b:Point2,c:Point2,d:Point2){const cross=(p:Point2,q:Point2,r:Point2)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return ((cross(a,b,c)>0)!==(cross(a,b,d)>0))&&((cross(c,d,a)>0)!==(cross(c,d,b)>0));}
