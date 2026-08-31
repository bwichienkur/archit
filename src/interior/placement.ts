import type { ArchitecturalRoom, Point2 } from '../domain/building';

export type Placement = { id:string; origin:Point2; width:number; depth:number; rotation:number };
export type PlacementIssue = { code:'outside-room'|'collision'; objectId:string; otherId?:string; message:string };

export function validatePlacement(room:ArchitecturalRoom, candidate:Placement, existing:Placement[]):PlacementIssue[] {
  const issues:PlacementIssue[]=[]; const corners=orientedCorners(candidate);
  if(!corners.every(point=>pointInPolygon(point,room.boundary))) issues.push({code:'outside-room',objectId:candidate.id,message:`${candidate.id} extends outside room ${room.name}.`});
  for(const other of existing){if(other.id===candidate.id)continue;if(polygonsIntersect(corners,orientedCorners(other)))issues.push({code:'collision',objectId:candidate.id,otherId:other.id,message:`${candidate.id} collides with ${other.id}.`});}
  return issues;
}

export function orientedCorners(item:Placement):Point2[]{const hw=item.width/2,hd=item.depth/2,c=Math.cos(item.rotation),s=Math.sin(item.rotation);return[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,y])=>({x:item.origin.x+x*c-y*s,y:item.origin.y+x*s+y*c}));}
function pointInPolygon(p:Point2,poly:Point2[]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside;}
function polygonsIntersect(a:Point2[],b:Point2[]){for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(segmentsIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;return pointInPolygon(a[0],b)||pointInPolygon(b[0],a);}
function segmentsIntersect(a:Point2,b:Point2,c:Point2,d:Point2){const cross=(p:Point2,q:Point2,r:Point2)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);return ((ab1>0)!==(ab2>0))&&((cd1>0)!==(cd2>0));}
