import { describe, expect, it } from 'vitest';
import { createBuildingModelFromCandidates } from './acceptance';
import type { RoomCandidate, WallCandidate } from './types';

const wall: WallCandidate = {
  id: 'candidate-wall-1',
  kind: 'wall',
  start: { x: 0, y: 0 },
  end: { x: 12, y: 0 },
  thickness: 0.5,
  evidence: { sourceCadEntityIds: ['cad:a','cad:b'], method: 'parallel-lines', confidence: 0.88 },
  validationState: 'inferred',
};

const room: RoomCandidate = {
  id: 'candidate-room-1',
  kind: 'room',
  boundary: [{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}],
  evidence: { sourceCadEntityIds: ['cad:a','cad:b','cad:c','cad:d'], method: 'closed-wall-centerline-face', confidence: 0.75 },
  validationState: 'inferred',
};

describe('semantic acceptance', () => {
  it('only converts explicitly accepted candidates', () => {
    const model = createBuildingModelFromCandidates([wall, room], new Set([wall.id]), {
      projectId: 'p1', projectName: 'Test', units: 'imperial', geometryUnits: 'feet',
    });

    expect(model.walls).toHaveLength(1);
    expect(model.rooms).toHaveLength(0);
    expect(model.geometryUnits).toBe('feet');
    expect(model.walls[0].lineage.sourceCadEntityIds).toEqual(['cad:a','cad:b']);
    expect(model.walls[0].lineage.validationState).toBe('confirmed');
  });

  it('preserves semantic evidence and converts level defaults into drawing units', () => {
    const model = createBuildingModelFromCandidates([room], new Set([room.id]), {
      projectId: 'p1', projectName: 'Test', units: 'metric', geometryUnits: 'millimeters',
    });

    expect(model.rooms[0].lineage.inferenceMethod).toBe('closed-wall-centerline-face');
    expect(model.rooms[0].lineage.confidence).toBe(0.75);
    expect(model.levels[0].defaultCeilingHeight).toBeCloseTo(2743.2);
  });

  it('requires explicit dimensions for unitless drawings', () => {
    expect(() => createBuildingModelFromCandidates([wall], new Set([wall.id]), {
      projectId: 'p1', projectName: 'Unitless', units: 'imperial', geometryUnits: 'unitless',
    })).toThrow(/unitless drawing/i);
  });
});
