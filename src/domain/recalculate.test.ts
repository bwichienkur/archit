import { describe, expect, it } from 'vitest';
import type { ArchitecturalRoom, ArchitecturalWall, BuildingModelV2 } from './building';
import { recalculateInferredRooms } from './recalculate';

function wall(id: string, start: {x:number;y:number}, end: {x:number;y:number}): ArchitecturalWall {
  return {
    id,
    levelId: 'level:ground',
    name: id,
    start,
    end,
    thickness: 0.5,
    height: 9,
    baseElevation: 0,
    wallType: 'interior',
    openingIds: [],
    lineage: { sourceCadEntityIds: [`cad:${id}`], inferenceMethod: 'test', confidence: 0.9, validationState: 'confirmed' },
  };
}

function baseModel(): BuildingModelV2 {
  return {
    schemaVersion: 2,
    projectId: 'p1',
    projectName: 'Test',
    units: 'imperial',
    levels: [{ id: 'level:ground', name: 'Ground', elevation: 0, floorToFloorHeight: 10, defaultCeilingHeight: 9 }],
    walls: [
      wall('w1',{x:0,y:0},{x:10,y:0}), wall('w2',{x:10,y:0},{x:10,y:8}),
      wall('w3',{x:10,y:8},{x:0,y:8}), wall('w4',{x:0,y:8},{x:0,y:0}),
    ],
    openings: [], rooms: [], stairs: [], roofPlanes: [], cabinets: [], fixtures: [],
  };
}

describe('room recalculation', () => {
  it('generates an inferred room from current wall topology', () => {
    const result = recalculateInferredRooms(baseModel());
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].lineage.validationState).toBe('inferred');
  });

  it('preserves confirmed rooms while replacing inferred rooms', () => {
    const confirmed: ArchitecturalRoom = {
      id: 'room:confirmed', levelId: 'level:ground', name: 'Kitchen', roomType: 'kitchen',
      boundary: [{x:20,y:20},{x:21,y:20},{x:21,y:21},{x:20,y:21}], ceilingHeight: 9,
      lineage: { sourceCadEntityIds: [], validationState: 'confirmed' },
    };
    const model = baseModel();
    model.rooms = [confirmed, { ...confirmed, id: 'room:old-auto', lineage: { sourceCadEntityIds: [], validationState: 'inferred' } }];

    const result = recalculateInferredRooms(model);
    expect(result.rooms.some(room => room.id === 'room:confirmed')).toBe(true);
    expect(result.rooms.some(room => room.id === 'room:old-auto')).toBe(false);
    expect(result.rooms.filter(room => room.lineage.validationState === 'inferred')).toHaveLength(1);
  });
});
