import type { CadDocument } from '../cad/types';
import { detectRoomCandidates, type RoomDetectionOptions } from './roomDetector';
import { detectWallCandidates, type WallDetectionOptions } from './wallDetector';
import type { SemanticExtractionResult } from './types';

export type SemanticPipelineOptions = {
  walls?: Partial<WallDetectionOptions>;
  rooms?: Partial<RoomDetectionOptions>;
};

export function extractSemanticCandidates(document: CadDocument, options: SemanticPipelineOptions = {}): SemanticExtractionResult {
  const wallResult = detectWallCandidates(document, options.walls);
  const roomResult = detectRoomCandidates(wallResult.candidates, options.rooms);
  return {
    candidates: [...wallResult.candidates, ...roomResult.candidates],
    warnings: [...wallResult.warnings, ...roomResult.warnings],
  };
}
