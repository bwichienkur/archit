import { describe, expect, it } from 'vitest';
import { isBuildingModelV2 } from './modelGuard';

function model(){
  return {
    schemaVersion:2,
    projectId:'project-1',
    projectName:'House',
    units:'imperial',
    geometryUnits:'feet',
    levels:[],walls:[],openings:[],rooms:[],stairs:[],roofPlanes:[],cabinets:[],fixtures:[],
  };
}

describe('persisted BuildingModelV2 guard',()=>{
  it('accepts a complete schema v2 building snapshot',()=>{
    expect(isBuildingModelV2(model())).toBe(true);
  });

  it('rejects CAD import manifests and incomplete snapshots',()=>{
    expect(isBuildingModelV2({schemaVersion:1,kind:'cad-import',importJobId:'job'})).toBe(false);
    const incomplete={...model()} as Record<string,unknown>;
    delete incomplete.walls;
    expect(isBuildingModelV2(incomplete)).toBe(false);
  });
});
