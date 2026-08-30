import type { BuildingModelV2 } from '../domain/building';
import type { ModelObjectKind } from '../revisions/diff';

export type PropertyConflict={kind:ModelObjectKind;id:string;path:string;base:unknown;left:unknown;right:unknown;reason:'different-values'|'delete-vs-edit'|'add-vs-add'};
export type ConflictAnalysis={conflicts:PropertyConflict[];leftOnly:number;rightOnly:number;compatible:number};

type Entry={kind:ModelObjectKind;id:string;value:unknown};

export function analyzeRevisionConflicts(base:BuildingModelV2,left:BuildingModelV2,right:BuildingModelV2):ConflictAnalysis{
  const baseMap=index(base),leftMap=index(left),rightMap=index(right);const keys=new Set([...baseMap.keys(),...leftMap.keys(),...rightMap.keys()]);const conflicts:PropertyConflict[]=[];let leftOnly=0,rightOnly=0,compatible=0;
  for(const key of keys){const b=baseMap.get(key),l=leftMap.get(key),r=rightMap.get(key);const kind=(b??l??r)!.kind,id=(b??l??r)!.id;
    if(!b){if(l&&r){if(stable(l.value)===stable(r.value))compatible+=1;else conflicts.push({kind,id,path:'$',base:undefined,left:l.value,right:r.value,reason:'add-vs-add'});}else if(l)leftOnly+=1;else if(r)rightOnly+=1;continue;}
    if(!l&&!r){compatible+=1;continue;}
    if(!l&&r){if(stable(b.value)===stable(r.value))leftOnly+=1;else conflicts.push({kind,id,path:'$',base:b.value,left:undefined,right:r.value,reason:'delete-vs-edit'});continue;}
    if(l&&!r){if(stable(b.value)===stable(l.value))rightOnly+=1;else conflicts.push({kind,id,path:'$',base:b.value,left:l.value,right:undefined,reason:'delete-vs-edit'});continue;}
    const leftChanges=propertyChanges(b.value,l!.value),rightChanges=propertyChanges(b.value,r!.value);if(leftChanges.size===0&&rightChanges.size===0){compatible+=1;continue;}
    if(leftChanges.size>0&&rightChanges.size===0){leftOnly+=1;continue;}if(rightChanges.size>0&&leftChanges.size===0){rightOnly+=1;continue;}
    let objectConflicts=0;for(const [path,leftChange] of leftChanges){const rightChange=rightChanges.get(path);if(!rightChange)continue;if(stable(leftChange.after)!==stable(rightChange.after)){conflicts.push({kind,id,path,base:leftChange.before,left:leftChange.after,right:rightChange.after,reason:'different-values'});objectConflicts+=1;}}
    if(objectConflicts===0)compatible+=1;
  }
  return{conflicts,leftOnly,rightOnly,compatible};
}

function index(model:BuildingModelV2){const map=new Map<string,Entry>();const add=<T extends{id:string}>(kind:ModelObjectKind,items:T[])=>items.forEach(item=>map.set(`${kind}:${item.id}`,{kind,id:item.id,value:item}));add('level',model.levels);add('wall',model.walls);add('opening',model.openings);add('room',model.rooms);add('stair',model.stairs);add('roofPlane',model.roofPlanes);add('cabinet',model.cabinets);add('fixture',model.fixtures);return map;}
function propertyChanges(before:unknown,after:unknown,path='$',result=new Map<string,{before:unknown;after:unknown}>()){if(stable(before)===stable(after))return result;if(isRecord(before)&&isRecord(after)){const keys=new Set([...Object.keys(before),...Object.keys(after)]);for(const key of keys)propertyChanges(before[key],after[key],`${path}.${key}`,result);return result;}if(Array.isArray(before)&&Array.isArray(after)){if(stable(before)!==stable(after))result.set(path,{before,after});return result;}result.set(path,{before,after});return result;}
function isRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function stable(value:unknown){return JSON.stringify(sort(value));}
function sort(value:unknown):unknown{if(Array.isArray(value))return value.map(sort);if(isRecord(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
