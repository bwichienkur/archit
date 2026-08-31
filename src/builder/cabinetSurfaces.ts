import type { Point2 } from '../domain/building';
import type { SolvedCabinet } from './cabinetLayout';

export type CabinetFinishBox={
  id:string;
  kind:'countertop'|'backsplash'|'end-panel'|'filler';
  origin:Point2;
  rotation:number;
  width:number;
  depth:number;
  height:number;
  baseElevation:number;
  cabinetIds:string[];
};

export type ApplianceOpening={
  id:string;
  cabinetId:string;
  origin:Point2;
  rotation:number;
  width:number;
  depth:number;
  height:number;
  clearance:number;
};

export type CabinetFinishOptions={
  countertopThickness?:number;
  countertopOverhang?:number;
  backsplashHeight?:number;
  backsplashThickness?:number;
  endPanelThickness?:number;
  splitFillerAtEnds?:boolean;
  applianceClearance?:number;
};

export type CabinetFinishResult={
  boxes:CabinetFinishBox[];
  applianceOpenings:ApplianceOpening[];
};

const countertopKinds=new Set<SolvedCabinet['kind']>(['base','vanity','island','corner','drawer','sink-base']);

export function deriveCabinetFinishes(cabinets:SolvedCabinet[],fillerWidth:number,options:CabinetFinishOptions={}):CabinetFinishResult{
  const countertopThickness=positive(options.countertopThickness??1.5,'Countertop thickness');
  const countertopOverhang=nonNegative(options.countertopOverhang??1,'Countertop overhang');
  const backsplashHeight=nonNegative(options.backsplashHeight??4,'Backsplash height');
  const backsplashThickness=positive(options.backsplashThickness??.5,'Backsplash thickness');
  const endPanelThickness=positive(options.endPanelThickness??.75,'End panel thickness');
  const applianceClearance=nonNegative(options.applianceClearance??.25,'Appliance clearance');
  const boxes:CabinetFinishBox[]=[];
  const applianceOpenings:ApplianceOpening[]=[];

  const ordered=[...cabinets].sort((a,b)=>a.offsetFromWallStart-b.offsetFromWallStart||a.id.localeCompare(b.id));
  for(const cabinet of ordered){
    if(cabinet.kind==='appliance')applianceOpenings.push({id:`${cabinet.id}:opening`,cabinetId:cabinet.id,origin:{...cabinet.origin},rotation:cabinet.rotation,width:cabinet.width+applianceClearance*2,depth:cabinet.depth+applianceClearance,height:cabinet.height+applianceClearance,clearance:applianceClearance});
  }

  const groups=contiguousCountertopGroups(ordered);
  for(const [index,group] of groups.entries()){
    const first=group[0],last=group[group.length-1];
    const start=first.offsetFromWallStart-countertopOverhang;
    const end=last.offsetFromWallStart+last.width+countertopOverhang;
    const width=end-start;
    const depth=Math.max(...group.map(cabinet=>cabinet.depth))+countertopOverhang;
    const centerOffset=(start+end)/2;
    const origin=pointAtOffset(first,centerOffset-first.offsetFromWallStart-first.width/2);
    const top=Math.max(...group.map(cabinet=>cabinet.height));
    boxes.push({id:`countertop:${index+1}`,kind:'countertop',origin,rotation:first.rotation,width,depth,height:countertopThickness,baseElevation:top,cabinetIds:group.map(cabinet=>cabinet.id)});
    if(backsplashHeight>0&&group.every(cabinet=>Boolean(cabinet.hostWallId))){
      boxes.push({id:`backsplash:${index+1}`,kind:'backsplash',origin:pointAtLateral(origin,first.rotation,-Math.max(...group.map(cabinet=>cabinet.depth))/2),rotation:first.rotation,width:Math.max(0,width-countertopOverhang*2),depth:backsplashThickness,height:backsplashHeight,baseElevation:top+countertopThickness,cabinetIds:group.map(cabinet=>cabinet.id)});
    }
    const panelHeight=Math.max(...group.map(cabinet=>cabinet.height));
    const panelDepth=Math.max(...group.map(cabinet=>cabinet.depth));
    boxes.push({id:`end-panel:${index+1}:start`,kind:'end-panel',origin:pointAtOffset(first,-first.width/2-endPanelThickness/2),rotation:first.rotation+Math.PI/2,width:panelDepth,depth:endPanelThickness,height:panelHeight,baseElevation:0,cabinetIds:[first.id]});
    boxes.push({id:`end-panel:${index+1}:end`,kind:'end-panel',origin:pointAtOffset(last,last.width/2+endPanelThickness/2),rotation:last.rotation+Math.PI/2,width:panelDepth,depth:endPanelThickness,height:panelHeight,baseElevation:0,cabinetIds:[last.id]});
  }

  if(fillerWidth>1e-9&&ordered.length){
    const split=options.splitFillerAtEnds!==false;
    const portions=split?[fillerWidth/2,fillerWidth/2]:[fillerWidth];
    const first=ordered[0],last=ordered[ordered.length-1];
    portions.forEach((width,index)=>{
      if(width<=1e-9)return;
      const atStart=split&&index===0;
      const reference=atStart?first:last;
      const longitudinal=atStart?-reference.width/2-width/2:reference.width/2+width/2;
      boxes.push({id:`filler:${index+1}`,kind:'filler',origin:pointAtOffset(reference,longitudinal),rotation:reference.rotation,width,depth:reference.depth,height:reference.height,baseElevation:0,cabinetIds:[reference.id]});
    });
  }

  return{boxes,applianceOpenings};
}

function contiguousCountertopGroups(cabinets:SolvedCabinet[]){
  const groups:SolvedCabinet[][]=[];
  let current:SolvedCabinet[]=[];
  for(const cabinet of cabinets){
    if(!countertopKinds.has(cabinet.kind)){if(current.length)groups.push(current);current=[];continue;}
    const previous=current[current.length-1];
    if(previous&&Math.abs(previous.offsetFromWallStart+previous.width-cabinet.offsetFromWallStart)>1e-6){groups.push(current);current=[];}
    current.push(cabinet);
  }
  if(current.length)groups.push(current);
  return groups;
}

function pointAtOffset(cabinet:SolvedCabinet,deltaFromCenter:number):Point2{return{x:cabinet.origin.x+Math.cos(cabinet.rotation)*deltaFromCenter,y:cabinet.origin.y+Math.sin(cabinet.rotation)*deltaFromCenter};}
function pointAtLateral(origin:Point2,rotation:number,distance:number):Point2{return{x:origin.x-Math.sin(rotation)*distance,y:origin.y+Math.cos(rotation)*distance};}
function positive(value:number,label:string){if(!(value>0))throw new Error(`${label} must be positive.`);return value;}
function nonNegative(value:number,label:string){if(value<0)throw new Error(`${label} cannot be negative.`);return value;}
