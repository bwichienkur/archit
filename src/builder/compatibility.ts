import type { Product, ProductCategory } from './catalog';

export type SurfaceRole = 'floor' | 'wall' | 'ceiling' | 'countertop' | 'backsplash' | 'roof' | 'exterior-hardscape' | 'trim';
export type ObjectRole = 'cabinet' | 'sink' | 'vanity' | 'door' | 'window' | 'faucet-host' | 'appliance-slot' | 'lighting-point' | 'plumbing-point' | 'furniture-zone';

export type ConfigurationTarget = {
  id: string;
  targetType: 'room' | 'surface' | 'object';
  roomType?: string;
  surfaceRole?: SurfaceRole;
  objectRole?: ObjectRole;
};

export type CompatibilityResult = {
  allowed: boolean;
  reasons: string[];
};

type CategoryRule = {
  targetTypes: ConfigurationTarget['targetType'][];
  surfaceRoles?: SurfaceRole[];
  objectRoles?: ObjectRole[];
  roomTypes?: string[];
};

const RULES: Record<ProductCategory, CategoryRule> = {
  flooring: { targetTypes: ['surface'], surfaceRoles: ['floor'] },
  tile: { targetTypes: ['surface'], surfaceRoles: ['floor','wall','backsplash'] },
  roofing: { targetTypes: ['surface'], surfaceRoles: ['roof'] },
  cabinet: { targetTypes: ['object'], objectRoles: ['cabinet','vanity'] },
  countertop: { targetTypes: ['surface'], surfaceRoles: ['countertop'] },
  faucet: { targetTypes: ['object'], objectRoles: ['faucet-host','sink','vanity'] },
  sink: { targetTypes: ['object'], objectRoles: ['sink','vanity','cabinet'] },
  'plumbing-fixture': { targetTypes: ['object'], objectRoles: ['plumbing-point','vanity'] },
  lighting: { targetTypes: ['object'], objectRoles: ['lighting-point'] },
  appliance: { targetTypes: ['object'], objectRoles: ['appliance-slot'] },
  door: { targetTypes: ['object'], objectRoles: ['door'] },
  window: { targetTypes: ['object'], objectRoles: ['window'] },
  hardware: { targetTypes: ['object'], objectRoles: ['cabinet','door','window','vanity'] },
  baseboard: { targetTypes: ['surface'], surfaceRoles: ['trim'] },
  'crown-molding': { targetTypes: ['surface'], surfaceRoles: ['trim'] },
  paint: { targetTypes: ['surface'], surfaceRoles: ['wall','ceiling'] },
  stone: { targetTypes: ['surface'], surfaceRoles: ['wall','exterior-hardscape'] },
  paver: { targetTypes: ['surface'], surfaceRoles: ['exterior-hardscape'] },
  furniture: { targetTypes: ['object','room'], objectRoles: ['furniture-zone'] },
};

export function evaluateCompatibility(product: Product, target: ConfigurationTarget): CompatibilityResult {
  const rule = RULES[product.category];
  const reasons: string[] = [];

  if (!rule.targetTypes.includes(target.targetType)) {
    reasons.push(`${product.category} products cannot be assigned to ${target.targetType} targets.`);
  }
  if (target.targetType === 'surface' && rule.surfaceRoles && (!target.surfaceRole || !rule.surfaceRoles.includes(target.surfaceRole))) {
    reasons.push(`${product.category} is not compatible with ${target.surfaceRole ?? 'unspecified'} surfaces.`);
  }
  if (target.targetType === 'object' && rule.objectRoles && (!target.objectRole || !rule.objectRoles.includes(target.objectRole))) {
    reasons.push(`${product.category} is not compatible with ${target.objectRole ?? 'unspecified'} objects.`);
  }
  if (rule.roomTypes && target.roomType && !rule.roomTypes.includes(target.roomType.toLowerCase())) {
    reasons.push(`${product.category} is not approved for ${target.roomType} rooms.`);
  }

  return { allowed: reasons.length === 0, reasons };
}

export function compatibleTargets(product: Product, targets: ConfigurationTarget[]) {
  return targets.filter(target => evaluateCompatibility(product, target).allowed);
}
