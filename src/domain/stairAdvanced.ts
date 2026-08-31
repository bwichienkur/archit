import type { Point2, Stair } from './building';
import type { SolvedStair } from './stairSolver';

export type StairFlight = {
  id:string;
  start:Point2;
  rotation:number;
  width:number;
  treadDepth:number;
  riserHeight:number;
  riserStart:number;
  riserCount:number;
};

export type StairLanding = {
  id:string;
  origin:Point2;
  rotation:number;
  width:number;
  depth:number;
  elevation:number;
};

export type StairLayout = {
  stairId:string;
  kind:Stair['kind'];
  flights:StairFlight[];
  landings:StairLanding[];
  totalRise:number;
  boundingPolygon:Point2[];
};

export function layoutStair(stair:SolvedStair,landingDepth=stair.width):StairLayout {
  if(landingDepth<=0)throw new Error('Landing depth must be positive.');
  if(stair.kind==='straight')return straight(stair);
  if(stair.kind==='l')return lShape(stair,landingDepth);
  if(stair.kind==='u')return uShape(stair,landingDepth);
  return winder(stair);
}

function straight(stair:SolvedStair):StairLayout{
  const flight=flightFor(stair,'flight-1',stair.origin,stair.rotation,0,stair.riserCount);
  return{stairId:stair.id,kind:stair.kind,flights:[flight],landings:[],totalRise:stair.totalRise,boundingPolygon:rect(stair.origin,stair.rotation,stair.totalRun,stair.width)};
}

function lShape(stair:SolvedStair,landingDepth:number):StairLayout{
  const firstCount=Math.ceil(stair.riserCount/2),secondCount=stair.riserCount-firstCount;
  const firstRun=Math.max(0,(firstCount-1)*stair.treadDepth),secondRun=Math.max(0,(secondCount-1)*stair.treadDepth);
  const first=flightFor(stair,'flight-1',stair.origin,stair.rotation,0,firstCount);
  const landingOrigin=advance(stair.origin,stair.rotation,firstRun);
  const landing:StairLanding={id:`${stair.id}:landing-1`,origin:landingOrigin,rotation:stair.rotation,width:stair.width,depth:landingDepth,elevation:firstCount*stair.riserHeight};
  const secondOrigin=advance(advance(landingOrigin,stair.rotation,landingDepth),stair.rotation+Math.PI/2,0);
  const second=flightFor(stair,'flight-2',secondOrigin,stair.rotation+Math.PI/2,firstCount,secondCount);
  const polygons=[rect(stair.origin,stair.rotation,firstRun,stair.width),rect(landingOrigin,stair.rotation,landingDepth,stair.width),rect(secondOrigin,stair.rotation+Math.PI/2,secondRun,stair.width)];
  return{stairId:stair.id,kind:stair.kind,flights:[first,second],landings:[landing],totalRise:stair.totalRise,boundingPolygon:boundsPolygon(polygons.flat())};
}

function uShape(stair:SolvedStair,landingDepth:number):StairLayout{
  const firstCount=Math.ceil(stair.riserCount/2),secondCount=stair.riserCount-firstCount;
  const firstRun=Math.max(0,(firstCount-1)*stair.treadDepth),secondRun=Math.max(0,(secondCount-1)*stair.treadDepth);
  const first=flightFor(stair,'flight-1',stair.origin,stair.rotation,0,firstCount);
  const landingOrigin=advance(stair.origin,stair.rotation,firstRun);
  const landing:StairLanding={id:`${stair.id}:landing-1`,origin:landingOrigin,rotation:stair.rotation,width:stair.width*2,depth:landingDepth,elevation:firstCount*stair.riserHeight};
  const across=advance(landingOrigin,stair.rotation+Math.PI/2,stair.width);
  const secondOrigin=advance(across,stair.rotation,landingDepth);
  const second=flightFor(stair,'flight-2',secondOrigin,stair.rotation+Math.PI,firstCount,secondCount);
  const polygons=[rect(stair.origin,stair.rotation,firstRun,stair.width),rect(landingOrigin,stair.rotation,landingDepth,stair.width*2),rect(secondOrigin,stair.rotation+Math.PI,secondRun,stair.width)];
  return{stairId:stair.id,kind:stair.kind,flights:[first,second],landings:[landing],totalRise:stair.totalRise,boundingPolygon:boundsPolygon(polygons.flat())};
}

function winder(stair:SolvedStair):StairLayout{
  const firstCount=Math.ceil(stair.riserCount/2),secondCount=stair.riserCount-firstCount;
  const firstRun=Math.max(0,(firstCount-1)*stair.treadDepth),secondRun=Math.max(0,(secondCount-1)*stair.treadDepth);
  const pivot=advance(stair.origin,stair.rotation,firstRun);
  const first=flightFor(stair,'flight-1',stair.origin,stair.rotation,0,firstCount);
  const second=flightFor(stair,'flight-2',pivot,stair.rotation+Math.PI/2,firstCount,secondCount);
  return{stairId:stair.id,kind:stair.kind,flights:[first,second],landings:[],totalRise:stair.totalRise,boundingPolygon:boundsPolygon([...rect(stair.origin,stair.rotation,firstRun,stair.width),...rect(pivot,stair.rotation+Math.PI/2,secondRun,stair.width)])};
}

function flightFor(stair:SolvedStair,suffix:string,start:Point2,rotation:number,riserStart:number,riserCount:number):StairFlight{return{id:`${stair.id}:${suffix}`,start,rotation,width:stair.width,treadDepth:stair.treadDepth,riserHeight:stair.riserHeight,riserStart,riserCount};}
function advance(origin:Point2,rotation:number,distance:number):Point2{return{x:origin.x+Math.cos(rotation)*distance,y:origin.y+Math.sin(rotation)*distance};}
function rect(origin:Point2,rotation:number,length:number,width:number):Point2[]{const c=Math.cos(rotation),s=Math.sin(rotation);return[{x:0,y:0},{x:length,y:0},{x:length,y:width},{x:0,y:width}].map(p=>({x:origin.x+p.x*c-p.y*s,y:origin.y+p.x*s+p.y*c}));}
function boundsPolygon(points:Point2[]):Point2[]{const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}];}
