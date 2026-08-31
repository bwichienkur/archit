import type { BuildingModelV2 } from '../domain/building';
import type { ModelObjectKind } from '../revisions/diff';
import { analyzeRevisionConflicts,type PropertyConflict } from './conflicts';

export type ConflictChoice='base'|'left'|'right';
export type ConflictDecisions=Record<string,ConflictChoice>;
export type MergeResult={model:BuildingModelV2;unresolved:PropertyConflict[]};

const collections: Array<[ModelObjectKind,keyof Pick<BuildingModelV2,'levels'|'walls'|'openings'|'rooms'|'stairs'|'roofPlanes'|'cabinets'|'fixtures'>]>=[
  ['level','levels'],['wall','walls'],['opening','openings'],['room','rooms'],['stair','stairs'],['roofPlane','roofPlanes'],['cabinet','cabinets'],['fixture','fixtures'],
];

export function conflictKey(conflict:Pick<PropertyConflict,'kind'|'id'|'path'>){return`${conflict.kind}:${conflict.id}:${conflict.path}`;}

export function mergeBuildingModels(base:BuildingModelV2,left:BuildingModelV2,right:BuildingModelV2,decisions:ConflictDecisions={}):MergeResult{
  const analysis=analyzeRevisionConflicts(base,left,right);
  const unresolved=analysis.conflicts.filter(conflict=>!decisions[conflictKey(conflict)]);
  const merged:BuildingModelV2=structuredClone(base);

  for(const [kind,collection] of collections){
    const baseItems=index(base[collection] as Array<{id:string}>);
    const leftItems=index(left[collection] as Array<{id:string}>);
    const rightItems=index(right[collection] as Array<{id:string}>);
    const ids=[...new Set([...baseItems.keys(),...leftItems.keys(),...rightItems.keys()])].sort();
    const result:unknown[]=[];
    for(const id of ids){
      const value=mergeValue(baseItems.get(id),leftItems.get(id),rightItems.get(id),'$',kind,id,decisions);
      if(value!==undefined)result.push(value);
    }
    (merged as unknown as Record<string,unknown>)[collection]=result;
  }

  // Project identity belongs to the destination project; revision metadata remains outside the BIM payload.
  merged.projectId=left.projectId||right.projectId||base.projectId;
  merged.projectName=left.projectName||right.projectName||base.projectName;
  return{model:merged,unresolved};
}

function mergeValue(base:unknown,left:unknown,right:unknown,path:string,kind:ModelObjectKind,id:string,decisions:ConflictDecisions):unknown{
  if(equal(left,right))return clone(left);
  if(equal(base,left))return clone(right);
  if(equal(base,right))return clone(left);

  if(isRecord(base)&&isRecord(left)&&isRecord(right)){
    const output:Record<string,unknown>={};
    const keys=[...new Set([...Object.keys(base),...Object.keys(left),...Object.keys(right)])].sort();
    for(const key of keys){
      const next=mergeValue(base[key],left[key],right[key],`${path}.${key}`,kind,id,decisions);
      if(next!==undefined)output[key]=next;
    }
    return output;
  }

  const choice=decisions[`${kind}:${id}:${path}`];
  if(choice==='base')return clone(base);
  if(choice==='right')return clone(right);
  // Deterministic preview defaults to left while unresolved is surfaced separately.
  return clone(left);
}

function index(items:Array<{id:string}>){return new Map(items.map(item=>[item.id,item]));}
function isRecord(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function equal(left:unknown,right:unknown){return stable(left)===stable(right);}
function stable(value:unknown){return JSON.stringify(sort(value));}
function sort(value:unknown):unknown{if(Array.isArray(value))return value.map(sort);if(isRecord(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
function clone<T>(value:T):T{return value===undefined?value:structuredClone(value);}
