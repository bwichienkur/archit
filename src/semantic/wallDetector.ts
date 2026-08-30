import type { CadDocument, CadEntity, CadPoint } from '../cad/types';
import type { SemanticExtractionResult, WallCandidate } from './types';

type Segment = { entity: CadEntity; a: CadPoint; b: CadPoint };

function asPoint(value: unknown): CadPoint | null {
  if (!value || typeof value !== 'object') return null;
  const x = Number((value as Record<string, unknown>).x);
  const y = Number((value as Record<string, unknown>).y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function toSegment(entity: CadEntity): Segment | null {
  if (entity.type !== 'line') return null;
  const a = asPoint(entity.geometry.start ?? entity.geometry.a);
  const b = asPoint(entity.geometry.end ?? entity.geometry.b);
  return a && b ? { entity, a, b } : null;
}

function length(s: Segment) { return Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y); }
function angle(s: Segment) { return Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x); }
function midpoint(s: Segment): CadPoint { return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }; }

function parallel(a: Segment, b: Segment, toleranceRadians: number) {
  let d = Math.abs(angle(a) - angle(b)) % Math.PI;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d <= toleranceRadians;
}

function pointLineDistance(p: CadPoint, s: Segment) {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const denom = Math.hypot(dx, dy);
  return denom === 0 ? Infinity : Math.abs(dy * p.x - dx * p.y + s.b.x * s.a.y - s.b.y * s.a.x) / denom;
}

function projectScalar(p: CadPoint, origin: CadPoint, ux: number, uy: number) {
  return (p.x - origin.x) * ux + (p.y - origin.y) * uy;
}

function overlapRatio(a: Segment, b: Segment) {
  const len = length(a);
  if (len === 0) return 0;
  const ux = (a.b.x - a.a.x) / len;
  const uy = (a.b.y - a.a.y) / len;
  const a0 = 0;
  const a1 = len;
  const b0 = projectScalar(b.a, a.a, ux, uy);
  const b1 = projectScalar(b.b, a.a, ux, uy);
  const lo = Math.max(a0, Math.min(b0, b1));
  const hi = Math.min(a1, Math.max(b0, b1));
  return Math.max(0, hi - lo) / Math.min(len, length(b));
}

export type WallDetectionOptions = {
  minLength: number;
  minThickness: number;
  maxThickness: number;
  angleToleranceDegrees: number;
  minOverlapRatio: number;
  defaultHeight: number;
};

const DEFAULTS: WallDetectionOptions = {
  minLength: 24,
  minThickness: 3,
  maxThickness: 16,
  angleToleranceDegrees: 1,
  minOverlapRatio: 0.65,
  defaultHeight: 120,
};

export function detectWallCandidates(document: CadDocument, options: Partial<WallDetectionOptions> = {}): SemanticExtractionResult {
  const config = { ...DEFAULTS, ...options };
  const segments = document.entities.map(toSegment).filter((x): x is Segment => !!x).filter(x => length(x) >= config.minLength);
  const consumed = new Set<string>();
  const candidates: WallCandidate[] = [];

  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    if (consumed.has(a.entity.id)) continue;
    let best: { segment: Segment; thickness: number; overlap: number } | null = null;

    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      if (consumed.has(b.entity.id) || a.entity.layerId !== b.entity.layerId) continue;
      if (!parallel(a, b, config.angleToleranceDegrees * Math.PI / 180)) continue;
      const thickness = pointLineDistance(midpoint(b), a);
      if (thickness < config.minThickness || thickness > config.maxThickness) continue;
      const overlap = overlapRatio(a, b);
      if (overlap < config.minOverlapRatio) continue;
      if (!best || overlap > best.overlap) best = { segment: b, thickness, overlap };
    }

    if (!best) continue;
    consumed.add(a.entity.id);
    consumed.add(best.segment.entity.id);
    const bm = midpoint(best.segment);
    const am = midpoint(a);
    const offsetX = (bm.x - am.x) / 2;
    const offsetY = (bm.y - am.y) / 2;
    const confidence = Math.min(0.98, 0.55 + best.overlap * 0.35 + (a.entity.layerId === best.segment.entity.layerId ? 0.08 : 0));
    candidates.push({
      id: `wall-candidate-${candidates.length + 1}`,
      kind: 'wall',
      start: { x: a.a.x + offsetX, y: a.a.y + offsetY },
      end: { x: a.b.x + offsetX, y: a.b.y + offsetY },
      thickness: best.thickness,
      height: config.defaultHeight,
      evidence: {
        sourceCadEntityIds: [a.entity.id, best.segment.entity.id],
        method: 'parallel-line-pair',
        confidence,
      },
      validationState: 'inferred',
    });
  }

  return {
    candidates,
    warnings: candidates.length === 0 ? ['No wall candidates met deterministic parallel-line thresholds.'] : [],
  };
}
