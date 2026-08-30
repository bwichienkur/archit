import type { BuildingModelV2, GeometryLengthUnit } from '../domain/building';

export type GltfExportOptions={includeCabinets?:boolean;includeFixtures?:boolean;includeLineage?:boolean};

type GltfNode={name:string;mesh:number;translation:[number,number,number];rotation?:[number,number,number,number];scale:[number,number,number];extras?:Record<string,unknown>};

export function exportBuildingToGltf(model:BuildingModelV2,options:GltfExportOptions={}):string{
  if(model.geometryUnits==='unitless')throw new Error('glTF export requires calibrated geometry units.');
  const toMeters=metersPerUnit(model.geometryUnits);
  const nodes:GltfNode[]=[];
  for(const wall of model.walls){
    const dx=wall.end.x-wall.start.x,dz=wall.end.y-wall.start.y,length=Math.hypot(dx,dz);if(length<=1e-9)continue;
    const angle=-Math.atan2(dz,dx),midX=(wall.start.x+wall.end.x)/2,midZ=(wall.start.y+wall.end.y)/2;
    nodes.push({name:wall.name||wall.id,mesh:0,translation:[midX*toMeters,(wall.baseElevation+wall.height/2)*toMeters,midZ*toMeters],rotation:yQuaternion(angle),scale:[length*toMeters,wall.height*toMeters,wall.thickness*toMeters],extras:extras('wall',wall.id,options.includeLineage?wall.lineage.sourceCadEntityIds:undefined)});
  }
  if(options.includeCabinets!==false)for(const cabinet of model.cabinets)nodes.push({name:cabinet.id,mesh:0,translation:[cabinet.origin.x*toMeters,cabinet.height*toMeters/2,cabinet.origin.y*toMeters],rotation:yQuaternion(-cabinet.rotation),scale:[cabinet.width*toMeters,cabinet.height*toMeters,cabinet.depth*toMeters],extras:extras('cabinet',cabinet.id)});
  if(options.includeFixtures!==false)for(const fixture of model.fixtures){const width=fixture.width??.5,depth=fixture.depth??.5,height=fixture.height??.5;nodes.push({name:fixture.id,mesh:0,translation:[fixture.origin.x*toMeters,height*toMeters/2,fixture.origin.y*toMeters],rotation:yQuaternion(-fixture.rotation),scale:[width*toMeters,height*toMeters,depth*toMeters],extras:extras(fixture.category,fixture.id)});}
  const cube=unitCubeBinary();
  const gltf={asset:{version:'2.0',generator:'Archit'},scene:0,scenes:[{name:model.projectName,nodes:nodes.map((_,index)=>index)}],nodes,meshes:[{name:'Archit Unit Cube',primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2}]}],buffers:[{byteLength:cube.bytes.byteLength,uri:`data:application/octet-stream;base64,${toBase64(cube.bytes)}`}],bufferViews:cube.views,accessors:cube.accessors,extras:{projectId:model.projectId,geometryUnits:model.geometryUnits,source:'BuildingModelV2'}};
  return JSON.stringify(gltf,null,2);
}

function unitCubeBinary(){
  const positions=new Float32Array([-0.5,-0.5,-0.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5]);
  const normals=new Float32Array([-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1].map(v=>v/Math.sqrt(3)));
  const indices=new Uint16Array([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,1,5,6,1,6,2,0,3,7,0,7,4]);
  const pBytes=new Uint8Array(positions.buffer),nBytes=new Uint8Array(normals.buffer),iBytes=new Uint8Array(indices.buffer);const bytes=new Uint8Array(pBytes.length+nBytes.length+iBytes.length);bytes.set(pBytes,0);bytes.set(nBytes,pBytes.length);bytes.set(iBytes,pBytes.length+nBytes.length);
  return{bytes,views:[{buffer:0,byteOffset:0,byteLength:pBytes.length,target:34962},{buffer:0,byteOffset:pBytes.length,byteLength:nBytes.length,target:34962},{buffer:0,byteOffset:pBytes.length+nBytes.length,byteLength:iBytes.length,target:34963}],accessors:[{bufferView:0,componentType:5126,count:8,type:'VEC3',min:[-.5,-.5,-.5],max:[.5,.5,.5]},{bufferView:1,componentType:5126,count:8,type:'VEC3'},{bufferView:2,componentType:5123,count:indices.length,type:'SCALAR'}]};
}
function metersPerUnit(unit:GeometryLengthUnit){switch(unit){case'inches':return .0254;case'feet':return .3048;case'millimeters':return .001;case'centimeters':return .01;case'meters':return 1;default:throw new Error('Unitless geometry cannot be converted to meters.');}}
function yQuaternion(angle:number):[number,number,number,number]{return[0,Math.sin(angle/2),0,Math.cos(angle/2)];}
function extras(kind:string,id:string,lineage?:string[]):Record<string,unknown>{return{architKind:kind,architId:id,...(lineage?{sourceCadEntityIds:[...lineage]}:{})};}
function toBase64(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=1)binary+=String.fromCharCode(bytes[i]);return btoa(binary);}
