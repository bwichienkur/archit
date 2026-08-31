import type { Point2, RoofPlane } from './building';

export type RectangularRoofKind = 'flat' | 'shed' | 'gable' | 'hip';
export type RectangularRoofInput = {
  idPrefix:string;
  levelId:string;
  footprint:[Point2,Point2,Point2,Point2];
  kind:RectangularRoofKind;
  baseElevation:number;
  pitch:number;
  overhang:number;
  slopeAxis?:'ab'|'bc';
  materialId?:string;
};

export type SolvedRectangularRoof = {
  kind:RectangularRoofKind;
  planes:RoofPlane[];
  ridgeSegments:Array<[Point2,Point2]>;
  peakPoints:Point2[];
  maximumElevation:number;
};

export function solveRectangularRoof(input:RectangularRoofInput):SolvedRectangularRoof {
  validate(input);
  const [a,b,c,d]=input.footprint;
  const ab=distance(a,b),bc=distance(b,c);
  const axis=input.slopeAxis??(ab>=bc?'bc':'ab');
  if(input.kind==='flat'){
    return {kind:'flat',planes:[plane(`${input.idPrefix}:flat`,input,[a,b,c,d],0,undefined,input.baseElevation)],ridgeSegments:[],peakPoints:[],maximumElevation:input.baseElevation};
  }
  if(input.kind==='shed'){
    const run=(axis==='ab'?ab:bc)+input.overhang*2;
    const rise=run*input.pitch;
    const direction=axis==='ab'?unit(a,b):unit(a,d);
    return {kind:'shed',planes:[plane(`${input.idPrefix}:shed`,input,[a,b,c,d],input.pitch,direction,input.baseElevation+rise)],ridgeSegments:[],peakPoints:[],maximumElevation:input.baseElevation+rise};
  }
  if(input.kind==='gable') return solveGable(input,axis);
  return solveHip(input,axis);
}

function solveGable(input:RectangularRoofInput,axis:'ab'|'bc'):SolvedRectangularRoof{
  const [a,b,c,d]=input.footprint;
  if(axis==='bc'){
    const left=midpoint(a,d),right=midpoint(b,c),run=distance(a,d)/2+input.overhang,ridgeElevation=input.baseElevation+run*input.pitch;
    const normalA=unit(a,d),normalB=unit(d,a);
    return {kind:'gable',planes:[plane(`${input.idPrefix}:a`,input,[a,b,right,left],input.pitch,normalA,ridgeElevation),plane(`${input.idPrefix}:b`,input,[left,right,c,d],input.pitch,normalB,ridgeElevation)],ridgeSegments:[[left,right]],peakPoints:[left,right],maximumElevation:ridgeElevation};
  }
  const bottom=midpoint(a,b),top=midpoint(d,c),run=distance(a,b)/2+input.overhang,ridgeElevation=input.baseElevation+run*input.pitch;
  const normalA=unit(a,b),normalB=unit(b,a);
  return {kind:'gable',planes:[plane(`${input.idPrefix}:a`,input,[a,bottom,top,d],input.pitch,normalA,ridgeElevation),plane(`${input.idPrefix}:b`,input,[bottom,b,c,top],input.pitch,normalB,ridgeElevation)],ridgeSegments:[[bottom,top]],peakPoints:[bottom,top],maximumElevation:ridgeElevation};
}

