import { create } from 'zustand';
import { demoModel, type BuildingModel, type Wall } from '../domain/model';
import { CommandHistory, UpdateWallCommand } from './commands';

const history = new CommandHistory();

type EditorState = {
  model: BuildingModel;
  selectedId: string | null;
  cadVisible: boolean;
  modelVisible: boolean;
  setSelectedId(id: string | null): void;
  setCadVisible(value: boolean): void;
  setModelVisible(value: boolean): void;
  confirmWall(id: string): void;
  updateWall(id: string, patch: Partial<Pick<Wall, 'start' | 'end' | 'thickness' | 'height' | 'name'>>): void;
  undo(): void;
  redo(): void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  model: demoModel,
  selectedId: 'w5',
  cadVisible: true,
  modelVisible: true,
  setSelectedId: selectedId => set({ selectedId }),
  setCadVisible: cadVisible => set({ cadVisible }),
  setModelVisible: modelVisible => set({ modelVisible }),
  confirmWall: id => {
    const current = get().model.walls.find(w => w.id === id);
    if (!current || current.validationState === 'confirmed') return;
    const next = { ...current, validationState: 'confirmed' as const };
    set({ model: history.execute(get().model, new UpdateWallCommand(current, next, 'Confirm wall')) });
  },
  updateWall: (id, patch) => {
    const current = get().model.walls.find(w => w.id === id);
    if (!current) return;
    const next: Wall = { ...current, ...patch, validationState: 'modified' };
    set({ model: history.execute(get().model, new UpdateWallCommand(current, next)) });
  },
  undo: () => set({ model: history.undo(get().model) }),
  redo: () => set({ model: history.redo(get().model) })
}));
