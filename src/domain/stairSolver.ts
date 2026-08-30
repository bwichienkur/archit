import type { BuildingModelV2, Point2, Stair } from './building';
import { levelHeightDelta } from './levels';

export type StairSolveOptions = {
  targetRiserHeight: number;
  minimumTreadDepth: number;
  maximumRiserHeight: number;
  minimumWidth: number;
};

export type SolvedStair = Stair & {
  totalRise: number;
  totalRun: number;
  landingCount: number;
};

export function solveStair(
  model: Pick<BuildingModelV2,'levels'>,
  input: { id:string; fromLevelId:string; toLevelId:string; kind:Stair['kind']; origin:Point2; rotation:number; width:number },
  options: StairSolveOptions,
): SolvedStair {
  const rise = levelHeightDelta(model, input.fromLevelId, input.toLevelId);
  if (!(rise > 0)) throw new Error('Stairs must rise to a higher level.');
  if (input.width < options.minimumWidth) throw new Error('Stair width is below the configured minimum.');
  const riserCount = Math.max(1, Math.ceil(rise / options.targetRiserHeight));
  const riserHeight = rise / riserCount;
  if (riserHeight > options.maximumRiserHeight) throw new Error('No valid riser count satisfies the maximum riser height.');
  const treadDepth = options.minimumTreadDepth;
  const treadCount = Math.max(1, riserCount - 1);
  const landingCount = input.kind === 'straight' ? 0 : input.kind === 'l' ? 1 : input.kind === 'u' ? 1 : 0;
  const totalRun = treadCount * treadDepth;
  return { ...input, riserHeight, treadDepth, riserCount, totalRise:rise, totalRun, landingCount };
}

export function stairFootprint(stair: SolvedStair): Point2[] {
  const run = stair.totalRun;
  const width = stair.width;
  const c = Math.cos(stair.rotation), s = Math.sin(stair.rotation);
  const local = [{x:0,y:0},{x:run,y:0},{x:run,y:width},{x:0,y:width}];
  return local.map(point => ({ x:stair.origin.x + point.x*c - point.y*s, y:stair.origin.y + point.x*s + point.y*c }));
}
