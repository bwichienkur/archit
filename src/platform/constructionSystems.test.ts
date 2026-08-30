import { describe, expect, it } from 'vitest';
import type { ArchitecturalWall, BuildingModelV2 } from '../domain/building';
import { calculateBuildingTakeoff } from '../builder/modelTakeoff';
import { solveCabinetRun } from '../builder/cabinetLayout';
import { linearDimensionValue, validateAnnotation } from '../annotations/model';
import { transitionApproval } from '../builder/approvals';

const wall:ArchitecturalWall={id:'w',levelId:'l',name:'Wall',start:{x:0,y:0},end:{x:12,y:0},thickness:.5,height:9,baseElevation:0,wallType:'interior',openingIds:['d'],lineage:{sourceCadEntityIds:[],validationState:'confirmed'}};
function model():BuildingModelV2{return{schemaVersion:2,projectId:'p',projectName:'x',units:'imperial',geometryUnits:'feet',levels:[{id:'l',name:'Ground',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9}],walls:[wall],openings:[{id:'d',kind:'door',hostWallId:'w',offsetFromWallStart:2,width:3,height:7,lineage:{sourceCadEntityIds:[],validationState:'confirmed'}}],rooms:[{id:'r',levelId:'l',name:'Room',roomType:'kitchen',boundary:[{x:0,y:0},{x:12,y:0},{x:12,y:10},{x:0,y:10}],ceilingHeight:9,lineage:{sourceCadEntityIds:[],validationState:'confirmed'}}],stairs:[],roofPlanes:[],cabinets:[],fixtures:[]};}

describe('construction systems',()=>{
  it('aggregates whole-building takeoffs',()=>{const t=calculateBuildingTakeoff(model());expect(t.wallGrossArea).toBe(108);expect(t.wallOpeningArea).toBe(21);expect(t.floorArea).toBe(120);expect(t.doorCount).toBe(1);});
  it('solves cabinet runs and filler width',()=>{const result=solveCabinetRun(wall,[{id:'c1',kind:'base',width:3,depth:2,height:3},{id:'c2',kind:'sink-base',width:3,depth:2,height:3}],1,1,'r');expect(result.issues).toEqual([]);expect(result.fillerWidth).toBe(4);expect(result.cabinets[1].offsetFromWallStart).toBe(4);});
  it('validates and measures authored annotations',()=>{const annotation={id:'a',projectId:'p',levelId:'l',kind:'linear-dimension' as const,points:[{x:0,y:0},{x:3,y:4}],targetIds:['w'],style:{textHeight:.1,arrowSize:.1,lineWeight:.01},createdBy:'u',createdAt:'x',updatedAt:'x'};expect(validateAnnotation(annotation)).toEqual([]);expect(linearDimensionValue(annotation)).toBe(5);});
  it('enforces role-aware approval transitions',()=>{expect(transitionApproval('draft','customer-approved',{userId:'c',role:'customer'})).toBe('customer-approved');expect(()=>transitionApproval('customer-approved','locked',{userId:'c',role:'customer'})).toThrow();});
});
