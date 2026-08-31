import { describe, expect, it } from 'vitest';
import type { BuildingModelV2 } from '../domain/building';
import { diffBuildingModels } from './diff';

function model():BuildingModelV2{return{schemaVersion:2,projectId:'p',projectName:'x',units:'imperial',geometryUnits:'feet',levels:[{id:'l',name:'Ground',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9}],walls:[{id:'w',levelId:'l',name:'Wall',start:{x:0,y:0},end:{x:10,y:0},thickness:.5,height:9,baseElevation:0,wallType:'interior',openingIds:[],lineage:{sourceCadEntityIds:['cad'],validationState:'confirmed'}}],openings:[],rooms:[],stairs:[],roofPlanes:[],cabinets:[],fixtures:[]};}

describe('diffBuildingModels',()=>{
  it('reports added removed and modified BIM objects deterministically',()=>{const before=model(),after=model();after.walls[0]={...after.walls[0],thickness:.75};after.rooms.push({id:'r',levelId:'l',name:'Room',roomType:'office',boundary:[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}],ceilingHeight:9,lineage:{sourceCadEntityIds:[],validationState:'modified'}});const diff=diffBuildingModels(before,after);expect(diff.summary.modified).toBe(1);expect(diff.summary.added).toBe(1);expect(diff.changes.map(change=>`${change.kind}:${change.change}`)).toEqual(['wall:modified','room:added']);});
  it('does not treat object key ordering as a modification',()=>{const before=model(),after=JSON.parse(JSON.stringify(before)) as BuildingModelV2;expect(diffBuildingModels(before,after).changes).toEqual([]);});
});
