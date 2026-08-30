import { describe, expect, it } from 'vitest';
import type { ArchitecturalRoom, ArchitecturalWall, BuildingModelV2 } from './building';
import { applyOpeningFamily } from './openingFamilies';
import { overrideRoomBoundary, renameRoom, roomLabelPoint } from './roomEditing';
import { addLevel, copyLevelGeometry, stackedWallPairs } from './levelOperations';
import { buildFixtureSchedule, buildRoomFinishSchedule, buildRoofSchedule, buildStairSchedule } from './advancedSchedules';

const wall:ArchitecturalWall={id:'w1',levelId:'l1',name:'Wall',start:{x:0,y:0},end:{x:10,y:0},thickness:.5,height:9,baseElevation:0,wallType:'exterior',openingIds:['d1'],lineage:{sourceCadEntityIds:['cad:w'],validationState:'confirmed'}};
const room:ArchitecturalRoom={id:'r1',levelId:'l1',name:'Room',roomType:'living',boundary:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],ceilingHeight:9,lineage:{sourceCadEntityIds:['cad:w'],validationState:'confirmed'}};
function model():BuildingModelV2{return{schemaVersion:2,projectId:'p',projectName:'x',units:'imperial',geometryUnits:'feet',levels:[{id:'l1',name:'Ground',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9}],walls:[wall],openings:[{id:'d1',kind:'door',hostWallId:'w1',offsetFromWallStart:2,width:3,height:7,lineage:{sourceCadEntityIds:['cad:d'],validationState:'confirmed'}}],rooms:[room],stairs:[],roofPlanes:[],cabinets:[],fixtures:[]};}

describe('advanced BIM domain',()=>{
  it('applies compatible opening families only',()=>{const opening=model().openings[0];const next=applyOpeningFamily(opening,{id:'f',kind:'door',name:'Pocket',operation:'pocket',nominalWidth:3.5,nominalHeight:7,metadata:{}});expect(next.width).toBe(3.5);expect(next.subtype).toBe('pocket');expect(()=>applyOpeningFamily(opening,{id:'w',kind:'window',name:'Win',operation:'fixed',nominalWidth:3,nominalHeight:4,metadata:{}})).toThrow();});
  it('supports explicit room labels and manual boundaries',()=>{expect(renameRoom(room,'Living Room').name).toBe('Living Room');const edited=overrideRoomBoundary(room,[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:0,y:8}]);expect(edited.lineage.inferenceMethod).toBe('manual-room-boundary');expect(roomLabelPoint(edited)).toEqual({x:6,y:4});});
  it('copies level geometry and finds stacked walls',()=>{let m=addLevel(model(),{id:'l2',name:'Second',elevation:10,floorToFloorHeight:10,defaultCeilingHeight:9});m=copyLevelGeometry(m,'l1','l2');expect(m.walls.filter(w=>w.levelId==='l2')).toHaveLength(1);expect(m.openings.filter(o=>o.id.includes('l2'))).toHaveLength(1);expect(stackedWallPairs(m)).toHaveLength(1);});
  it('builds advanced schedules from model truth',()=>{const m=model();m.roofPlanes=[{id:'roof',levelId:'l1',boundary:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],pitch:.5,baseElevation:9,overhang:1}];m.stairs=[{id:'s',fromLevelId:'l1',toLevelId:'l2',kind:'straight',origin:{x:0,y:0},rotation:0,width:3,riserHeight:.58,treadDepth:.83,riserCount:17}];m.fixtures=[{id:'f',levelId:'l1',roomId:'r1',category:'lighting',origin:{x:4,y:4}}];expect(buildRoomFinishSchedule(m)[0].area).toBe(80);expect(buildRoofSchedule(m)[0].slopeArea).toBeGreaterThan(80);expect(buildStairSchedule(m)[0].stairId).toBe('s');expect(buildFixtureSchedule(m)[0].roomName).toBe('Room');});
});
