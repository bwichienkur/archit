import { describe, expect, it } from 'vitest';
import { can } from '../saas/tenancy';
import { GridSpatialIndex } from '../geometry/spatialIndex';
import { validatePlacement } from '../interior/placement';
import { validateFixturePlacement } from '../mep/placementRules';
import { validateAiProposal } from '../ai/advisory';
import { constrainPoseToBoundary, stepWalkthrough } from '../presentation/walkthrough';
import { renderQualityPresets, validatePbrMaterial } from '../rendering/materials';
import type { ArchitecturalRoom, Fixture } from '../domain/building';

const room:ArchitecturalRoom={id:'r',levelId:'l',name:'Room',roomType:'living',boundary:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],ceilingHeight:9,lineage:{sourceCadEntityIds:[],validationState:'confirmed'}};

describe('platform foundations',()=>{
  it('enforces role and project-scoped permissions',()=>{expect(can({tenantId:'t',userId:'u',role:'customer',projectIds:['p']},'project:read','p')).toBe(true);expect(can({tenantId:'t',userId:'u',role:'customer',projectIds:['p']},'bim:edit','p')).toBe(false);expect(can({tenantId:'t',userId:'u',role:'architect',projectIds:['p']},'project:read','other')).toBe(false);});
  it('queries a spatial grid without returning non-intersections',()=>{const index=new GridSpatialIndex<number>(10);index.upsert({id:'a',bounds:{minX:0,minY:0,maxX:2,maxY:2},value:1});index.upsert({id:'b',bounds:{minX:20,minY:20,maxX:22,maxY:22},value:2});expect(index.query({minX:-1,minY:-1,maxX:5,maxY:5}).map(x=>x.id)).toEqual(['a']);});
  it('detects interior collisions and room containment',()=>{expect(validatePlacement(room,{id:'chair',origin:{x:5,y:5},width:2,depth:2,rotation:0},[{id:'table',origin:{x:5,y:5},width:3,depth:3,rotation:0}]).some(i=>i.code==='collision')).toBe(true);expect(validatePlacement(room,{id:'chair',origin:{x:10,y:10},width:2,depth:2,rotation:0},[]).some(i=>i.code==='outside-room')).toBe(true);});
  it('applies generic MEP clearance rules without jurisdiction assumptions',()=>{const fixture:Fixture={id:'sink',levelId:'l',roomId:'r',category:'plumbing',origin:{x:5,y:5},rotation:0,width:2,depth:2};const other:Fixture={id:'toilet',levelId:'l',roomId:'r',category:'plumbing',origin:{x:5.5,y:5},rotation:0,width:2,depth:2};expect(validateFixturePlacement(room,fixture,[other],{minimumFixtureClearance:1,units:'ft'}).some(i=>i.code==='fixture-clearance')).toBe(true);});
  it('keeps geometry AI advisory-only',()=>{expect(validateAiProposal({id:'a',projectId:'p',kind:'geometry-review',summary:'Check wall',rationale:'Mismatch',targetIds:['w'],confidence:.8,proposedPatch:{x:1},createdAt:'x',status:'pending'})[0]).toMatch(/must not carry/i);});
  it('steps and constrains walkthrough camera state',()=>{const stepped=stepWalkthrough({position:{x:1,y:5,z:1},yaw:0,pitch:0,eyeHeight:5},{forward:1,strafe:0,turn:0,look:0,deltaSeconds:1,speed:2,turnSpeed:1});expect(stepped.position.x).toBeCloseTo(3);const constrained=constrainPoseToBoundary({...stepped,position:{x:20,y:5,z:20}},room.boundary);expect(constrained.position.x).toBeLessThanOrEqual(10);});
  it('validates PBR material ranges and exposes quality presets',()=>{expect(validatePbrMaterial({id:'m',name:'Paint',baseColor:'#fff',roughness:2,metalness:0})[0]).toMatch(/Roughness/);expect(renderQualityPresets.presentation.reflections).toBe(true);});
});
