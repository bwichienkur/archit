import { create } from 'zustand';
import type { CadDocument } from '../cad/types';
import { extractSemanticCandidates } from './pipeline';
import type { SemanticCandidate } from './types';

export type CandidateReviewState = 'pending' | 'accepted' | 'rejected';

export type ReviewedCandidate = {
  candidate: SemanticCandidate;
  reviewState: CandidateReviewState;
};

type SemanticState = {
  candidates: ReviewedCandidate[];
  warnings: string[];
  selectedCandidateId: string | null;
  runExtraction(document: CadDocument): void;
  selectCandidate(id: string | null): void;
  acceptCandidate(id: string): void;
  rejectCandidate(id: string): void;
  resetCandidate(id: string): void;
  acceptAll(kind?: SemanticCandidate['kind']): void;
  clear(): void;
};

export const useSemanticStore = create<SemanticState>((set) => ({
  candidates: [],
  warnings: [],
  selectedCandidateId: null,

  runExtraction: document => {
    const result = extractSemanticCandidates(document);
    set({
      candidates: result.candidates.map(candidate => ({ candidate, reviewState: 'pending' as const })),
      warnings: result.warnings,
      selectedCandidateId: result.candidates[0]?.id ?? null,
    });
  },

  selectCandidate: selectedCandidateId => set({ selectedCandidateId }),

  acceptCandidate: id => set(state => ({
    candidates: state.candidates.map(item => item.candidate.id === id ? { ...item, reviewState: 'accepted' } : item),
  })),

  rejectCandidate: id => set(state => ({
    candidates: state.candidates.map(item => item.candidate.id === id ? { ...item, reviewState: 'rejected' } : item),
  })),

  resetCandidate: id => set(state => ({
    candidates: state.candidates.map(item => item.candidate.id === id ? { ...item, reviewState: 'pending' } : item),
  })),

  acceptAll: kind => set(state => ({
    candidates: state.candidates.map(item => !kind || item.candidate.kind === kind ? { ...item, reviewState: 'accepted' } : item),
  })),

  clear: () => set({ candidates: [], warnings: [], selectedCandidateId: null }),
}));
