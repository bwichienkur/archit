import { describe, expect, it } from 'vitest';
import type { BuildingModelV2 } from './building';
import { buildOpeningSchedule, buildOpeningScheduleCsv } from './schedules';

function model(): BuildingModelV2 {
  return {
    schemaVersion: 2, projectId: 'p1', projectName: 'Schedule', units: 'imperial', geometryUnits: 'feet',
    levels: [{ id:'l1', name:'Ground Floor', elevation:0, floorToFloorHeight:10, defaultCeilingHeight:9 }],
    walls: [
      { id:'w-a', levelId:'l1', name:'A Wall', start:{x:0,y:0}, end:{x:20,y:0}, thickness:.5, height:9, baseElevation:0, wallType:'interior', openingIds:['door-b','door-a'], lineage:{sourceCadEntityIds:[],validationState:'confirmed'} },
      { id:'w-b', levelId:'l1', name:'B Wall', start:{x:20,y:0}, end:{x:20,y:15}, thickness:.5, height:9, baseElevation:0, wallType:'exterior', openingIds:['window-a'], lineage:{sourceCadEntityIds:[],validationState:'confirmed'} },
    ],
    openings: [
      { id:'door-b', kind:'door', hostWallId:'w-a', offsetFromWallStart:10, width:3, height:7, handing:'right', swing:'in', subtype:'flush', lineage:{sourceCadEntityIds:['cad:d2'],validationState:'modified'} },
      { id:'window-a', kind:'window', hostWallId:'w-b', offsetFromWallStart:5, width:4, height:4, sillHeight:3, subtype:'single-hung', lineage:{sourceCadEntityIds:['cad:w1'],validationState:'confirmed'} },
      { id:'door-a', kind:'door', hostWallId:'w-a', offsetFromWallStart:2, width:3, height:7, handing:'left', swing:'out', lineage:{sourceCadEntityIds:['cad:d1'],validationState:'confirmed'} },
    ],
    rooms: [], stairs: [], roofPlanes: [], cabinets: [], fixtures: [],
  };
}

describe('buildOpeningSchedule', () => {
  it('sorts openings deterministically and assigns type-specific marks', () => {
    const rows = buildOpeningSchedule(model());
    expect(rows.map(row => row.openingId)).toEqual(['door-a','door-b','window-a']);
    expect(rows.map(row => row.mark)).toEqual(['D01','D02','W01']);
  });

  it('preserves construction fields and CAD lineage', () => {
    const rows = buildOpeningSchedule(model());
    expect(rows[0]).toMatchObject({ hostWallName:'A Wall', levelName:'Ground Floor', width:3, height:7, handing:'left', swing:'out' });
    expect(rows[2]).toMatchObject({ kind:'window', sillHeight:3, subtype:'single-hung' });
    expect(rows[1].sourceCadEntityIds).toEqual(['cad:d2']);
    expect(rows[1].validationState).toBe('modified');
  });

  it('exports stable construction CSV with units and lineage', () => {
    const csv = buildOpeningScheduleCsv(model());
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Mark,Type,Level,Host Wall,Width,Height,Sill Height,Units,Subtype,Handing,Swing,Validation State,Opening ID,Source CAD Entity IDs');
    expect(lines[1]).toContain('D01,door,Ground Floor,A Wall,3,7,,feet,,left,out,confirmed,door-a,cad:d1');
    expect(lines[3]).toContain('W01,window,Ground Floor,B Wall,4,4,3,feet,single-hung,,,confirmed,window-a,cad:w1');
  });

  it('escapes commas and quotes in schedule CSV fields', () => {
    const source = model();
    source.walls[0] = { ...source.walls[0], name: 'Entry, "Feature" Wall' };
    const csv = buildOpeningScheduleCsv(source);
    expect(csv).toContain('"Entry, ""Feature"" Wall"');
  });

  it('fails when model references are broken', () => {
    const broken = model();
    broken.openings[0] = { ...broken.openings[0], hostWallId:'missing' };
    expect(() => buildOpeningSchedule(broken)).toThrow(/missing host wall/i);
  });
});
