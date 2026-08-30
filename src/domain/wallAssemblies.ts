import type { ArchitecturalWall, GeometryLengthUnit } from './building';

export type WallLayerRole = 'exterior-finish' | 'sheathing' | 'structure' | 'insulation' | 'air-space' | 'interior-finish' | 'membrane' | 'other';

export type WallAssemblyLayer = {
  id: string;
  name: string;
  role: WallLayerRole;
  thickness: number;
  materialId?: string;
  thermalResistance?: number;
};

export type WallAssembly = {
  id: string;
  name: string;
  geometryUnits: GeometryLengthUnit;
  layers: WallAssemblyLayer[];
};

export type WallAssemblyValidation = {
  valid: boolean;
  totalThickness: number;
  issues: string[];
};

export function validateWallAssembly(assembly: WallAssembly): WallAssemblyValidation {
  const issues: string[] = [];
  if (assembly.geometryUnits === 'unitless') issues.push('Wall assemblies require explicit geometry units.');
  if (assembly.layers.length === 0) issues.push('Wall assembly requires at least one layer.');
  const ids = new Set<string>();
  for (const layer of assembly.layers) {
    if (!layer.id.trim()) issues.push('Wall assembly layer IDs cannot be empty.');
    if (ids.has(layer.id)) issues.push(`Duplicate wall assembly layer ID ${layer.id}.`);
    ids.add(layer.id);
    if (!Number.isFinite(layer.thickness) || layer.thickness <= 0) issues.push(`Layer ${layer.id || '(unnamed)'} must have positive thickness.`);
  }
  const totalThickness = assembly.layers.reduce((sum, layer) => sum + (Number.isFinite(layer.thickness) ? layer.thickness : 0), 0);
  return { valid: issues.length === 0, totalThickness, issues };
}

export function validateWallAgainstAssembly(wall: ArchitecturalWall, assembly: WallAssembly, tolerance = 1e-6): string[] {
  const result = validateWallAssembly(assembly);
  const issues = [...result.issues];
  if (wall.assemblyId && wall.assemblyId !== assembly.id) issues.push(`Wall ${wall.id} references assembly ${wall.assemblyId}, not ${assembly.id}.`);
  if (Math.abs(wall.thickness - result.totalThickness) > tolerance) {
    issues.push(`Wall thickness ${wall.thickness} does not match assembly thickness ${result.totalThickness}.`);
  }
  return issues;
}

export type WallLayerBand = {
  layerId: string;
  role: WallLayerRole;
  materialId?: string;
  startOffset: number;
  endOffset: number;
};

export function buildWallLayerBands(assembly: WallAssembly): WallLayerBand[] {
  const result = validateWallAssembly(assembly);
  if (!result.valid) throw new Error(result.issues.join(' '));
  let cursor = -result.totalThickness / 2;
  return assembly.layers.map(layer => {
    const band: WallLayerBand = {
      layerId: layer.id,
      role: layer.role,
      materialId: layer.materialId,
      startOffset: cursor,
      endOffset: cursor + layer.thickness,
    };
    cursor = band.endOffset;
    return band;
  });
}
