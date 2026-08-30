import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../cad/types';
import { detectOpeningCandidates } from './openingDetector';
import type { WallCandidate } from './types';

const wall: WallCandidate = {
  id: 'wall-candidate-1', kind: 'wall', start: { x: 0, y: 0 }, end: { x: 120, y: 0 },
  thickness: 6, height: 108,
  evidence: { sourceCadEntityIds: ['wall-a','wall-b'], method: 'parallel-line-pair', confidence: 0.9 },
  validationState: 'inferred',
};

function baseDocument(): CadDocument {
  return {
    schemaVersion: 2, sourceFileName: 'openings.dwg', sourceSha256: 'abc', drawingUnits: 'inches',
    bounds: { min: { x: 0, y: -10 }, max: { x: 120, y: 20 } }, blocks: [], warnings: [],
    layers: [{ id: 'doors', name: 'A-DOOR', visible: true, locked: false }], entities: [],
  };
}

describe('detectOpeningCandidates', () => {
  it('classifies a door block with explicit dimensions and hosts it to the nearest wall', () => {
    const document = baseDocument();
    document.entities = [{
      id: 'door-entity', sourceHandle: 'D1', type: 'block-reference', layerId: 'doors',
      sourceBlockName: 'Single Door',
      bounds: { min: { x: 42, y: -2 }, max: { x: 78, y: 2 } },
      geometry: { affine2d: [1,0,0,1,60,0], blockName: 'Single Door' },
      properties: { Width: 36, Height: 80, Style: 'single-flush' },
    }];

    const result = detectOpeningCandidates(document, [wall]);
    expect(result.candidates).toHaveLength(1);
    const opening = result.candidates[0];
    expect(opening.kind).toBe('door');
    if (opening.kind !== 'door' && opening.kind !== 'window') throw new Error('Expected opening');
    expect(opening.hostWallCandidateId).toBe(wall.id);
    expect(opening.offsetFromWallStart).toBeCloseTo(42);
    expect(opening.width).toBe(36);
    expect(opening.height).toBe(80);
    expect(opening.evidence.method).toBe('classified-block-name');
  });

  it('prefers explicit semantic metadata and preserves window sill height', () => {
    const document = baseDocument();
    document.entities = [{
      id: 'window-entity', sourceHandle: 'W1', type: 'block-reference', layerId: 'doors',
      sourceBlockName: 'Generic Opening',
      bounds: { min: { x: 20, y: -2 }, max: { x: 56, y: 2 } },
      geometry: { position: { x: 38, y: 0 } },
      properties: { SemanticType: 'Window', Width: 36, Height: 48, SillHeight: 36 },
    }];

    const result = detectOpeningCandidates(document, [wall]);
    expect(result.candidates[0]?.kind).toBe('window');
    const opening = result.candidates[0];
    if (!opening || (opening.kind !== 'door' && opening.kind !== 'window')) throw new Error('Expected opening');
    expect(opening.sillHeight).toBe(36);
    expect(opening.evidence.method).toBe('explicit-opening-metadata');
  });

  it('does not invent dimensions for opening-like blocks', () => {
    const document = baseDocument();
    document.entities = [{
      id: 'door-no-size', sourceHandle: 'D2', type: 'block-reference', layerId: 'doors',
      sourceBlockName: 'Door', bounds: { min: { x: 50, y: 0 }, max: { x: 51, y: 1 } },
      geometry: { position: { x: 50, y: 0 } }, properties: {},
    }];

    const result = detectOpeningCandidates(document, [wall]);
    expect(result.candidates).toHaveLength(0);
    expect(result.warnings[0]).toContain('no explicit positive width/height metadata');
  });
});
