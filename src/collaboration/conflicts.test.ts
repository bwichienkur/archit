import { describe, expect, it } from 'vitest';
import { analyzeRevisionConflicts } from './conflicts';
import type { BuildingModelV2 } from '../domain/building';

function model():BuildingModelV2{return{schemaVersion:2,projectId:'p',projectName:'P',units:'imperial',geometryUnits:'feet',levels:[{id:'l',name:'L1',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9}],walls:[{id:'w',levelId:'l',name:'Wall',start:{x:0,y:0},end:{x:10,y:0},thickness:.5,height:9,baseElevation:0,wallType:'interior',openingIds:[],lineage:{sourceCadEntityIds:[],validationState:'confirmed'}}],openings:[],rooms:[],stairs:[],roofPlanes:[],cabinets:[],fixtures:[]};}

describe('revision conflict analysis',()=>{
  it('allows changes to different properties of the same object',()=>{const base=model();const left=model();left.walls[0]={...left.walls[0],height:10};const right=model();right.walls[0]={...right.walls[0],thickness:.75};const result=analyzeRevisionConflicts(base,left,right);expect(result.conflicts).toHaveLength(0);expect(result.compatible).toBeGreaterThan(0);});
  it('flags different edits to the same property',()=>{const base=model();const left=model();left.walls[0]={...left.walls[0],height:10};const right=model();right.walls[0]={...right.walls[0],height:11};const result=analyzeRevisionConflicts(base,left,right);expect(result.conflicts).toHaveLength(1);expect(result.conflicts[0].path).toBe('$.height');expect(result.conflicts[0].reason).toBe('different-values');});
  it('flags delete versus edit',()=>{const base=model();const left=model();left.walls=[];const right=model();right.walls[0]={...right.walls[0],height:11};expect(analyzeRevisionConflicts(base,left,right).conflicts[0].reason).toBe('delete-vs-edit');});
});
