import { create } from 'zustand';
import type { CadDocument } from '../cad/types';
import type { ArchitecturalWall, BuildingModelV2, WallOpening } from '../domain/building';
import { recalculateInferredRooms } from '../domain/recalculate';
import { validateHostedOpening } from '../domain/wallGraph';
import { createBuildingModelFromCandidates } from '../semantic/acceptance';
import type { ReviewedCandidate } from '../semantic/store';
import { BuildingCommandHistory, UpdateArchitecturalWallCommand, UpdateWallOpeningCommand } from './buildingCommands';

export type BuildingSelection =
  | { kind: 'wall'; id: string }
  | { kind: 'room'; id: string }
  | { kind: 'opening'; id: string }
  | null;

type BuildingEditorState = {
  model: BuildingModelV2 | null;
  selection: BuildingSelection;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  buildFromReviewedCad(document: CadDocument, projectName: string, reviewed: ReviewedCandidate[]): void;
  replaceModel(model: BuildingModelV2, selection?: BuildingSelection): void;
  select(selection: BuildingSelection): void;
  updateWall(wallId: string, patch: Partial<Pick<ArchitecturalWall, 'start' | 'end' | 'thickness' | 'height' | 'wallType'>>): void;
  updateOpening(openingId: string, patch: Partial<Pick<WallOpening, 'offsetFromWallStart' | 'width' | 'height' | 'sillHeight' | 'subtype'>>): void;
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

  replaceModel: (model, selection = null) => {
    history.clear();
    set({ model, selection, error: null, canUndo: false, canRedo: false });
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
    const hosted = current.openings.filter(opening => opening.hostWallId === wallId);
    const issues = hosted.flatMap(opening => validateHostedOpening(opening, after).map(issue => `${opening.id}: ${issue}`));
    if (issues.length) {
      set({ error: `Wall edit would invalidate hosted openings: ${issues.join(' ')}` });
      return;
    }
    const command = new UpdateArchitecturalWallCommand(before, after, describePatch(patch));
    const model = history.execute(current, command);
    set({ model, error: null, canUndo: history.canUndo, canRedo: history.canRedo });
  },

  updateOpening: (openingId, patch) => {
    const current = get().model;
    if (!current) return;
    const before = current.openings.find(opening => opening.id === openingId);
    if (!before) return;
    const hostWall = current.walls.find(wall => wall.id === before.hostWallId);
    if (!hostWall) {
      set({ error: `Opening ${openingId} references missing host wall ${before.hostWallId}.` });
      return;
    }
    const after: WallOpening = {
      ...before,
      ...patch,
      lineage: { ...before.lineage, validationState: 'modified' },
    };
    const issues = validateHostedOpening(after, hostWall);
    if (issues.length) {
      set({ error: `Opening edit is invalid: ${issues.join(' ')}` });
      return;
    }
    const siblings = current.openings.filter(opening => opening.hostWallId === before.hostWallId && opening.id !== openingId);
    const start = after.offsetFromWallStart;
    const end = start + after.width;
    const overlap = siblings.find(opening => start < opening.offsetFromWallStart + opening.width && end > opening.offsetFromWallStart);
    if (overlap) {
      set({ error: `Opening edit overlaps ${overlap.id}.` });
      return;
    }
    const command = new UpdateWallOpeningCommand(before, after, describeOpeningPatch(patch));
    const model = history.execute(current, command);
    set({ model, error: null, canUndo: history.canUndo, canRedo: history.canRedo });
  },

  undo: () => {
    const current = get().model;
    if (!current) return;
    set({ model: history.undo(current), error: null, canUndo: history.canUndo, canRedo: history.canRedo });
  },

  redo: () => {
    const current = get().model;
    if (!current) return;
    set({ model: history.redo(current), error: null, canUndo: history.canUndo, canRedo: history.canRedo });
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

function describeOpeningPatch(patch: Partial<Pick<WallOpening, 'offsetFromWallStart' | 'width' | 'height' | 'sillHeight' | 'subtype'>>) {
  if (patch.offsetFromWallStart != null) return 'Move opening';
  if (patch.width != null || patch.height != null) return 'Resize opening';
  if (patch.sillHeight != null) return 'Change sill height';
  if (patch.subtype != null) return 'Change opening subtype';
  return 'Update opening';
}
