import { describe,expect,it } from 'vitest';
import { deriveCabinetFinishes } from './cabinetSurfaces';
import type { SolvedCabinet } from './cabinetLayout';

const base=(id:string,offset:number,kind:SolvedCabinet['kind']='base'):SolvedCabinet=>({id,levelId:'l1',roomId:'r1',kind,origin:{x:offset+15,y:0},rotation:0,width:30,depth:24,height:34.5,hostWallId:'w1',offsetFromWallStart:offset});

describe('cabinet finish geometry',()=>{
  it('builds one countertop and backsplash over contiguous base cabinets',()=>{
    const result=deriveCabinetFinishes([base('a',0),base('b',30)],0,{countertopOverhang:1});
    const tops=result.boxes.filter(box=>box.kind==='countertop');
    const splashes=result.boxes.filter(box=>box.kind==='backsplash');
    expect(tops).toHaveLength(1);
    expect(tops[0].width).toBe(62);
    expect(splashes).toHaveLength(1);
    expect(tops[0].cabinetIds).toEqual(['a','b']);
  });

  it('splits countertop runs around appliances and exposes an appliance opening',()=>{
    const result=deriveCabinetFinishes([base('a',0),base('range',30,'appliance'),base('b',60)],0);
    expect(result.boxes.filter(box=>box.kind==='countertop')).toHaveLength(2);
    expect(result.applianceOpenings).toHaveLength(1);
    expect(result.applianceOpenings[0].width).toBeCloseTo(30.5);
  });

  it('splits leftover filler between run ends by default',()=>{
    const result=deriveCabinetFinishes([base('a',0),base('b',30)],6);
    const fillers=result.boxes.filter(box=>box.kind==='filler');
    expect(fillers).toHaveLength(2);
    expect(fillers.map(filler=>filler.width)).toEqual([3,3]);
  });

  it('creates two exposed end panels for a contiguous run',()=>{
    const result=deriveCabinetFinishes([base('a',0),base('b',30)],0);
    expect(result.boxes.filter(box=>box.kind==='end-panel')).toHaveLength(2);
  });
});
