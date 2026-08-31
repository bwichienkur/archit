import { describe, expect, it } from 'vitest';
import { exportBuildingToGltf } from './gltfScene';
import type { BuildingModelV2 } from '../domain/building';

function model():BuildingModelV2{return{schemaVersion:2,projectId:'p',projectName:'House',units:'imperial',geometryUnits:'feet',levels:[{id:'l',name:'Ground',elevation:0,floorToFloorHeight:10,defaultCeilingHeight:9}],walls:[{id:'w',levelId:'l',name:'Wall',start:{x:0,y:0},end:{x:10,y:0},thickness:.5,height:9,baseElevation:0,wallType:'exterior',openingIds:[],lineage:{sourceCadEntityIds:['cad:1'],validationState:'confirmed'}}],openings:[],rooms:[],stairs:[],roofPlanes:[],cabinets:[{id:'c',levelId:'l',kind:'base',origin:{x:2,y:2},rotation:0,width:3,depth:2,height:3}],fixtures:[{id:'f',levelId:'l',category:'furniture',origin:{x:5,y:5},rotation:0,width:2,depth:2,height:2}]};}

describe('glTF export',()=>{
  it('emits glTF 2.0 with embedded geometry and meter transforms',()=>{const gltf=JSON.parse(exportBuildingToGltf(model(),{includeLineage:true}));expect(gltf.asset.version).toBe('2.0');expect(gltf.buffers[0].uri).toMatch(/^data:application\/octet-stream;base64,/);expect(gltf.nodes).toHaveLength(3);expect(gltf.nodes[0].scale[0]).toBeCloseTo(3.048);expect(gltf.nodes[0].extras.sourceCadEntityIds).toEqual(['cad:1']);});
  it('blocks uncalibrated unitless models',()=>{expect(()=>exportBuildingToGltf({...model(),geometryUnits:'unitless'})).toThrow(/calibrated/i);});
});
