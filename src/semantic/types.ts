import type { CadPoint } from '../cad/types';

export type SemanticValidationState = 'imported' | 'inferred' | 'confirmed' | 'modified';
export type SemanticKind = 'wall' | 'door' | 'window' | 'room' | 'column' | 'stair' | 'fixture' | 'cabinet' | 'unknown';

export type SemanticEvidence = {
  sourceCadEntityIds: string[];
  method: string;
  confidence: number;
};

export type WallCandidate = {
  id: string;
  kind: 'wall';
  start: CadPoint;
  end: CadPoint;
  thickness: number;
  height?: number;
  evidence: SemanticEvidence;
  validationState: SemanticValidationState;
};

export type OpeningCandidate = {
  id: string;
  kind: 'door' | 'window';
  center: CadPoint;
  width: number;
  height: number;
  sillHeight?: number;
  subtype?: string;
  hostWallCandidateId?: string;
  offsetFromWallStart?: number;
  evidence: SemanticEvidence;
  validationState: SemanticValidationState;
};

export type RoomCandidate = {
  id: string;
  kind: 'room';
  boundary: CadPoint[];
  label?: string;
  evidence: SemanticEvidence;
  validationState: SemanticValidationState;
};

export type SemanticCandidate = WallCandidate | OpeningCandidate | RoomCandidate;

export type SemanticExtractionResult = {
  candidates: SemanticCandidate[];
  warnings: string[];
};
