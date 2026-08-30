import { describe, expect, it } from 'vitest';
import { createBuildingModelFromCandidates } from './acceptance';
import type { OpeningCandidate, RoomCandidate, WallCandidate } from './types';

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

const door: OpeningCandidate = {
  id: 'candidate-door-1', kind: 'door', center: { x: 5, y: 0 }, width: 3, height: 6.67,
  hostWallCandidateId: wall.id, offsetFromWallStart: 3.5, subtype: 'single',
  evidence: { sourceCadEntityIds: ['cad:door'], method: 'classified-block-name', confidence: 0.82 },
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

  it('promotes a hosted opening only when its wall is also accepted', () => {
    const model = createBuildingModelFromCandidates([wall, door], new Set([wall.id, door.id]), {
      projectId: 'p1', projectName: 'Test', units: 'imperial', geometryUnits: 'feet',
    });

    expect(model.openings).toHaveLength(1);
    expect(model.openings[0].hostWallId).toBe(`wall:${wall.id}`);
    expect(model.openings[0].offsetFromWallStart).toBeCloseTo(3.5);
    expect(model.walls[0].openingIds).toEqual([`opening:${door.id}`]);
    expect(model.openings[0].lineage.sourceCadEntityIds).toEqual(['cad:door']);
  });

  it('rejects an accepted opening whose host wall was not accepted', () => {
    expect(() => createBuildingModelFromCandidates([wall, door], new Set([door.id]), {
      projectId: 'p1', projectName: 'Test', units: 'imperial', geometryUnits: 'feet',
    })).toThrow(/wall candidate that was not accepted/i);
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