function solveHip(input:RectangularRoofInput,axis:'ab'|'bc'):SolvedRectangularRoof{
  const [a,b,c,d]=input.footprint,ab=distance(a,b),bc=distance(b,c),short=Math.min(ab,bc),run=short/2+input.overhang,peakElevation=input.baseElevation+run*input.pitch;
  if(Math.abs(ab-bc)<1e-9){
    const center=centroid(input.footprint);
    return {kind:'hip',planes:[
      plane(`${input.idPrefix}:a`,input,[a,b,center],input.pitch,unit(midpoint(a,b),center),peakElevation),
      plane(`${input.idPrefix}:b`,input,[b,c,center],input.pitch,unit(midpoint(b,c),center),peakElevation),
      plane(`${input.idPrefix}:c`,input,[c,d,center],input.pitch,unit(midpoint(c,d),center),peakElevation),
      plane(`${input.idPrefix}:d`,input,[d,a,center],input.pitch,unit(midpoint(d,a),center),peakElevation),
    ],ridgeSegments:[],peakPoints:[center],maximumElevation:peakElevation};
  }
  if(axis==='bc'){
    const offset=short/2;
    const ua=unit(a,b);const ridgeA={x:a.x+ua.x*offset,y:a.y+ua.y*offset};const ridgeB={x:d.x+ua.x*offset,y:d.y+ua.y*offset};
    return {kind:'hip',planes:[
      plane(`${input.idPrefix}:south`,input,[a,b,ridgeA],input.pitch,unit(midpoint(a,b),ridgeA),peakElevation),
      plane(`${input.idPrefix}:east`,input,[b,c,ridgeB,ridgeA],input.pitch,unit(midpoint(b,c),midpoint(ridgeA,ridgeB)),peakElevation),
      plane(`${input.idPrefix}:north`,input,[c,d,ridgeB],input.pitch,unit(midpoint(c,d),ridgeB),peakElevation),
      plane(`${input.idPrefix}:west`,input,[d,a,ridgeA,ridgeB],input.pitch,unit(midpoint(d,a),midpoint(ridgeA,ridgeB)),peakElevation),
    ],ridgeSegments:[[ridgeA,ridgeB]],peakPoints:[ridgeA,ridgeB],maximumElevation:peakElevation};
  }
  const ud=unit(a,d);const ridgeA={x:a.x+ud.x*short/2,y:a.y+ud.y*short/2};const ridgeB={x:b.x+ud.x*short/2,y:b.y+ud.y*short/2};
  return {kind:'hip',planes:[
    plane(`${input.idPrefix}:west`,input,[d,a,ridgeA],input.pitch,unit(midpoint(d,a),ridgeA),peakElevation),
    plane(`${input.idPrefix}:south`,input,[a,b,ridgeB,ridgeA],input.pitch,unit(midpoint(a,b),midpoint(ridgeA,ridgeB)),peakElevation),
    plane(`${input.idPrefix}:east`,input,[b,c,ridgeB],input.pitch,unit(midpoint(b,c),ridgeB),peakElevation),
    plane(`${input.idPrefix}:north`,input,[c,d,ridgeA,ridgeB],input.pitch,unit(midpoint(c,d),midpoint(ridgeA,ridgeB)),peakElevation),
  ],ridgeSegments:[[ridgeA,ridgeB]],peakPoints:[ridgeA,ridgeB],maximumElevation:peakElevation};
}

function plane(id:string,input:RectangularRoofInput,boundary:Point2[],pitch:number,riseDirection:Point2|undefined,ridgeElevation:number):RoofPlane{return{id,levelId:input.levelId,boundary,pitch,baseElevation:input.baseElevation,overhang:input.overhang,materialId:input.materialId,riseDirection,ridgeElevation};}
function validate(input:RectangularRoofInput){if(input.overhang<0)throw new Error('Roof overhang cannot be negative.');if(input.kind!=='flat'&&!(input.pitch>0))throw new Error('Sloped roof pitch must be positive.');if(!isRectangle(input.footprint))throw new Error('Rectangular roof solver requires a rectangular footprint.');}
function isRectangle(points:[Point2,Point2,Point2,Point2]){const v=points.map((p,i)=>({x:points[(i+1)%4].x-p.x,y:points[(i+1)%4].y-p.y}));return v.every((a,i)=>Math.hypot(a.x,a.y)>1e-9&&Math.abs(a.x*v[(i+1)%4].x+a.y*v[(i+1)%4].y)<1e-6);}
function distance(a:Point2,b:Point2){return Math.hypot(b.x-a.x,b.y-a.y);}
function midpoint(a:Point2,b:Point2):Point2{return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function centroid(points:Point2[]):Point2{return{x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length};}
function unit(a:Point2,b:Point2):Point2{const d=distance(a,b)||1;return{x:(b.x-a.x)/d,y:(b.y-a.y)/d};}
