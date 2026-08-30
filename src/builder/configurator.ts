import type { Product } from './catalog';
import { evaluateCompatibility, type ConfigurationTarget } from './compatibility';

export type ConfigurationSelection = {
  id: string;
  target: ConfigurationTarget;
  productId: string;
  quantity: number;
  wasteFactor: number;
  optionId?: string;
  status: 'draft' | 'customer-approved' | 'builder-approved' | 'locked';
  note?: string;
};

export type ConfigurationSession = {
  projectId: string;
  selections: ConfigurationSelection[];
};

export type AssignmentResult = {
  session: ConfigurationSession;
  selection?: ConfigurationSelection;
  errors: string[];
};

export function assignProduct(
  session: ConfigurationSession,
  target: ConfigurationTarget,
  product: Product,
  quantity: number,
  wasteFactor = product.defaultWasteFactor ?? 0,
): AssignmentResult {
  const compatibility = evaluateCompatibility(product, target);
  const errors = [...compatibility.reasons];
  if (!Number.isFinite(quantity) || quantity <= 0) errors.push('Selection quantity must be greater than zero.');
  if (!Number.isFinite(wasteFactor) || wasteFactor < 0 || wasteFactor > 1) errors.push('Waste factor must be between 0 and 1.');
  if (errors.length > 0) return { session, errors };

  const existing = session.selections.find(selection => selection.target.id === target.id);
  if (existing?.status === 'locked') return { session, errors: ['Locked selections cannot be replaced.'] };

  const selection: ConfigurationSelection = {
    id: existing?.id ?? `selection:${session.projectId}:${target.id}`,
    target: { ...target },
    productId: product.id,
    quantity,
    wasteFactor,
    optionId: existing?.optionId,
    status: 'draft',
    note: existing?.note,
  };

  return {
    session: {
      ...session,
      selections: [...session.selections.filter(item => item.target.id !== target.id), selection],
    },
    selection,
    errors: [],
  };
}

export function removeSelection(session: ConfigurationSession, targetId: string): AssignmentResult {
  const existing = session.selections.find(selection => selection.target.id === targetId);
  if (!existing) return { session, errors: [] };
  if (existing.status === 'locked') return { session, errors: ['Locked selections cannot be removed.'] };
  return { session: { ...session, selections: session.selections.filter(selection => selection.target.id !== targetId) }, errors: [] };
}

export function updateSelectionStatus(
  session: ConfigurationSession,
  selectionId: string,
  status: ConfigurationSelection['status'],
): ConfigurationSession {
  return {
    ...session,
    selections: session.selections.map(selection => selection.id === selectionId ? { ...selection, status } : selection),
  };
}

export function selectionForTarget(session: ConfigurationSession, targetId: string) {
  return session.selections.find(selection => selection.target.id === targetId) ?? null;
}
