import { create } from 'zustand';
import type { CadDocument } from '../cad/types';
import type { ArchitecturalWall, BuildingModelV2 } from '../domain/building';
import { recalculateInferredRooms } from '../domain/recalculate';
import { createBuildingModelFromCandidates } from '../semantic/acceptance';
import type { ReviewedCandidate } from '../semantic/store';
import { BuildingCommandHistory, UpdateArchitecturalWallCommand } from './buildingCommands';

export type BuildingSelection =
  | { kind: 'wall'; id: string }
  | { kind: 'room'; id: string }
  | null;

type BuildingEditorState = {
  model: BuildingModelV2 | null;
  selection: BuildingSelection;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  buildFromReviewedCad(document: CadDocument, projectName: string, reviewed: ReviewedCandidate[]): void;
  select(selection: BuildingSelection): void;
  updateWall(wallId: string, patch: Partial<Pick<ArchitecturalWall, 'start' | 'end' | 'thickness' | 'height' | 'wallType'>>): void;
  undo(): void;
  redo(): void;
  clear(): void;
};

const history = new BuildingCommandHistory();

export const useBuildingEditorStore = create<BuildingEditorState>((set, get) => ({
  model: null,
  selection: null,
  error: null,
  canUndo: false,
  canRedo: false,

  buildFromReviewedCad: (document, projectName, reviewed) => {
    const accepted = reviewed.filter(item => item.reviewState === 'accepted').map(item => item.candidate);
    const acceptedIds = new Set(accepted.map(candidate => candidate.id));
    if (accepted.length === 0) {
      set({ error: 'Accept at least one semantic candidate before creating the building model.' });
      return;
    }
    if (document.drawingUnits === 'unitless') {
      set({ error: 'This DWG is unitless. Define its drawing units before creating an editable building model.' });
      return;
    }

    try {
      const model = createBuildingModelFromCandidates(accepted, acceptedIds, {
        projectId: localProjectId(document),
        projectName,
        units: document.drawingUnits === 'inches' || document.drawingUnits === 'feet' ? 'imperial' : 'metric',
        geometryUnits: document.drawingUnits,
      });
      history.clear();
      const withRooms = recalculateInferredRooms(model);
      set({ model: withRooms, selection: null, error: null, canUndo: false, canRedo: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Building model creation failed.' });
    }
  },

  select: selection => set({ selection }),

  updateWall: (wallId, patch) => {
    const current = get().model;
    if (!current) return;
    const before = current.walls.find(wall => wall.id === wallId);
    if (!before) return;
    const after: ArchitecturalWall = {
      ...before,
      ...patch,
      lineage: { ...before.lineage, validationState: 'modified' },
    };
    const command = new UpdateArchitecturalWallCommand(before, after, describePatch(patch));
    const model = history.execute(current, command);
    set({ model, error: null, canUndo: history.canUndo, canRedo: history.canRedo });
  },

  undo: () => {
    const current = get().model;
    if (!current) return;
    set({ model: history.undo(current), canUndo: history.canUndo, canRedo: history.canRedo });
  },

  redo: () => {
    const current = get().model;
    if (!current) return;
    set({ model: history.redo(current), canUndo: history.canUndo, canRedo: history.canRedo });
  },

  clear: () => {
    history.clear();
    set({ model: null, selection: null, error: null, canUndo: false, canRedo: false });
  },
}));

function localProjectId(document: CadDocument) {
  return `local:${document.sourceSha256 || document.sourceFileName}`;
}

function describePatch(patch: Partial<Pick<ArchitecturalWall, 'start' | 'end' | 'thickness' | 'height' | 'wallType'>>) {
  if (patch.start || patch.end) return 'Move wall endpoint';
  if (patch.thickness != null) return 'Change wall thickness';
  if (patch.height != null) return 'Change wall height';
  if (patch.wallType != null) return 'Change wall type';
  return 'Update wall';
}
