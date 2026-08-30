import type { CadDocument } from '../cad/types';
import { detectOpeningCandidates, type OpeningDetectionOptions } from './openingDetector';
import { detectRoomCandidates, type RoomDetectionOptions } from './roomDetector';
import { detectWallCandidates, type WallDetectionOptions } from './wallDetector';
import type { SemanticExtractionResult, WallCandidate } from './types';

export type SemanticPipelineOptions = {
  walls?: Partial<WallDetectionOptions>;
  openings?: Partial<OpeningDetectionOptions>;
  rooms?: Partial<RoomDetectionOptions>;
};

export function extractSemanticCandidates(document: CadDocument, options: SemanticPipelineOptions = {}): SemanticExtractionResult {
  const wallResult = detectWallCandidates(document, options.walls);
  const walls = wallResult.candidates.filter((candidate): candidate is WallCandidate => candidate.kind === 'wall');
  const openingResult = detectOpeningCandidates(document, walls, options.openings);
  const roomResult = detectRoomCandidates(walls, options.rooms);
  return {
    candidates: [...walls, ...openingResult.candidates, ...roomResult.candidates],
    warnings: [...wallResult.warnings, ...openingResult.warnings, ...roomResult.warnings],
  };
}
