import type { BuildingModelV2 } from '../domain/building';

export type ModelObjectKind='level'|'wall'|'opening'|'room'|'stair'|'roofPlane'|'cabinet'|'fixture';
export type ObjectChange={kind:ModelObjectKind;id:string;change:'added'|'removed'|'modified';before?:unknown;after?:unknown};
export type ModelDiff={changes:ObjectChange[];summary:Record<string,number>};

export function diffBuildingModels(before:BuildingModelV2,after:BuildingModelV2):ModelDiff {
  const changes:ObjectChange[]=[];
  compare('level',before.levels,after.levels,changes);compare('wall',before.walls,after.walls,changes);compare('opening',before.openings,after.openings,changes);compare('room',before.rooms,after.rooms,changes);compare('stair',before.stairs,after.stairs,changes);compare('roofPlane',before.roofPlanes,after.roofPlanes,changes);compare('cabinet',before.cabinets,after.cabinets,changes);compare('fixture',before.fixtures,after.fixtures,changes);
  const summary:Record<string,number>={added:0,removed:0,modified:0,total:changes.length};for(const change of changes)summary[change.change]=(summary[change.change]??0)+1;return{changes,summary};
}

function compare<T extends {id:string}>(kind:ModelObjectKind,before:T[],after:T[],changes:ObjectChange[]){const b=new Map(before.map(item=>[item.id,item])),a=new Map(after.map(item=>[item.id,item]));for(const [id,item] of b){const next=a.get(id);if(!next)changes.push({kind,id,change:'removed',before:item});else if(stableJson(item)!==stableJson(next))changes.push({kind,id,change:'modified',before:item,after:next});}for(const [id,item] of a)if(!b.has(id))changes.push({kind,id,change:'added',after:item});}
function stableJson(value:unknown){return JSON.stringify(sortValue(value));}
function sortValue(value:unknown):unknown{if(Array.isArray(value))return value.map(sortValue);if(value&&typeof value==='object'){const record=value as Record<string,unknown>;return Object.fromEntries(Object.keys(record).sort().map(key=>[key,sortValue(record[key])]));}return value;}
