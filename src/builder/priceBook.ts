import type { Product } from './catalog';

export type PriceBookEntry = {
  id: string;
  priceBookId: string;
  productId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  materialCost?: number;
  laborCost?: number;
  markupPercent?: number;
  allowanceAmount?: number;
  subcontractor?: string;
  region?: string;
  notes?: string;
};

export type PriceBook = {
  id: string;
  organizationId: string;
  name: string;
  currency: string;
  entries: PriceBookEntry[];
};

export type ResolvedProductPricing = {
  materialCost?: number;
  laborCost?: number;
  markupPercent: number;
  allowanceAmount?: number;
  source: 'catalog' | 'price-book';
  entryId?: string;
};

export function resolveProductPricing(product: Product, priceBook: PriceBook | null, at = new Date()): ResolvedProductPricing {
  const active = priceBook?.entries
    .filter(entry => entry.productId === product.id && isActive(entry, at))
    .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom))[0];

  if (!active) {
    return {
      materialCost: product.materialCost,
      laborCost: product.laborCost,
      markupPercent: product.markupPercent ?? 0,
      source: 'catalog',
    };
  }

  return {
    materialCost: active.materialCost ?? product.materialCost,
    laborCost: active.laborCost ?? product.laborCost,
    markupPercent: active.markupPercent ?? product.markupPercent ?? 0,
    allowanceAmount: active.allowanceAmount,
    source: 'price-book',
    entryId: active.id,
  };
}

export function calculateConfiguredPrice(quantity: number, wasteFactor: number, pricing: ResolvedProductPricing) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be a non-negative number.');
  if (!Number.isFinite(wasteFactor) || wasteFactor < 0 || wasteFactor > 1) throw new Error('Waste factor must be between 0 and 1.');
  const billableQuantity = quantity * (1 + wasteFactor);
  const material = billableQuantity * (pricing.materialCost ?? 0);
  const labor = billableQuantity * (pricing.laborCost ?? 0);
  const subtotal = material + labor;
  const total = subtotal * (1 + pricing.markupPercent / 100);
  return { billableQuantity, material, labor, subtotal, total, allowanceAmount: pricing.allowanceAmount };
}

function isActive(entry: PriceBookEntry, at: Date) {
  const instant = at.getTime();
  const from = Date.parse(entry.effectiveFrom);
  const to = entry.effectiveTo ? Date.parse(entry.effectiveTo) : Number.POSITIVE_INFINITY;
  return Number.isFinite(from) && instant >= from && instant <= to;
}
