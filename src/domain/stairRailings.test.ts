import { describe,expect,it } from 'vitest';
import { layoutStair } from './stairAdvanced';
import { buildStairRailingPaths } from './stairRailings';
import type { SolvedStair } from './stairSolver';

const base:SolvedStair={id:'s',fromLevelId:'l1',toLevelId:'l2',kind:'straight',origin:{x:0,y:0},rotation:0,width:4,riserHeight:.6,treadDepth:1,riserCount:10,totalRise:6,totalRun:9,landingCount:0};

describe('stair railing paths',()=>{
  it('creates both side rails for a straight flight',()=>{
    const rails=buildStairRailingPaths(layoutStair(base),{guardHeight:3.5});
    expect(rails).toHaveLength(2);
    expect(rails[0].guardHeight).toBe(3.5);
    expect(rails[0].end.x-rails[0].start.x).toBeCloseTo(9);
    expect(rails[0].endElevation).toBeCloseTo(6);
  });

  it('creates rails for every flight of an L stair',()=>{
    const rails=buildStairRailingPaths(layoutStair({...base,kind:'l',landingCount:1}));
    expect(rails).toHaveLength(4);
    expect(new Set(rails.map(rail=>rail.flightId)).size).toBe(2);
  });

  it('supports one-sided railings',()=>{
    const rails=buildStairRailingPaths(layoutStair(base),{right:false});
    expect(rails).toHaveLength(1);
    expect(rails[0].side).toBe('left');
  });
});
