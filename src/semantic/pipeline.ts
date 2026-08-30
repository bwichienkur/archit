import type { CadDocument } from '../cad/types';
import { detectWallCandidates, type WallDetectionOptions } from './wallDetector';
import type { SemanticExtractionResult } from './types';

export type SemanticPipelineOptions = {
  walls?: Partial<WallDetectionOptions>;
};

export function extractSemanticCandidates(document: CadDocument, options: SemanticPipelineOptions = {}): SemanticExtractionResult {
  const wallResult = detectWallCandidates(document, options.walls);
  return {
    candidates: [...wallResult.candidates],
    warnings: [...wallResult.warnings],
  };
}
