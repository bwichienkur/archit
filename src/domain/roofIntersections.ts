import type { Point2, RoofPlane } from './building';

export type RoofSeamKind='ridge'|'valley'|'transition';
export type RoofPlaneSeam={
  id:string;
  planeAId:string;
  planeBId:string;
  kind:RoofSeamKind;
  start:Point2;
  end:Point2;
  startElevation:number;
  endElevation:number;
};

type PlaneEquation={a:number;b:number;c:number};

export function analyzeRoofPlaneIntersections(planes:RoofPlane[],tolerance=1e-6):RoofPlaneSeam[]{
  if(!(tolerance>0))throw new Error('Roof intersection tolerance must be positive.');
  const seams:RoofPlaneSeam[]=[];
  for(let i=0;i<planes.length;i++){
    for(let j=i+1;j<planes.length;j++){
      const first=planes[i],second=planes[j];
      if(first.levelId!==second.levelId||first.boundary.length<3||second.boundary.length<3)continue;
      const overlap=convexPolygonIntersection(first.boundary,second.boundary,tolerance);
      if(overlap.length<3)continue;
      const a=planeEquation(first),b=planeEquation(second);
      const line={a:a.a-b.a,b:a.b-b.b,c:a.c-b.c};
      const norm=Math.hypot(line.a,line.b);
      if(norm<=tolerance)continue;
      const candidates=linePolygonIntersections(line,overlap,tolerance);
      if(candidates.length<2)continue;
      const [start,end]=furthestPair(candidates);
      if(distance(start,end)<=tolerance)continue;
      const startElevation=elevationAt(first,start);
      const endElevation=elevationAt(first,end);
      seams.push({
        id:`roof-seam:${first.id}:${second.id}`,
        planeAId:first.id,
        planeBId:second.id,
        kind:classifySeam(first,second,start,end,tolerance),
        start,end,startElevation,endElevation,
      });
    }
  }
  return seams.sort((left,right)=>left.id.localeCompare(right.id));
}

export function elevationAt(plane:RoofPlane,point:Point2):number{
  if(!plane.riseDirection||plane.pitch===0)return plane.baseElevation;
  const direction=normalize(plane.riseDirection);
  const minProjection=Math.min(...plane.boundary.map(vertex=>dot(vertex,direction)));
  const run=dot(point,direction)-minProjection;
  return plane.baseElevation+run*plane.pitch;
}

function planeEquation(plane:RoofPlane):PlaneEquation{
  if(!plane.riseDirection||plane.pitch===0)return{a:0,b:0,c:plane.baseElevation};
  const direction=normalize(plane.riseDirection);
  const minProjection=Math.min(...plane.boundary.map(vertex=>dot(vertex,direction)));
  return{a:direction.x*plane.pitch,b:direction.y*plane.pitch,c:plane.baseElevation-minProjection*plane.pitch};
}

