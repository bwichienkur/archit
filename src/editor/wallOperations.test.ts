import { describe, expect, it } from 'vitest';
import type { ArchitecturalWall } from '../domain/building';
import { intersectInfiniteWalls, mirrorWall, moveWall, offsetWall, rotateWall, splitWall, trimOrExtendWallToIntersection } from './wallOperations';

function wall(id='w',start={x:0,y:0},end={x:10,y:0}):ArchitecturalWall{return{id,levelId:'l',name:id,start,end,thickness:.5,height:9,baseElevation:0,wallType:'interior',openingIds:[],lineage:{sourceCadEntityIds:['cad'],validationState:'confirmed'}};}

describe('wall operations',()=>{
  it('moves rotates mirrors and offsets walls without losing lineage',()=>{expect(moveWall(wall(),{x:2,y:3}).start).toEqual({x:2,y:3});expect(rotateWall(wall(),Math.PI/2,{x:0,y:0}).end.x).toBeCloseTo(0);expect(rotateWall(wall(),Math.PI/2,{x:0,y:0}).end.y).toBeCloseTo(10);expect(mirrorWall(wall('w',{x:0,y:2},{x:10,y:2}),{x:0,y:0},{x:10,y:0}).start.y).toBeCloseTo(-2);expect(offsetWall(wall(),2).start.y).toBeCloseTo(2);expect(offsetWall(wall(),2).lineage.validationState).toBe('modified');});
  it('splits only on the interior centerline',()=>{const [a,b]=splitWall(wall(),{x:4,y:0});expect(a.end).toEqual({x:4,y:0});expect(b.start).toEqual({x:4,y:0});expect(()=>splitWall(wall(),{x:4,y:2})).toThrow(/not on/i);});
  it('finds and trims or extends to deterministic intersections',()=>{const horizontal=wall('h',{x:0,y:0},{x:5,y:0}),vertical=wall('v',{x:10,y:-5},{x:10,y:5});expect(intersectInfiniteWalls(horizontal,vertical)).toEqual({x:10,y:0});expect(trimOrExtendWallToIntersection(horizontal,vertical,'end').end).toEqual({x:10,y:0});});
});
