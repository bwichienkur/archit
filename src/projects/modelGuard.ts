import type { BuildingModelV2 } from '../domain/building';

export function isBuildingModelV2(value:unknown):value is BuildingModelV2{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const model=value as Partial<BuildingModelV2>;
  return model.schemaVersion===2
    &&typeof model.projectId==='string'
    &&typeof model.projectName==='string'
    &&typeof model.units==='string'
    &&typeof model.geometryUnits==='string'
    &&Array.isArray(model.levels)
    &&Array.isArray(model.walls)
    &&Array.isArray(model.openings)
    &&Array.isArray(model.rooms)
    &&Array.isArray(model.stairs)
    &&Array.isArray(model.roofPlanes)
    &&Array.isArray(model.cabinets)
    &&Array.isArray(model.fixtures);
}
