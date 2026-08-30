import { describe, expect, it } from 'vitest';
import type { BuildingModelV2 } from './building';
import { buildRoomSurfaces } from './roomSurfaces';

function model(): BuildingModelV2 {
  return {
    schemaVersion:2, projectId:'p1', projectName:'Surfaces', units:'imperial', geometryUnits:'feet',
    levels:[{id:'ground',name:'Ground',elevation:2,floorToFloorHeight:10,defaultCeilingHeight:9}],
    walls:[], openings:[],
    rooms:[{
      id:'room:1',levelId:'ground',name:'Kitchen',roomType:'kitchen',
      boundary:[{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}],ceilingHeight:9,
      lineage:{sourceCadEntityIds:['cad:1'],validationState:'confirmed'},
    }],
    stairs:[],roofPlanes:[],cabinets:[],fixtures:[],
  };
}

describe('buildRoomSurfaces', () => {
  it('derives floor and ceiling polygons at level-relative elevations', () => {
    const surfaces = buildRoomSurfaces(model());
    expect(surfaces).toHaveLength(2);
    expect(surfaces[0]).toMatchObject({kind:'floor',roomId:'room:1',elevation:2});
    expect(surfaces[1]).toMatchObject({kind:'ceiling',roomId:'room:1',elevation:11});
    expect(surfaces[0].boundary).toEqual([{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}]);
  });

  it('does not alias the mutable room boundary array', () => {
    const source = model();
    const surfaces = buildRoomSurfaces(source);
    surfaces[0].boundary[0].x = 99;
    expect(source.rooms[0].boundary[0].x).toBe(0);
  });

  it('rejects broken room references', () => {
    const source = model();
    source.rooms[0] = {...source.rooms[0],levelId:'missing'};
    expect(() => buildRoomSurfaces(source)).toThrow(/missing level/i);
  });
});
