import { describe, expect, it } from 'vitest';
import type { ArchitecturalWall, WallOpening } from './building';
import { decomposeWallSolids } from './wallSolids';

const wall: ArchitecturalWall = {
  id: 'wall:1', levelId: 'level:ground', name: 'Wall', start: {x:0,y:0}, end: {x:12,y:0},
  thickness: .5, height: 9, baseElevation: 0, wallType: 'interior', openingIds: [],
  lineage: { sourceCadEntityIds: [], validationState: 'confirmed' },
};

function opening(patch: Partial<WallOpening>): WallOpening {
  return {
    id: 'opening:1', kind: 'door', hostWallId: wall.id, offsetFromWallStart: 3,
    width: 3, height: 7, lineage: { sourceCadEntityIds: [], validationState: 'confirmed' }, ...patch,
  };
}

describe('decomposeWallSolids', () => {
  it('creates full-height wall spans plus a lintel over a door', () => {
    const solids = decomposeWallSolids(wall, [opening({})]);
    expect(solids.filter(item => item.role === 'full')).toHaveLength(2);
    expect(solids.find(item => item.role === 'lintel')).toMatchObject({ startDistance: 3, length: 3, bottom: 7, height: 2 });
  });

  it('creates sill and lintel solids around a window', () => {
    const solids = decomposeWallSolids(wall, [opening({ kind: 'window', offsetFromWallStart: 4, width: 4, height: 4, sillHeight: 3 })]);
    expect(solids.find(item => item.role === 'sill')).toMatchObject({ startDistance: 4, length: 4, bottom: 0, height: 3 });
    expect(solids.find(item => item.role === 'lintel')).toMatchObject({ startDistance: 4, length: 4, bottom: 7, height: 2 });
  });

  it('rejects overlapping hosted openings', () => {
    expect(() => decomposeWallSolids(wall, [
      opening({ id:'a', offsetFromWallStart: 2, width: 4 }),
      opening({ id:'b', offsetFromWallStart: 5, width: 3 }),
    ])).toThrow(/overlaps/i);
  });
});
