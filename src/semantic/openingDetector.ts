import type { CadDocument, CadEntity, CadPoint } from '../cad/types';
import { convertLength } from '../units/architectural';
import type { OpeningCandidate, SemanticExtractionResult, WallCandidate } from './types';

export type OpeningDetectionOptions = {
  hostTolerance: number;
};

export function detectOpeningCandidates(
  document: CadDocument,
  walls: WallCandidate[],
  options: Partial<OpeningDetectionOptions> = {},
): SemanticExtractionResult {
  const warnings: string[] = [];
  const candidates: OpeningCandidate[] = [];
  const hostTolerance = options.hostTolerance ?? defaultHostTolerance(document);

  for (const entity of document.entities) {
    const classification = classifyOpening(entity);
    if (!classification) continue;

    const width = propertyNumber(entity, ['width', 'doorwidth', 'windowwidth', 'nominalwidth', 'openingwidth']);
    const height = propertyNumber(entity, ['height', 'doorheight', 'windowheight', 'nominalheight', 'openingheight']);
    if (!(width && width > 0) || !(height && height > 0)) {
      warnings.push(`Opening-like CAD entity ${entity.sourceHandle} was classified as ${classification.kind} but has no explicit positive width/height metadata; it was not promoted to a semantic opening candidate.`);
      continue;
    }

    const center = entityCenter(entity);
    if (!center) {
      warnings.push(`Opening-like CAD entity ${entity.sourceHandle} has no usable insertion point or bounds center.`);
      continue;
    }

    const host = findHostWall(center, width, walls, hostTolerance);
    const sillHeight = classification.kind === 'window'
      ? propertyNumber(entity, ['sillheight', 'sill', 'baseheight', 'elevation'])
      : undefined;
    const handing = classification.kind === 'door'
      ? parseHanding(propertyString(entity, ['handing', 'hand', 'doorhand', 'hingeside']))
      : undefined;
    const swing = classification.kind === 'door'
      ? parseSwing(propertyString(entity, ['swing', 'swingdirection', 'doorswing', 'swingdir']))
      : undefined;

    const confidence = Math.min(0.99,
      classification.confidence + (host ? 0.08 : 0) + (classification.source === 'metadata' ? 0.05 : 0));

    candidates.push({
      id: `opening-candidate-${candidates.length + 1}`,
      kind: classification.kind,
      center,
      width,
      height,
      sillHeight,
      subtype: propertyString(entity, ['subtype', 'style', 'doorstyle', 'windowstyle']) ?? entity.sourceBlockName,
      handing,
      swing,
      hostWallCandidateId: host?.wall.id,
      offsetFromWallStart: host?.offsetFromWallStart,
      evidence: {
        sourceCadEntityIds: [entity.id],
        method: classification.source === 'metadata' ? 'explicit-opening-metadata' : 'classified-block-name',
        confidence,
      },
      validationState: 'inferred',
    });

    if (!host) warnings.push(`Opening candidate ${entity.sourceHandle} could not be matched to a wall within the deterministic host tolerance.`);
  }

  return { candidates, warnings };
}

type OpeningClassification = { kind: 'door' | 'window'; confidence: number; source: 'metadata' | 'block-name' };

function classifyOpening(entity: CadEntity): OpeningClassification | null {
  const explicit = propertyString(entity, ['semantictype', 'objecttype', 'entitytype', 'category', 'aecobjecttype', 'architecturaltype']);
  const explicitKind = kindFromText(explicit);
  if (explicitKind) return { kind: explicitKind, confidence: 0.88, source: 'metadata' };

  if (entity.type !== 'block-reference') return null;
  const blockName = entity.sourceBlockName ?? propertyString(entity, ['blockname', 'name']);
  const blockKind = kindFromText(blockName);
  return blockKind ? { kind: blockKind, confidence: 0.72, source: 'block-name' } : null;
}

function kindFromText(value?: string): 'door' | 'window' | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (/\bdoor\b|\bdr\b|\bentry\b/.test(normalized)) return 'door';
  if (/\bwindow\b|\bwin\b|\bw dw\b/.test(normalized)) return 'window';
  return null;
}

function parseHanding(value?: string): 'left' | 'right' | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (/^(left|lh|left hand|left handed|hinge left)$/.test(normalized)) return 'left';
  if (/^(right|rh|right hand|right handed|hinge right)$/.test(normalized)) return 'right';
  return undefined;
}

function parseSwing(value?: string): 'in' | 'out' | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (/^(in|inswing|in swing|swing in)$/.test(normalized)) return 'in';
  if (/^(out|outswing|out swing|swing out)$/.test(normalized)) return 'out';
  return undefined;
}

function entityCenter(entity: CadEntity): CadPoint | null {
  const geometry = entity.geometry as Record<string, unknown>;
  const direct = point(geometry.insertionPoint) ?? point(geometry.position) ?? point(geometry.center);
  if (direct) return direct;
  const affine = geometry.affine2d;
  if (Array.isArray(affine) && affine.length >= 6 && Number.isFinite(Number(affine[4])) && Number.isFinite(Number(affine[5]))) {
    return { x: Number(affine[4]), y: Number(affine[5]) };
  }
  if (entity.bounds?.min && entity.bounds?.max) {
    return {
      x: (entity.bounds.min.x + entity.bounds.max.x) / 2,
      y: (entity.bounds.min.y + entity.bounds.max.y) / 2,
    };
  }
  return null;
}

function findHostWall(center: CadPoint, width: number, walls: WallCandidate[], tolerance: number) {
  let best: { wall: WallCandidate; distance: number; offsetFromWallStart: number } | null = null;
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0 || width > length) continue;
    const t = ((center.x - wall.start.x) * dx + (center.y - wall.start.y) * dy) / (length * length);
    if (t < 0 || t > 1) continue;
    const projected = { x: wall.start.x + dx * t, y: wall.start.y + dy * t };
    const distance = Math.hypot(center.x - projected.x, center.y - projected.y);
    const allowedDistance = Math.max(tolerance, wall.thickness * 1.25);
    if (distance > allowedDistance) continue;
    const offsetFromWallStart = t * length - width / 2;
    if (offsetFromWallStart < 0 || offsetFromWallStart + width > length) continue;
    if (!best || distance < best.distance) best = { wall, distance, offsetFromWallStart };
  }
  return best;
}

function defaultHostTolerance(document: CadDocument) {
  if (document.drawingUnits === 'unitless') return 0;
  return convertLength(8, 'inches', document.drawingUnits);
}

function propertyNumber(entity: CadEntity, keys: string[]): number | undefined {
  const wanted = new Set(keys.map(key => key.toLowerCase()));
  for (const [key, value] of Object.entries(entity.properties)) {
    if (!wanted.has(key.toLowerCase())) continue;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function propertyString(entity: CadEntity, keys: string[]): string | undefined {
  const wanted = new Set(keys.map(key => key.toLowerCase()));
  for (const [key, value] of Object.entries(entity.properties)) {
    if (!wanted.has(key.toLowerCase()) || value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

function point(value: unknown): CadPoint | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
