import type { ArchitecturalRoom, Fixture, Point2 } from '../domain/building';

export type MepRuleProfile = { minimumFixtureClearance:number; outletMaximumSpacing?:number; units:string };
export type MepIssue = { code:string; fixtureId:string; message:string; actual?:number; required?:number; units:string };

export function validateFixturePlacement(room:ArchitecturalRoom, fixture:Fixture, others:Fixture[], profile:MepRuleProfile):MepIssue[] {
  const issues:MepIssue[]=[];
  if(!pointInPolygon(fixture.origin,room.boundary)) issues.push({code:'fixture-outside-room',fixtureId:fixture.id,message:`Fixture ${fixture.id} is outside room ${room.name}.`,units:profile.units});
  const clearance=profile.minimumFixtureClearance;
  for(const other of others){if(other.id===fixture.id)continue;const distance=Math.hypot(other.origin.x-fixture.origin.x,other.origin.y-fixture.origin.y);const required=clearance+Math.max(fixture.width??0,fixture.depth??0,other.width??0,other.depth??0)/2;if(distance<required)issues.push({code:'fixture-clearance',fixtureId:fixture.id,message:`Fixture ${fixture.id} is too close to ${other.id}.`,actual:distance,required,units:profile.units});}
  return issues;
}

export function outletSpacingIssues(path:Point2[], outlets:Fixture[], maximumSpacing:number, units:string):MepIssue[] {
  if(path.length<2||outlets.length<2)return [];
  const positions=outlets.filter(f=>f.category==='electrical').map(f=>({fixture:f,distance:distanceAlongPath(path,f.origin)})).filter(x=>x.distance!=null).sort((a,b)=>a.distance!-b.distance!);
  const issues:MepIssue[]=[];
  for(let i=1;i<positions.length;i++){const gap=positions[i].distance!-positions[i-1].distance!;if(gap>maximumSpacing)issues.push({code:'outlet-spacing',fixtureId:positions[i].fixture.id,message:`Electrical outlet spacing exceeds the configured maximum.`,actual:gap,required:maximumSpacing,units});}
  return issues;
}

function distanceAlongPath(path:Point2[],point:Point2){let accumulated=0,best:{distance:number;offset:number}|null=null;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2===0)continue;const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/l2));const p={x:a.x+t*dx,y:a.y+t*dy},distance=Math.hypot(point.x-p.x,point.y-p.y);if(!best||distance<best.distance)best={distance,offset:accumulated+Math.sqrt(l2)*t};accumulated+=Math.sqrt(l2);}return best?.offset??null;}
function pointInPolygon(p:Point2,poly:Point2[]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside;}
