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
    expect(wall.thickness).toBeCloseTo(8);
    expect(wall.start.y).toBeCloseTo(4);
    expect(wall.height).toBeCloseTo(120);
    expect(wall.evidence.sourceCadEntityIds).toEqual(['a', 'b']);
    expect(wall.validationState).toBe('inferred');
  });

  it('scales physical thresholds and default height for metric drawings', () => {
    const metric: CadDocument = {
      ...document,
      drawingUnits: 'millimeters',
      bounds: { min: { x: 0, y: 0 }, max: { x: 3048, y: 203.2 } },
      entities: document.entities.map((entity, index) => ({
        ...entity,
        id: `mm-${entity.id}`,
        geometry: index === 0
          ? { start: { x: 0, y: 0 }, end: { x: 3048, y: 0 } }
          : { start: { x: 0, y: 203.2 }, end: { x: 3048, y: 203.2 } },
        bounds: index === 0
          ? { min: { x: 0, y: 0 }, max: { x: 3048, y: 0 } }
          : { min: { x: 0, y: 203.2 }, max: { x: 3048, y: 203.2 } },
      })),
    };

    const result = detectWallCandidates(metric);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].thickness).toBeCloseTo(203.2);
    expect(result.candidates[0].height).toBeCloseTo(3048);
  });
});
