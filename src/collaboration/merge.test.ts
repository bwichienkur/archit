import { describe,expect,it } from 'vitest';
import type { BuildingModelV2 } from '../domain/building';
import { analyzeRevisionConflicts } from './conflicts';
import { conflictKey,mergeBuildingModels } from './merge';

function model():BuildingModelV2{return{schemaVersion:2,projectId:'p',projectName:'House',units:'imperial',geometryUnits:'feet',levels:[{id:'l1',name:'Level 1',elevation:0,defaultWallHeight:10,defaultCeilingHeight:9}],walls:[{id:'w1',levelId:'l1',name:'Wall 1',start:{x:0,y:0},end:{x:10,y:0},thickness:.5,height:10,baseElevation:0,wallType:'interior',lineage:{sourceCadEntityIds:['c1'],inferenceMethod:'test',confidence:1,validationState:'confirmed'}}],openings:[],rooms:[],stairs:[],roofPlanes:[],cabinets:[],fixtures:[]};}

describe('three-way BIM merge',()=>{
  it('merges independent property edits automatically',()=>{
    const base=model();
    const left=structuredClone(base);left.walls[0].height=11;
    const right=structuredClone(base);right.walls[0].thickness=.75;
    const result=mergeBuildingModels(base,left,right);
    expect(result.unresolved).toEqual([]);
    expect(result.model.walls[0].height).toBe(11);
    expect(result.model.walls[0].thickness).toBe(.75);
  });

  it('requires an explicit choice for competing values',()=>{
    const base=model();
    const left=structuredClone(base);left.walls[0].height=11;
    const right=structuredClone(base);right.walls[0].height=12;
    const conflicts=analyzeRevisionConflicts(base,left,right).conflicts;
    expect(conflicts).toHaveLength(1);
    const preview=mergeBuildingModels(base,left,right);
    expect(preview.unresolved).toHaveLength(1);
    expect(preview.model.walls[0].height).toBe(11);
    const resolved=mergeBuildingModels(base,left,right,{[conflictKey(conflicts[0])]:'right'});
    expect(resolved.unresolved).toEqual([]);
    expect(resolved.model.walls[0].height).toBe(12);
  });

  it('handles delete versus edit explicitly',()=>{
    const base=model();
    const left=structuredClone(base);left.walls=[];
    const right=structuredClone(base);right.walls[0].height=12;
    const conflict=analyzeRevisionConflicts(base,left,right).conflicts[0];
    const keepDeletion=mergeBuildingModels(base,left,right,{[conflictKey(conflict)]:'left'});
    expect(keepDeletion.model.walls).toEqual([]);
    const keepEdit=mergeBuildingModels(base,left,right,{[conflictKey(conflict)]:'right'});
    expect(keepEdit.model.walls[0].height).toBe(12);
  });
});
