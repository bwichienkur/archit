import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import { calculateConfiguredPrice, resolveProductPricing, type PriceBook } from './priceBook';

const product: Product = {
  id: 'p1', manufacturer: 'Test', sku: 'SKU', name: 'Tile', category: 'tile', unitOfMeasure: 'sqft',
  materialCost: 5, laborCost: 2, markupPercent: 10, metadata: {},
};

const priceBook: PriceBook = {
  id: 'pb1', organizationId: 'org1', name: 'Builder 2027', currency: 'USD', entries: [
    { id: 'old', priceBookId: 'pb1', productId: 'p1', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', materialCost: 6 },
    { id: 'current', priceBookId: 'pb1', productId: 'p1', effectiveFrom: '2027-01-01', materialCost: 7, laborCost: 3, markupPercent: 20, allowanceAmount: 500 },
  ],
};

describe('price books', () => {
  it('uses the active builder override without mutating catalog pricing', () => {
    const pricing = resolveProductPricing(product, priceBook, new Date('2027-06-01T00:00:00Z'));
    expect(pricing.source).toBe('price-book');
    expect(pricing.entryId).toBe('current');
    expect(pricing.materialCost).toBe(7);
    expect(product.materialCost).toBe(5);
  });

  it('falls back to catalog pricing when no override is active', () => {
    const pricing = resolveProductPricing(product, priceBook, new Date('2025-06-01T00:00:00Z'));
    expect(pricing.source).toBe('catalog');
    expect(pricing.materialCost).toBe(5);
  });

  it('calculates waste, labor and markup explicitly', () => {
    const pricing = resolveProductPricing(product, priceBook, new Date('2027-06-01T00:00:00Z'));
    const result = calculateConfiguredPrice(100, 0.1, pricing);
    expect(result.billableQuantity).toBeCloseTo(110);
    expect(result.material).toBeCloseTo(770);
    expect(result.labor).toBeCloseTo(330);
    expect(result.total).toBeCloseTo(1320);
  });
});
