import type { WallOpening } from './building';

export type DoorOperation='swing'|'sliding'|'pocket'|'bifold'|'barn'|'fixed';
export type WindowOperation='fixed'|'single-hung'|'double-hung'|'casement'|'awning'|'slider'|'picture'|'clerestory';
export type OpeningFamily={id:string;kind:'door'|'window';name:string;operation:DoorOperation|WindowOperation;nominalWidth:number;nominalHeight:number;frameDepth?:number;manufacturer?:string;productId?:string;metadata:Record<string,string|number|boolean|null>};

export function applyOpeningFamily(opening:WallOpening,family:OpeningFamily):WallOpening {
  if(opening.kind!==family.kind)throw new Error(`Cannot apply ${family.kind} family to ${opening.kind} opening.`);
  return {...opening,width:family.nominalWidth,height:family.nominalHeight,subtype:family.operation,lineage:{...opening.lineage,validationState:'modified'}};
}

export function validateOpeningFamily(family:OpeningFamily){const issues:string[]=[];if(!family.id.trim())issues.push('Family id is required.');if(!family.name.trim())issues.push('Family name is required.');if(!(family.nominalWidth>0))issues.push('Nominal width must be positive.');if(!(family.nominalHeight>0))issues.push('Nominal height must be positive.');if(family.frameDepth!=null&&family.frameDepth<=0)issues.push('Frame depth must be positive.');return issues;}
