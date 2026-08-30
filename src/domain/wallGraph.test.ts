import { describe, expect, it } from 'vitest';
import type { ArchitecturalWall, WallOpening } from './building';
import { buildWallJoinGraph, openingCenter, validateHostedOpening } from './wallGraph';

function wall(id: string, start: {x:number;y:number}, end: {x:number;y:number}): ArchitecturalWall {
  return {
    id,
    levelId: 'level:1',
    name: id,
    start,
    end,
    thickness: 0.5,
    height: 9,
    baseElevation: 0,
    wallType: 'interior',
    openingIds: [],
    lineage: { sourceCadEntityIds: [id], validationState: 'inferred' },
  };
}

describe('wall join graph', () => {
  it('classifies a corner and a tee', () => {
    const graph = buildWallJoinGraph([
      wall('a', {x:0,y:0}, {x:10,y:0}),
      wall('b', {x:10,y:0}, {x:10,y:10}),
      wall('c', {x:10,y:0}, {x:20,y:0}),
    ]);

    const join = graph.nodes.find(node => Math.abs(node.point.x - 10) < 1e-6 && Math.abs(node.point.y) < 1e-6);
    expect(join?.kind).toBe('tee');
    expect(join?.wallIds).toHaveLength(3);
  });
});

describe('hosted openings', () => {
  it('computes opening center along a wall', () => {
    const host = wall('host', {x:0,y:0}, {x:20,y:0});
    const opening: WallOpening = {
      id: 'door:1', kind: 'door', hostWallId: host.id,
      offsetFromWallStart: 4, width: 3, height: 7,
      lineage: { sourceCadEntityIds: [], validationState: 'modified' },
    };
    expect(openingCenter(opening, host)).toEqual({ x: 5.5, y: 0 });
    expect(validateHostedOpening(opening, host)).toEqual([]);
  });

  it('reports openings that extend beyond the host', () => {
    const host = wall('host', {x:0,y:0}, {x:10,y:0});
    const opening: WallOpening = {
      id: 'window:1', kind: 'window', hostWallId: host.id,
      offsetFromWallStart: 8, width: 4, height: 4, sillHeight: 6,
      lineage: { sourceCadEntityIds: [], validationState: 'modified' },
    };
    const issues = validateHostedOpening(opening, host);
    expect(issues.some(issue => issue.includes('beyond'))).toBe(true);
    expect(issues.some(issue => issue.includes('head'))).toBe(true);
  });
});
