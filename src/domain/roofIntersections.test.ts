import { describe,expect,it } from 'vitest';
import type { RoofPlane } from './building';
import { analyzeRoofPlaneIntersections,elevationAt } from './roofIntersections';

const square=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];

describe('roof plane intersections',()=>{
  it('finds the equal-elevation seam between opposing slopes',()=>{
    const planes:RoofPlane[]=[
      {id:'a',levelId:'l1',boundary:square,pitch:.5,baseElevation:10,overhang:0,riseDirection:{x:0,y:1}},
      {id:'b',levelId:'l1',boundary:square,pitch:.5,baseElevation:10,overhang:0,riseDirection:{x:0,y:-1}},
    ];
    const seams=analyzeRoofPlaneIntersections(planes);
    expect(seams).toHaveLength(1);
    expect(seams[0].start.y).toBeCloseTo(5);
    expect(seams[0].end.y).toBeCloseTo(5);
    expect(seams[0].startElevation).toBeCloseTo(12.5);
    expect(seams[0].kind).toBe('ridge');
  });

  it('clips seams to the overlapping footprint',()=>{
    const planes:RoofPlane[]=[
      {id:'a',levelId:'l1',boundary:square,pitch:.5,baseElevation:0,overhang:0,riseDirection:{x:1,y:0}},
      {id:'b',levelId:'l1',boundary:[{x:5,y:2},{x:15,y:2},{x:15,y:8},{x:5,y:8}],pitch:.5,baseElevation:0,overhang:0,riseDirection:{x:-1,y:0}},
    ];
    const seams=analyzeRoofPlaneIntersections(planes);
    expect(seams).toHaveLength(1);
    expect(Math.min(seams[0].start.y,seams[0].end.y)).toBeCloseTo(2);
    expect(Math.max(seams[0].start.y,seams[0].end.y)).toBeCloseTo(8);
  });

  it('does not join planes from different levels',()=>{
    const first:RoofPlane={id:'a',levelId:'l1',boundary:square,pitch:.5,baseElevation:0,overhang:0,riseDirection:{x:1,y:0}};
    const second:RoofPlane={...first,id:'b',levelId:'l2',riseDirection:{x:-1,y:0}};
    expect(analyzeRoofPlaneIntersections([first,second])).toEqual([]);
  });

  it('evaluates roof elevation from the low edge projection',()=>{
    const plane:RoofPlane={id:'a',levelId:'l1',boundary:square,pitch:.25,baseElevation:100,overhang:0,riseDirection:{x:0,y:1}};
    expect(elevationAt(plane,{x:3,y:8})).toBeCloseTo(102);
  });
});
