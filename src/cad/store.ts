import { create } from 'zustand';
import type { CadDocument, CadImportValidation } from './types';

export type CadSelection = {
  entityId: string | null;
};

type CadState = {
  document: CadDocument | null;
  validation: CadImportValidation | null;
  hiddenLayerIds: Set<string>;
  selection: CadSelection;
  setImportedCad(document: CadDocument | null, validation: CadImportValidation | null): void;
  setEntitySelection(entityId: string | null): void;
  setLayerVisible(layerId: string, visible: boolean): void;
  isolateLayer(layerId: string): void;
  showAllLayers(): void;
  clearCad(): void;
};

export const useCadStore = create<CadState>((set, get) => ({
  document: null,
  validation: null,
  hiddenLayerIds: new Set<string>(),
  selection: { entityId: null },

  setImportedCad: (document, validation) => set({
    document,
    validation,
    hiddenLayerIds: new Set<string>(),
    selection: { entityId: null }
  }),

  setEntitySelection: entityId => set({ selection: { entityId } }),

  setLayerVisible: (layerId, visible) => {
    const hidden = new Set(get().hiddenLayerIds);
    if (visible) hidden.delete(layerId);
    else hidden.add(layerId);
    set({ hiddenLayerIds: hidden });
  },

  isolateLayer: layerId => {
    const document = get().document;
    if (!document) return;
    set({ hiddenLayerIds: new Set(document.layers.filter(layer => layer.id !== layerId).map(layer => layer.id)) });
  },

  showAllLayers: () => set({ hiddenLayerIds: new Set<string>() }),

  clearCad: () => set({
    document: null,
    validation: null,
    hiddenLayerIds: new Set<string>(),
    selection: { entityId: null }
  })
}));
