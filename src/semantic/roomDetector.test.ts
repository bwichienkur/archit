import { describe, expect, it } from 'vitest';
import { polygonArea } from '../geometry/kernel';
import { detectRoomCandidates } from './roomDetector';
import type { WallCandidate } from './types';

function wall(id: string, start: {x:number;y:number}, end: {x:number;y:number}): WallCandidate {
  return {
    id,
    kind: 'wall',
    start,
    end,
    thickness: 0.5,
    evidence: { sourceCadEntityIds: [`cad:${id}`], method: 'test', confidence: 0.9 },
    validationState: 'inferred',
  };
}

describe('room detector', () => {
  it('creates a thickness-aware inferred room from a closed wall loop', () => {
    const result = detectRoomCandidates([
      wall('w1', {x:0,y:0}, {x:12,y:0}),
      wall('w2', {x:12,y:0}, {x:12,y:10}),
      wall('w3', {x:12,y:10}, {x:0,y:10}),
      wall('w4', {x:0,y:10}, {x:0,y:0}),
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].validationState).toBe('inferred');
    expect(result.candidates[0].evidence.sourceCadEntityIds).toHaveLength(4);
    expect(result.candidates[0].evidence.method).toBe('closed-wall-interior-face');
    expect(polygonArea(result.candidates[0].boundary)).toBeCloseTo(11.5 * 9.5);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not invent a room from an open wall chain', () => {
    const result = detectRoomCandidates([
      wall('w1', {x:0,y:0}, {x:12,y:0}),
      wall('w2', {x:12,y:0}, {x:12,y:10}),
      wall('w3', {x:12,y:10}, {x:0,y:10}),
    ]);

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });
});
