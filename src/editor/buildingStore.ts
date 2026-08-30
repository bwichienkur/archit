import { create } from 'zustand';
import type { CadDocument } from '../cad/types';
import type { ArchitecturalWall, BuildingModelV2 } from '../domain/building';
import { recalculateInferredRooms } from '../domain/recalculate';
import { createBuildingModelFromCandidates } from '../semantic/acceptance';
import type { ReviewedCandidate } from '../semantic/store';

export type BuildingSelection =
  | { kind: 'wall'; id: string }
  | { kind: 'room'; id: string }
  | null;

type BuildingEditorState = {
  model: BuildingModelV2 | null;
  selection: BuildingSelection;
  error: string | null;
  buildFromReviewedCad(document: CadDocument, projectName: string, reviewed: ReviewedCandidate[]): void;
  select(selection: BuildingSelection): void;
  updateWall(wallId: string, patch: Partial<Pick<ArchitecturalWall, 'start' | 'end' | 'thickness' | 'height' | 'wallType'>>): void;
  clear(): void;
};

export const useBuildingEditorStore = create<BuildingEditorState>((set, get) => ({
  model: null,
  selection: null,
  error: null,

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
      const withRooms = recalculateInferredRooms(model);
      set({ model: withRooms, selection: null, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Building model creation failed.' });
    }
  },

  select: selection => set({ selection }),

  updateWall: (wallId, patch) => {
    const current = get().model;
    if (!current) return;
    const walls = current.walls.map(wall => wall.id === wallId
      ? { ...wall, ...patch, lineage: { ...wall.lineage, validationState: 'modified' as const } }
      : wall);
    set({ model: recalculateInferredRooms({ ...current, walls }), error: null });
  },

  clear: () => set({ model: null, selection: null, error: null }),
}));

function localProjectId(document: CadDocument) {
  return `local:${document.sourceSha256 || document.sourceFileName}`;
}
