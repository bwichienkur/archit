import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import { evaluateCompatibility } from './compatibility';

function product(category: Product['category']): Product {
  return {
    id: category,
    manufacturer: 'Test',
    sku: category,
    name: category,
    category,
    unitOfMeasure: 'each',
    metadata: {},
  };
}

describe('builder product compatibility', () => {
  it('allows flooring on floor surfaces and rejects walls', () => {
    expect(evaluateCompatibility(product('flooring'), { id:'floor', targetType:'surface', surfaceRole:'floor' }).allowed).toBe(true);
    expect(evaluateCompatibility(product('flooring'), { id:'wall', targetType:'surface', surfaceRole:'wall' }).allowed).toBe(false);
  });

  it('allows faucets only on faucet-compatible objects', () => {
    expect(evaluateCompatibility(product('faucet'), { id:'sink', targetType:'object', objectRole:'sink' }).allowed).toBe(true);
    const invalid = evaluateCompatibility(product('faucet'), { id:'door', targetType:'object', objectRole:'door' });
    expect(invalid.allowed).toBe(false);
    expect(invalid.reasons).toHaveLength(1);
  });

  it('supports furniture at room-level targets', () => {
    expect(evaluateCompatibility(product('furniture'), { id:'living-room', targetType:'room', roomType:'living' }).allowed).toBe(true);
  });
});
