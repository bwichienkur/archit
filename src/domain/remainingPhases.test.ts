import { describe, expect, it } from 'vitest';
import type { BuildingModelV2 } from './building';
import { validateLevels } from './levels';
import { solveStair } from './stairSolver';
import { roofSlopeArea, solveRectangularGableRoof } from './roofSolver';
import { exportLevelToSvg } from '../export/svgFloorPlan';

function model(): BuildingModelV2 { return {
  schemaVersion:2, projectId:'p', projectName:'House', units:'imperial', geometryUnits:'feet',
  levels:[{id:'l1',name:'Ground',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9},{id:'l2',name:'Second',elevation:10,floorToFloorHeight:10,defaultCeilingHeight:9}],
  walls:[{id:'w1',levelId:'l1',name:'South',start:{x:0,y:0},end:{x:20,y:0},thickness:.5,height:9,baseElevation:0,wallType:'exterior',openingIds:[],lineage:{sourceCadEntityIds:['cad:1'],validationState:'confirmed'}}],
  openings:[], rooms:[{id:'r1',levelId:'l1',name:'Living',roomType:'living',boundary:[{x:0,y:0},{x:20,y:0},{x:20,y:10},{x:0,y:10}],ceilingHeight:9,lineage:{sourceCadEntityIds:['cad:1'],validationState:'confirmed'}}], stairs:[], roofPlanes:[], cabinets:[], fixtures:[]
}; }

describe('remaining BIM kernels',()=>{
  it('validates level references and dimensions',()=>{ expect(validateLevels(model())).toEqual([]); const broken=model(); broken.walls[0]={...broken.walls[0],levelId:'missing'}; expect(validateLevels(broken)[0].code).toBe('orphan-wall'); });
  it('solves stair rise deterministically',()=>{ const stair=solveStair(model(),{id:'s1',fromLevelId:'l1',toLevelId:'l2',kind:'straight',origin:{x:0,y:0},rotation:0,width:3.5},{targetRiserHeight:.5833,maximumRiserHeight:.625,minimumTreadDepth:.8333,minimumWidth:3}); expect(stair.totalRise).toBe(10); expect(stair.riserHeight).toBeLessThanOrEqual(.625); expect(stair.riserCount).toBeGreaterThan(0); });
  it('solves rectangular gable roof and slope area',()=>{ const roof=solveRectangularGableRoof({idPrefix:'roof',levelId:'l2',footprint:[{x:0,y:0},{x:30,y:0},{x:30,y:20},{x:0,y:20}],baseElevation:20,pitchRisePerRun:.5,overhang:1,ridgeDirection:'long-axis'}); expect(roof.planes).toHaveLength(2); expect(roof.ridgeElevation).toBeCloseTo(25.5); expect(roofSlopeArea(roof.planes[0])).toBeGreaterThan(300); });
  it('exports source-lineage SVG',()=>{ const svg=exportLevelToSvg(model(),{levelId:'l1',includeSourceLineage:true}); expect(svg).toContain('<svg'); expect(svg).toContain('data-source-cad="cad:1"'); expect(svg).toContain('Living'); });
});
