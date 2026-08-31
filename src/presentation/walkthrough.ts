import type { Point2 } from '../domain/building';

export type WalkthroughPose = { position:{x:number;y:number;z:number}; yaw:number; pitch:number; eyeHeight:number };
export type WalkthroughInput = { forward:number; strafe:number; turn:number; look:number; deltaSeconds:number; speed:number; turnSpeed:number };

export function stepWalkthrough(pose:WalkthroughPose,input:WalkthroughInput):WalkthroughPose {
  const yaw=pose.yaw+input.turn*input.turnSpeed*input.deltaSeconds;
  const pitch=clamp(pose.pitch+input.look*input.turnSpeed*input.deltaSeconds,-Math.PI*.49,Math.PI*.49);
  const forwardX=Math.cos(yaw),forwardZ=Math.sin(yaw),rightX=-forwardZ,rightZ=forwardX;
  const distance=input.speed*input.deltaSeconds;
  return {...pose,yaw,pitch,position:{...pose.position,x:pose.position.x+(forwardX*input.forward+rightX*input.strafe)*distance,z:pose.position.z+(forwardZ*input.forward+rightZ*input.strafe)*distance,y:pose.eyeHeight}};
}

export function constrainPoseToBoundary(pose:WalkthroughPose,boundary:Point2[]):WalkthroughPose {
  if(pointInPolygon({x:pose.position.x,y:pose.position.z},boundary))return pose;
  let best:{point:Point2;distance:number}|null=null;for(let i=0;i<boundary.length;i++){const p=closestPointOnSegment({x:pose.position.x,y:pose.position.z},boundary[i],boundary[(i+1)%boundary.length]);const d=Math.hypot(p.x-pose.position.x,p.y-pose.position.z);if(!best||d<best.distance)best={point:p,distance:d};}
  return best?{...pose,position:{...pose.position,x:best.point.x,z:best.point.y}}:pose;
}

function closestPointOnSegment(p:Point2,a:Point2,b:Point2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(!l2)return a;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return{x:a.x+t*dx,y:a.y+t*dy};}
function pointInPolygon(p:Point2,poly:Point2[]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside;}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}
