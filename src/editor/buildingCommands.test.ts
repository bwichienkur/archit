import { describe, expect, it } from 'vitest';
import type { ArchitecturalWall, BuildingModelV2 } from '../domain/building';
import { BuildingCommandHistory, UpdateArchitecturalWallCommand } from './buildingCommands';

function wall(): ArchitecturalWall {
  return {
    id: 'w1', levelId: 'level:ground', name: 'Wall', start: {x:0,y:0}, end: {x:10,y:0},
    thickness: .5, height: 9, baseElevation: 0, wallType: 'interior', openingIds: [],
    lineage: { sourceCadEntityIds: ['cad:1','cad:2'], validationState: 'confirmed' },
  };
}

function model(): BuildingModelV2 {
  return {
    schemaVersion: 2, projectId: 'p1', projectName: 'Test', units: 'imperial', geometryUnits: 'feet',
    levels: [{id:'level:ground',name:'Ground',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9}],
    walls: [wall()], openings: [], rooms: [], stairs: [], roofPlanes: [], cabinets: [], fixtures: [],
  };
}

describe('BuildingModelV2 command history', () => {
  it('executes, undoes and redoes wall edits while preserving lineage', () => {
    const history = new BuildingCommandHistory();
    const before = wall();
    const after = { ...before, thickness: .75, lineage: { ...before.lineage, validationState: 'modified' as const } };
    let current = history.execute(model(), new UpdateArchitecturalWallCommand(before, after));
    expect(current.walls[0].thickness).toBe(.75);
    expect(history.canUndo).toBe(true);

    current = history.undo(current);
    expect(current.walls[0].thickness).toBe(.5);
    expect(current.walls[0].lineage.sourceCadEntityIds).toEqual(['cad:1','cad:2']);
    expect(history.canRedo).toBe(true);

    current = history.redo(current);
    expect(current.walls[0].thickness).toBe(.75);
  });
});
