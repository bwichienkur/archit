import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../cad/types';
import { detectWallCandidates } from './wallDetector';

const document: CadDocument = {
  schemaVersion: 2,
  sourceFileName: 'walls.dwg', sourceSha256: 'x', drawingUnits: 'inches',
  bounds: { min: { x: 0, y: 0 }, max: { x: 120, y: 8 } },
  layers: [{ id: 'walls', name: 'WALLS', visible: true, locked: false }],
  blocks: [], warnings: [],
  entities: [
    { id: 'a', sourceHandle: '1', type: 'line', layerId: 'walls', bounds: { min: { x: 0, y: 0 }, max: { x: 120, y: 0 } }, geometry: { start: { x: 0, y: 0 }, end: { x: 120, y: 0 } }, properties: {} },
    { id: 'b', sourceHandle: '2', type: 'line', layerId: 'walls', bounds: { min: { x: 0, y: 8 }, max: { x: 120, y: 8 } }, geometry: { start: { x: 0, y: 8 }, end: { x: 120, y: 8 } }, properties: {} },
  ],
};

describe('detectWallCandidates', () => {
  it('creates a centerline wall from parallel CAD lines', () => {
    const result = detectWallCandidates(document);
    expect(result.candidates).toHaveLength(1);
    const wall = result.candidates[0];
    expect(wall.kind).toBe('wall');
    if (wall.kind !== 'wall') throw new Error('Expected wall');
    expect(wall.thickness).toBeCloseTo(8);
    expect(wall.start.y).toBeCloseTo(4);
    expect(wall.evidence.sourceCadEntityIds).toEqual(['a', 'b']);
    expect(wall.validationState).toBe('inferred');
  });
});
