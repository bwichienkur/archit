import { describe, expect, it } from 'vitest';
import { validateNormalizedCad } from './validation';
import type { CadDocument } from './types';

const doc: CadDocument = {
  schemaVersion: 2,
  sourceFileName: 'plan.dwg',
  sourceSha256: 'abc',
  drawingUnits: 'inches',
  bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 80 } },
  layers: [{ id: 'l1', name: 'WALLS', visible: true, locked: false }],
  blocks: [],
  entities: [{
    id: 'e1', sourceHandle: 'A1', type: 'line', layerId: 'l1',
    bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 0 } },
    geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }, properties: {},
  }],
  warnings: [],
};

describe('validateNormalizedCad', () => {
  it('passes exact source metadata', () => {
    const result = validateNormalizedCad(doc, { entityCount: 1, bounds: doc.bounds });
    expect(result.passed).toBe(true);
    expect(result.boundsDelta).toBe(0);
  });

  it('fails when normalized entity count differs', () => {
    const result = validateNormalizedCad(doc, { entityCount: 2, bounds: doc.bounds });
    expect(result.passed).toBe(false);
    expect(result.issues.some(x => x.code === 'ENTITY_COUNT_MISMATCH')).toBe(true);
  });
});
