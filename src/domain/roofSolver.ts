import type { Point2, RoofPlane } from './building';

export type GableRoofInput = {
  idPrefix: string;
  levelId: string;
  footprint: [Point2,Point2,Point2,Point2];
  baseElevation: number;
  pitchRisePerRun: number;
  overhang: number;
  ridgeDirection: 'long-axis' | 'short-axis';
  materialId?: string;
};

export type SolvedRoof = { planes: RoofPlane[]; ridge: [Point2,Point2]; ridgeElevation: number };

export function solveRectangularGableRoof(input: GableRoofInput): SolvedRoof {
  if (!(input.pitchRisePerRun > 0)) throw new Error('Roof pitch must be positive.');
  const [a,b,c,d] = input.footprint;
  const ab = distance(a,b), bc = distance(b,c);
  if (ab <= 0 || bc <= 0) throw new Error('Roof footprint must have non-zero dimensions.');
  if (!isRectangle(input.footprint)) throw new Error('The gable solver currently requires a rectangular footprint.');

  const ridgeAlongAB = input.ridgeDirection === 'long-axis' ? ab >= bc : ab < bc;
  const mAB = midpoint(a,b), mDC = midpoint(d,c), mAD = midpoint(a,d), mBC = midpoint(b,c);
  const ridge: [Point2,Point2] = ridgeAlongAB ? [mAD,mBC] : [mAB,mDC];
  const ridgeMid = midpoint(ridge[0],ridge[1]);
  const halfRun = (ridgeAlongAB ? bc : ab) / 2 + input.overhang;
  const ridgeElevation = input.baseElevation + halfRun * input.pitchRisePerRun;
  const planes: RoofPlane[] = ridgeAlongAB
    ? [
      { id:`${input.idPrefix}:a`, levelId:input.levelId, boundary:[a,b,mBC,mAD], pitch:input.pitchRisePerRun, baseElevation:input.baseElevation, overhang:input.overhang, materialId:input.materialId, riseDirection:direction(midpoint(a,b),ridgeMid), ridgeElevation },
      { id:`${input.idPrefix}:b`, levelId:input.levelId, boundary:[mAD,mBC,c,d], pitch:input.pitchRisePerRun, baseElevation:input.baseElevation, overhang:input.overhang, materialId:input.materialId, riseDirection:direction(midpoint(d,c),ridgeMid), ridgeElevation },
    ]
    : [
      { id:`${input.idPrefix}:a`, levelId:input.levelId, boundary:[a,mAB,mDC,d], pitch:input.pitchRisePerRun, baseElevation:input.baseElevation, overhang:input.overhang, materialId:input.materialId, riseDirection:direction(midpoint(a,d),ridgeMid), ridgeElevation },
      { id:`${input.idPrefix}:b`, levelId:input.levelId, boundary:[mAB,b,c,mDC], pitch:input.pitchRisePerRun, baseElevation:input.baseElevation, overhang:input.overhang, materialId:input.materialId, riseDirection:direction(midpoint(b,c),ridgeMid), ridgeElevation },
    ];
  return { planes, ridge, ridgeElevation };
}

export function roofPlanArea(plane: RoofPlane) {
  let area = 0;
  for (let i=0;i<plane.boundary.length;i+=1) {
    const p=plane.boundary[i], q=plane.boundary[(i+1)%plane.boundary.length];
    area += p.x*q.y-q.x*p.y;
  }
  return Math.abs(area)/2;
}

export function roofSlopeArea(plane: RoofPlane) {
  return roofPlanArea(plane) * Math.sqrt(1 + plane.pitch * plane.pitch);
}

export function roofPointElevation(plane: RoofPlane, point: Point2) {
  if (!plane.riseDirection) return plane.baseElevation;
  const projections = plane.boundary.map(vertex => vertex.x*plane.riseDirection!.x + vertex.y*plane.riseDirection!.y);
  const minProjection = Math.min(...projections);
  const projection = point.x*plane.riseDirection.x + point.y*plane.riseDirection.y;
  const elevation = plane.baseElevation + Math.max(0, projection-minProjection) * plane.pitch;
  return plane.ridgeElevation == null ? elevation : Math.min(elevation, plane.ridgeElevation);
}

function midpoint(a:Point2,b:Point2):Point2 { return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }
function distance(a:Point2,b:Point2){ return Math.hypot(b.x-a.x,b.y-a.y); }
function direction(from:Point2,to:Point2){const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;return{x:dx/length,y:dy/length};}
function isRectangle(points:[Point2,Point2,Point2,Point2]) {
  const vectors = points.map((p,i)=>({x:points[(i+1)%4].x-p.x,y:points[(i+1)%4].y-p.y}));
  return vectors.every((v,i)=>Math.abs(v.x*vectors[(i+1)%4].x+v.y*vectors[(i+1)%4].y) < 1e-6);
}
