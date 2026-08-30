export type ProductCategory =
  | 'flooring' | 'tile' | 'roofing' | 'cabinet' | 'countertop' | 'faucet' | 'sink'
  | 'plumbing-fixture' | 'lighting' | 'appliance' | 'door' | 'window' | 'hardware'
  | 'baseboard' | 'crown-molding' | 'paint' | 'stone' | 'paver' | 'furniture';

export type UnitOfMeasure = 'each' | 'sqft' | 'linear-ft' | 'box' | 'gallon';

export type Product = {
  id: string;
  manufacturer: string;
  collection?: string;
  model?: string;
  sku: string;
  name: string;
  category: ProductCategory;
  dimensions?: { width?: number; height?: number; depth?: number; unit: 'in' | 'mm' };
  unitOfMeasure: UnitOfMeasure;
  coveragePerUnit?: number;
  defaultWasteFactor?: number;
  materialCost?: number;
  laborCost?: number;
  markupPercent?: number;
  imageUrl?: string;
  modelUrl?: string;
  specificationUrl?: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type BuilderOptionTier = 'standard' | 'upgrade' | 'premium' | 'custom';

export type BuilderOption = {
  id: string;
  name: string;
  tier: BuilderOptionTier;
  productId: string;
  priceAdjustment?: number;
  included?: boolean;
};

export type Selection = {
  id: string;
  projectId: string;
  targetId: string;
  targetType: 'room' | 'surface' | 'object';
  productId: string;
  quantity: number;
  wasteFactor: number;
  optionId?: string;
};

export function calculateSelectionPrice(selection: Selection, product: Product): number | null {
  if (product.materialCost == null) return null;
  const material = selection.quantity * product.materialCost;
  const labor = selection.quantity * (product.laborCost ?? 0);
  return (material + labor) * (1 + (product.markupPercent ?? 0) / 100);
}
