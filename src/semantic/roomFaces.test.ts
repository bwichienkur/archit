import { describe, expect, it } from 'vitest';
import { polygonArea } from '../geometry/kernel';
import { resolveInteriorRoomFace } from './roomFaces';
import type { WallCandidate } from './types';

function wall(id: string, start: {x:number;y:number}, end: {x:number;y:number}, thickness = .5): WallCandidate {
  return {
    id, kind: 'wall', start, end, thickness,
    evidence: { sourceCadEntityIds: [`cad:${id}`], method: 'test', confidence: .9 },
    validationState: 'inferred',
  };
}

const walls = [
  wall('w1',{x:0,y:0},{x:10,y:0}),
  wall('w2',{x:10,y:0},{x:10,y:8}),
  wall('w3',{x:10,y:8},{x:0,y:8}),
  wall('w4',{x:0,y:8},{x:0,y:0}),
];

describe('resolveInteriorRoomFace', () => {
  it('offsets a closed centerline face inward by half each wall thickness', () => {
    const result = resolveInteriorRoomFace([{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}], walls);
    expect(result).not.toBeNull();
    expect(result!.boundary[0].x).toBeCloseTo(.25);
    expect(result!.boundary[0].y).toBeCloseTo(.25);
    expect(result!.boundary[2].x).toBeCloseTo(9.75);
    expect(result!.boundary[2].y).toBeCloseTo(7.75);
    expect(polygonArea(result!.boundary)).toBeCloseTo(9.5 * 7.5);
  });

  it('supports clockwise faces without flipping the offset outward', () => {
    const result = resolveInteriorRoomFace([{x:0,y:0},{x:0,y:8},{x:10,y:8},{x:10,y:0}], walls);
    expect(result).not.toBeNull();
    expect(polygonArea(result!.boundary)).toBeCloseTo(9.5 * 7.5);
  });

  it('returns null when an edge cannot be traced to a wall candidate', () => {
    const result = resolveInteriorRoomFace([{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}], walls.slice(0,3));
    expect(result).toBeNull();
  });
});
