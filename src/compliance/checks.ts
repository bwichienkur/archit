import type { BuildingModelV2 } from '../domain/building';

export type ComplianceSeverity = 'info'|'warning'|'error';
export type ComplianceFinding = { code:string; severity:ComplianceSeverity; objectId?:string; message:string; actual?:number; required?:number; units:string; citation?:string };
export type ComplianceProfile = {
  name:string;
  minimumDoorWidth:number;
  minimumHallWidth:number;
  maximumStairRiser:number;
  minimumStairTread:number;
  minimumStairWidth:number;
  minimumRoomArea:number;
  units:string;
  citations?:Record<string,string>;
};

export function runComplianceChecks(model: BuildingModelV2, profile: ComplianceProfile): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  for (const opening of model.openings) {
    if (opening.kind === 'door' && opening.width < profile.minimumDoorWidth) findings.push({ code:'door-width', severity:'warning', objectId:opening.id, message:`Door ${opening.id} is narrower than the configured minimum.`, actual:opening.width, required:profile.minimumDoorWidth, units:profile.units, citation:profile.citations?.['door-width'] });
  }
  for (const stair of model.stairs) {
    if (stair.riserHeight > profile.maximumStairRiser) findings.push({ code:'stair-riser', severity:'error', objectId:stair.id, message:`Stair ${stair.id} exceeds the configured maximum riser height.`, actual:stair.riserHeight, required:profile.maximumStairRiser, units:profile.units, citation:profile.citations?.['stair-riser'] });
    if (stair.treadDepth < profile.minimumStairTread) findings.push({ code:'stair-tread', severity:'error', objectId:stair.id, message:`Stair ${stair.id} is below the configured minimum tread depth.`, actual:stair.treadDepth, required:profile.minimumStairTread, units:profile.units, citation:profile.citations?.['stair-tread'] });
    if (stair.width < profile.minimumStairWidth) findings.push({ code:'stair-width', severity:'warning', objectId:stair.id, message:`Stair ${stair.id} is narrower than the configured minimum.`, actual:stair.width, required:profile.minimumStairWidth, units:profile.units, citation:profile.citations?.['stair-width'] });
  }
  for (const room of model.rooms) {
    const area = polygonArea(room.boundary);
    if (area < profile.minimumRoomArea) findings.push({ code:'room-area', severity:'warning', objectId:room.id, message:`Room ${room.name} is smaller than the configured minimum area.`, actual:area, required:profile.minimumRoomArea, units:`${profile.units}²`, citation:profile.citations?.['room-area'] });
  }
  return findings;
}

function polygonArea(points:Array<{x:number;y:number}>){ let area=0; for(let i=0;i<points.length;i++){ const a=points[i],b=points[(i+1)%points.length]; area+=a.x*b.y-b.x*a.y; } return Math.abs(area)/2; }
