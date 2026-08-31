import type { Point2 } from '../domain/building';

export type SiteBoundary = { id:string; boundary:Point2[]; frontEdge:[Point2,Point2] };
export type SiteSetbacks = { front:number; rear:number; side:number };
export type BuildingFootprint = { id:string; boundary:Point2[] };
export type SiteIssue = { code:string; message:string; objectId:string; distance:number; required:number };

export function validateFootprintSetbacks(site: SiteBoundary, footprint: BuildingFootprint, setbacks: SiteSetbacks): SiteIssue[] {
  if (site.boundary.length < 3 || footprint.boundary.length < 3) throw new Error('Site and footprint polygons require at least three vertices.');
  const issues: SiteIssue[] = [];
  const edges = polygonEdges(site.boundary);
  const frontIndex = closestEdgeIndex(edges, site.frontEdge);
  for (const point of footprint.boundary) {
    for (let i=0;i<edges.length;i++) {
      const edge=edges[i];
      const required=i===frontIndex?setbacks.front:(i===oppositeEdgeIndex(edges,frontIndex)?setbacks.rear:setbacks.side);
      const distance=pointToSegmentDistance(point,edge[0],edge[1]);
      if (distance+1e-8 < required) issues.push({ code:i===frontIndex?'front-setback':i===oppositeEdgeIndex(edges,frontIndex)?'rear-setback':'side-setback', message:`Footprint ${footprint.id} violates a site setback.`, objectId:footprint.id, distance, required });
    }
  }
  return dedupe(issues);
}

export function polygonArea(boundary:Point2[]){ let sum=0; for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];sum+=a.x*b.y-b.x*a.y;} return Math.abs(sum)/2; }

function polygonEdges(points:Point2[]):Array<[Point2,Point2]>{return points.map((p,i)=>[p,points[(i+1)%points.length]]);}
function closestEdgeIndex(edges:Array<[Point2,Point2]>,target:[Point2,Point2]){let best=0,bestScore=Infinity;edges.forEach((edge,i)=>{const score=pointToSegmentDistance(target[0],edge[0],edge[1])+pointToSegmentDistance(target[1],edge[0],edge[1]);if(score<bestScore){bestScore=score;best=i;}});return best;}
function oppositeEdgeIndex(edges:Array<[Point2,Point2]>,front:number){ if(edges.length===4)return (front+2)%4; let best=front,bestDistance=-1; const fm=midpoint(edges[front]); edges.forEach((edge,i)=>{const d=Math.hypot(midpoint(edge).x-fm.x,midpoint(edge).y-fm.y);if(d>bestDistance){bestDistance=d;best=i;}});return best;}
function midpoint(edge:[Point2,Point2]){return{x:(edge[0].x+edge[1].x)/2,y:(edge[0].y+edge[1].y)/2};}
function pointToSegmentDistance(p:Point2,a:Point2,b:Point2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2===0)return Math.hypot(p.x-a.x,p.y-a.y);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function dedupe(issues:SiteIssue[]){const map=new Map<string,SiteIssue>();for(const issue of issues){const key=`${issue.code}:${issue.objectId}`;const current=map.get(key);if(!current||issue.distance<current.distance)map.set(key,issue);}return [...map.values()];}
