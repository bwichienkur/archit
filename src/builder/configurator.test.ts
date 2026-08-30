import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import { assignProduct, removeSelection, updateSelectionStatus, type ConfigurationSession } from './configurator';

const flooring: Product = {
  id: 'p-floor', manufacturer: 'Test', sku: 'F1', name: 'Floor', category: 'flooring',
  unitOfMeasure: 'sqft', defaultWasteFactor: 0.1, metadata: {},
};

function session(): ConfigurationSession { return { projectId: 'p1', selections: [] }; }

describe('builder configurator', () => {
  it('assigns compatible products and replaces draft selections', () => {
    const target = { id: 'surface:floor:1', targetType: 'surface' as const, surfaceRole: 'floor' as const };
    const first = assignProduct(session(), target, flooring, 100);
    expect(first.errors).toEqual([]);
    expect(first.selection?.wasteFactor).toBe(0.1);

    const replacement = assignProduct(first.session, target, { ...flooring, id: 'p-floor-2' }, 120, 0.08);
    expect(replacement.session.selections).toHaveLength(1);
    expect(replacement.selection?.productId).toBe('p-floor-2');
  });

  it('rejects incompatible product placement', () => {
    const result = assignProduct(session(), { id:'surface:wall:1', targetType:'surface', surfaceRole:'wall' }, flooring, 100);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.session.selections).toHaveLength(0);
  });

  it('protects locked selections from replacement or removal', () => {
    const target = { id: 'surface:floor:1', targetType: 'surface' as const, surfaceRole: 'floor' as const };
    const assigned = assignProduct(session(), target, flooring, 100);
    const locked = updateSelectionStatus(assigned.session, assigned.selection!.id, 'locked');
    expect(assignProduct(locked, target, { ...flooring, id: 'new' }, 100).errors).toContain('Locked selections cannot be replaced.');
    expect(removeSelection(locked, target.id).errors).toContain('Locked selections cannot be removed.');
  });
});
