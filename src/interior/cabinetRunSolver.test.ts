import { describe, expect, it } from 'vitest';
import { solveCabinetRun } from './cabinetRunSolver';

describe('cabinet run solver',()=>{
  const base={runId:'run',levelId:'l1',roomId:'kitchen',hostWallId:'w1',wallStart:{x:0,y:0},wallEnd:{x:120,y:0},startOffset:3,endOffset:3,minimumFiller:1,maximumFiller:9,countertopDepth:25,countertopOverhang:1.5};
  it('places modules in order and creates a countertop',()=>{
    const result=solveCabinetRun({...base,modules:[{id:'sink',kind:'sink-base' as const,width:36,depth:24,height:34.5},{id:'drawer',kind:'drawer' as const,width:30,depth:24,height:34.5},{id:'base',kind:'base' as const,width:42,depth:24,height:34.5}]});
    expect(result.cabinets.map(c=>c.kind)).toEqual(['sink-base','drawer','base']);
    expect(result.countertop.boundary).toHaveLength(4);
    expect(result.availableLength).toBe(114);
    expect(result.fillers.reduce((sum,f)=>sum+f.width,0)).toBe(6);
  });
  it('distributes a large valid gap across both ends',()=>{
    const result=solveCabinetRun({...base,modules:[{id:'a',kind:'base' as const,width:50,depth:24,height:34},{id:'b',kind:'base' as const,width:50,depth:24,height:34}]});
    expect(result.fillers).toHaveLength(2);expect(result.fillers[0].width).toBe(7);expect(result.fillers[1].width).toBe(7);
  });
  it('rejects overflowing runs',()=>{expect(()=>solveCabinetRun({...base,modules:[{id:'a',kind:'base' as const,width:115,depth:24,height:34}]})).toThrow(/exceed/i);});
});
