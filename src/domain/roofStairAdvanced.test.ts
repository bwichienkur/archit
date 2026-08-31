import { describe, expect, it } from 'vitest';
import { solveRectangularRoof } from './roofAdvanced';
import { layoutStair } from './stairAdvanced';
import type { SolvedStair } from './stairSolver';

const footprint=[{x:0,y:0},{x:20,y:0},{x:20,y:10},{x:0,y:10}] as const;

describe('advanced roof solving',()=>{
  it('solves flat and shed roofs deterministically',()=>{
    const flat=solveRectangularRoof({idPrefix:'r',levelId:'l',footprint:[...footprint],kind:'flat',baseElevation:10,pitch:0,overhang:1});
    expect(flat.planes).toHaveLength(1);expect(flat.maximumElevation).toBe(10);
    const shed=solveRectangularRoof({idPrefix:'r',levelId:'l',footprint:[...footprint],kind:'shed',baseElevation:10,pitch:.25,overhang:1,slopeAxis:'bc'});
    expect(shed.planes[0].riseDirection).toBeDefined();expect(shed.maximumElevation).toBeCloseTo(13);
  });
  it('solves hip roofs with a ridge on non-square footprints',()=>{
    const hip=solveRectangularRoof({idPrefix:'r',levelId:'l',footprint:[...footprint],kind:'hip',baseElevation:10,pitch:.5,overhang:0,slopeAxis:'bc'});
    expect(hip.planes).toHaveLength(4);expect(hip.ridgeSegments).toHaveLength(1);expect(hip.maximumElevation).toBeCloseTo(12.5);
  });
});

describe('advanced stair layouts',()=>{
  const base:SolvedStair={id:'s',fromLevelId:'l1',toLevelId:'l2',kind:'straight',origin:{x:0,y:0},rotation:0,width:3,riserHeight:.6,treadDepth:.9,riserCount:16,totalRise:9.6,totalRun:13.5,landingCount:0};
  it('keeps straight stairs as one flight',()=>{const result=layoutStair(base);expect(result.flights).toHaveLength(1);expect(result.landings).toHaveLength(0);});
  it('creates a landing and second flight for L and U stairs',()=>{
    const l=layoutStair({...base,kind:'l',landingCount:1});expect(l.flights).toHaveLength(2);expect(l.landings).toHaveLength(1);expect(l.flights[1].rotation).toBeCloseTo(Math.PI/2);
    const u=layoutStair({...base,kind:'u',landingCount:1});expect(u.flights).toHaveLength(2);expect(u.landings[0].width).toBe(6);expect(u.flights[1].rotation).toBeCloseTo(Math.PI);
  });
  it('models winders as two turning flights without a landing',()=>{const w=layoutStair({...base,kind:'winder'});expect(w.flights).toHaveLength(2);expect(w.landings).toHaveLength(0);});
});
