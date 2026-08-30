import type { ArchitecturalWall, Point2 } from '../domain/building';

export function moveWall(wall:ArchitecturalWall,delta:Point2):ArchitecturalWall{return markModified({...wall,start:{x:wall.start.x+delta.x,y:wall.start.y+delta.y},end:{x:wall.end.x+delta.x,y:wall.end.y+delta.y}});}

export function rotateWall(wall:ArchitecturalWall,angle:number,pivot:Point2=midpoint(wall.start,wall.end)):ArchitecturalWall{return markModified({...wall,start:rotatePoint(wall.start,pivot,angle),end:rotatePoint(wall.end,pivot,angle)});}

export function mirrorWall(wall:ArchitecturalWall,axisA:Point2,axisB:Point2):ArchitecturalWall{return markModified({...wall,start:mirrorPoint(wall.start,axisA,axisB),end:mirrorPoint(wall.end,axisA,axisB)});}

export function offsetWall(wall:ArchitecturalWall,distance:number):ArchitecturalWall{const dx=wall.end.x-wall.start.x,dy=wall.end.y-wall.start.y,length=Math.hypot(dx,dy);if(length<=1e-9)throw new Error('Cannot offset a zero-length wall.');const nx=-dy/length,ny=dx/length;return moveWall(wall,{x:nx*distance,y:ny*distance});}

export function splitWall(wall:ArchitecturalWall,point:Point2,tolerance=1e-4):[ArchitecturalWall,ArchitecturalWall]{const projection=project(point,wall.start,wall.end);if(projection.distance>tolerance)throw new Error('Split point is not on the wall centerline.');if(projection.t<=tolerance||projection.t>=1-tolerance)throw new Error('Split point must lie inside the wall, not at an endpoint.');const split=projection.point;const left=markModified({...wall,id:`${wall.id}:a`,end:split,openingIds:[]});const right=markModified({...wall,id:`${wall.id}:b`,start:split,openingIds:[]});return[left,right];}

export function intersectInfiniteWalls(a:Pick<ArchitecturalWall,'start'|'end'>,b:Pick<ArchitecturalWall,'start'|'end'>):Point2|null{const x1=a.start.x,y1=a.start.y,x2=a.end.x,y2=a.end.y,x3=b.start.x,y3=b.start.y,x4=b.end.x,y4=b.end.y;const denominator=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(denominator)<1e-10)return null;const determinant1=x1*y2-y1*x2,determinant2=x3*y4-y3*x4;return{x:normalizeZero((determinant1*(x3-x4)-(x1-x2)*determinant2)/denominator),y:normalizeZero((determinant1*(y3-y4)-(y1-y2)*determinant2)/denominator)};}

export function trimOrExtendWallToIntersection(wall:ArchitecturalWall,target:ArchitecturalWall,endpoint:'start'|'end'):ArchitecturalWall{const intersection=intersectInfiniteWalls(wall,target);if(!intersection)throw new Error('Walls are parallel and do not have a unique intersection.');return markModified(endpoint==='start'?{...wall,start:intersection}:{...wall,end:intersection});}

function project(p:Point2,a:Point2,b:Point2){const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;if(!length2)return{point:a,t:0,distance:Math.hypot(p.x-a.x,p.y-a.y)};const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/length2;const point={x:normalizeZero(a.x+dx*t),y:normalizeZero(a.y+dy*t)};return{point,t,distance:Math.hypot(p.x-point.x,p.y-point.y)};}
function rotatePoint(p:Point2,pivot:Point2,angle:number){const x=p.x-pivot.x,y=p.y-pivot.y,c=Math.cos(angle),s=Math.sin(angle);return{x:normalizeZero(pivot.x+x*c-y*s),y:normalizeZero(pivot.y+x*s+y*c)};}
function mirrorPoint(p:Point2,a:Point2,b:Point2){const projection=project(p,a,b).point;return{x:normalizeZero(2*projection.x-p.x),y:normalizeZero(2*projection.y-p.y)};}
function midpoint(a:Point2,b:Point2){return{x:normalizeZero((a.x+b.x)/2),y:normalizeZero((a.y+b.y)/2)};}
function normalizeZero(value:number){return Object.is(value,-0)||Math.abs(value)<1e-12?0:value;}
function markModified(wall:ArchitecturalWall):ArchitecturalWall{return{...wall,lineage:{...wall.lineage,validationState:'modified'}};}