function classifySeam(first:RoofPlane,second:RoofPlane,start:Point2,end:Point2,tolerance:number):RoofSeamKind{
  if(!first.riseDirection||!second.riseDirection)return'transition';
  const tangent=normalize({x:end.x-start.x,y:end.y-start.y});
  const normal={x:-tangent.y,y:tangent.x};
  const g1=gradient(first),g2=gradient(second);
  const across1=dot(g1,normal),across2=dot(g2,normal);
  if(Math.abs(across1)<=tolerance||Math.abs(across2)<=tolerance)return'transition';
  if(across1*across2<0){
    const midpoint={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
    const probe=Math.max(distance(start,end)*1e-4,tolerance*10);
    const plus={x:midpoint.x+normal.x*probe,y:midpoint.y+normal.y*probe};
    const minus={x:midpoint.x-normal.x*probe,y:midpoint.y-normal.y*probe};
    const plusEnvelope=Math.min(elevationAt(first,plus),elevationAt(second,plus));
    const minusEnvelope=Math.min(elevationAt(first,minus),elevationAt(second,minus));
    const seamElevation=elevationAt(first,midpoint);
    return plusEnvelope<seamElevation-tolerance&&minusEnvelope<seamElevation-tolerance?'ridge':'valley';
  }
  return'transition';
}

function gradient(plane:RoofPlane):Point2{
  if(!plane.riseDirection)return{x:0,y:0};
  const direction=normalize(plane.riseDirection);
  return{x:direction.x*plane.pitch,y:direction.y*plane.pitch};
}

function convexPolygonIntersection(subject:Point2[],clip:Point2[],tolerance:number):Point2[]{
  let output=[...subject];
  const winding=Math.sign(signedArea(clip))||1;
  for(let i=0;i<clip.length&&output.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length];
    const input=output;output=[];
    for(let j=0;j<input.length;j++){
      const current=input[j],previous=input[(j+input.length-1)%input.length];
      const currentInside=inside(current,a,b,winding,tolerance),previousInside=inside(previous,a,b,winding,tolerance);
      if(currentInside){if(!previousInside){const intersection=segmentLineIntersection(previous,current,a,b,tolerance);if(intersection)output.push(intersection);}output.push(current);}
      else if(previousInside){const intersection=segmentLineIntersection(previous,current,a,b,tolerance);if(intersection)output.push(intersection);}
    }
    output=dedupe(output,tolerance);
  }
  return output;
}

function linePolygonIntersections(line:PlaneEquation,polygon:Point2[],tolerance:number):Point2[]{
  const points:Point2[]=[];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const fa=line.a*a.x+line.b*a.y+line.c,fb=line.a*b.x+line.b*b.y+line.c;
    if(Math.abs(fa)<=tolerance)points.push(a);
    if(fa*fb<0||Math.abs(fb)<=tolerance){
      const denominator=fa-fb;
      if(Math.abs(denominator)>tolerance){const t=fa/denominator;if(t>=-tolerance&&t<=1+tolerance)points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    }
  }
  return dedupe(points,tolerance);
}

function furthestPair(points:Point2[]):[Point2,Point2]{
  let best:[Point2,Point2]=[points[0],points[1]],bestDistance=-1;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const d=distance(points[i],points[j]);if(d>bestDistance){bestDistance=d;best=[points[i],points[j]];}}
  return best;
}

function segmentLineIntersection(p1:Point2,p2:Point2,a:Point2,b:Point2,tolerance:number):Point2|null{
  const r={x:p2.x-p1.x,y:p2.y-p1.y},s={x:b.x-a.x,y:b.y-a.y};
  const denominator=cross(r,s);if(Math.abs(denominator)<=tolerance)return null;
  const t=cross({x:a.x-p1.x,y:a.y-p1.y},s)/denominator;
  return{x:p1.x+t*r.x,y:p1.y+t*r.y};
}
function inside(point:Point2,a:Point2,b:Point2,winding:number,tolerance:number){return cross({x:b.x-a.x,y:b.y-a.y},{x:point.x-a.x,y:point.y-a.y})*winding>=-tolerance;}
function dedupe(points:Point2[],tolerance:number){const result:Point2[]=[];for(const point of points)if(!result.some(existing=>distance(existing,point)<=tolerance))result.push(point);return result;}
function signedArea(points:Point2[]){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a.x*b.y-b.x*a.y;}return sum/2;}
function normalize(value:Point2):Point2{const length=Math.hypot(value.x,value.y);if(length<=1e-12)throw new Error('Roof rise direction must be non-zero.');return{x:value.x/length,y:value.y/length};}
function dot(a:Point2,b:Point2){return a.x*b.x+a.y*b.y;}
function cross(a:Point2,b:Point2){return a.x*b.y-a.y*b.x;}
function distance(a:Point2,b:Point2){return Math.hypot(b.x-a.x,b.y-a.y);}
