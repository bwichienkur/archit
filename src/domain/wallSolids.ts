import type { ArchitecturalWall, WallOpening } from './building';
import { validateHostedOpening, wallLength } from './wallGraph';

export type WallSolidSegment = {
  startDistance: number;
  length: number;
  bottom: number;
  height: number;
  role: 'full' | 'sill' | 'lintel';
  openingId?: string;
};

export function decomposeWallSolids(wall: ArchitecturalWall, openings: WallOpening[]): WallSolidSegment[] {
  const hosted = openings
    .filter(opening => opening.hostWallId === wall.id)
    .slice()
    .sort((a, b) => a.offsetFromWallStart - b.offsetFromWallStart);
  const length = wallLength(wall);
  const solids: WallSolidSegment[] = [];
  let cursor = 0;

  for (const opening of hosted) {
    const issues = validateHostedOpening(opening, wall);
    if (issues.length) throw new Error(`Cannot generate wall ${wall.id}: opening ${opening.id} is invalid: ${issues.join(' ')}`);
    if (opening.offsetFromWallStart < cursor - 1e-8) {
      throw new Error(`Cannot generate wall ${wall.id}: opening ${opening.id} overlaps another hosted opening.`);
    }

    const beforeLength = opening.offsetFromWallStart - cursor;
    if (beforeLength > 0) solids.push({ startDistance: cursor, length: beforeLength, bottom: 0, height: wall.height, role: 'full' });

    const sill = opening.kind === 'window' ? opening.sillHeight ?? 0 : 0;
    if (sill > 0) solids.push({
      startDistance: opening.offsetFromWallStart,
      length: opening.width,
      bottom: 0,
      height: sill,
      role: 'sill',
      openingId: opening.id,
    });

    const top = sill + opening.height;
    if (top < wall.height) solids.push({
      startDistance: opening.offsetFromWallStart,
      length: opening.width,
      bottom: top,
      height: wall.height - top,
      role: 'lintel',
      openingId: opening.id,
    });

    cursor = opening.offsetFromWallStart + opening.width;
  }

  if (cursor < length) solids.push({ startDistance: cursor, length: length - cursor, bottom: 0, height: wall.height, role: 'full' });
  return solids.filter(segment => segment.length > 0 && segment.height > 0);
}
