export type Opening = { width: number; height: number };

export type SurfaceTakeoffInput = {
  width: number;
  height: number;
  openings?: Opening[];
  wasteFactor?: number;
};

export type SurfaceTakeoff = {
  grossArea: number;
  openingArea: number;
  netArea: number;
  orderArea: number;
};

export function calculateSurfaceTakeoff(input: SurfaceTakeoffInput): SurfaceTakeoff {
  const grossArea = Math.max(0, input.width) * Math.max(0, input.height);
  const openingArea = (input.openings ?? []).reduce((sum, opening) =>
    sum + Math.max(0, opening.width) * Math.max(0, opening.height), 0);
  const netArea = Math.max(0, grossArea - openingArea);
  const wasteFactor = Math.max(0, input.wasteFactor ?? 0);
  return {
    grossArea,
    openingArea,
    netArea,
    orderArea: netArea * (1 + wasteFactor)
  };
}

export function calculateLinearTrim(perimeter: number, excludedLengths: number[] = [], wasteFactor = 0): number {
  const excluded = excludedLengths.reduce((sum, value) => sum + Math.max(0, value), 0);
  return Math.max(0, perimeter - excluded) * (1 + Math.max(0, wasteFactor));
}

export function calculateUnitsNeeded(orderQuantity: number, coveragePerUnit: number): number {
  if (coveragePerUnit <= 0) throw new Error('coveragePerUnit must be greater than zero');
  return Math.ceil(Math.max(0, orderQuantity) / coveragePerUnit);
}
