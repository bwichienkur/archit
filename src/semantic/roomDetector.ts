import { polygonArea } from '../geometry/kernel';
import { buildEndpointTopology, findPlanarFaces } from '../geometry/topology';
import { resolveInteriorRoomFace } from './roomFaces';
import type { RoomCandidate, WallCandidate } from './types';

export type RoomDetectionOptions = {
  endpointTolerance: number;
  minimumArea: number;
};

const DEFAULTS: RoomDetectionOptions = {
  endpointTolerance: 1e-3,
  minimumArea: 1,
};

export function detectRoomCandidates(
  walls: WallCandidate[],
  options: Partial<RoomDetectionOptions> = {},
): { candidates: RoomCandidate[]; warnings: string[] } {
  const config = { ...DEFAULTS, ...options };
  const topology = buildEndpointTopology(
    walls.map(wall => ({
      id: wall.id,
      start: wall.start,
      end: wall.end,
      sourceIds: wall.evidence.sourceCadEntityIds,
    })),
    config.endpointTolerance,
  );

  const centerlineFaces = findPlanarFaces(topology).filter(face => polygonArea(face) >= config.minimumArea);
  let fallbackCount = 0;
  const candidates = centerlineFaces.map((centerlineBoundary, index): RoomCandidate => {
    const sourceCadEntityIds = collectBoundaryEvidence(centerlineBoundary, walls, config.endpointTolerance);
    const contributingWalls = walls.filter(wall => wall.evidence.sourceCadEntityIds.some(id => sourceCadEntityIds.includes(id)));
    const averageConfidence = contributingWalls.length === 0
      ? 0.5
      : contributingWalls.reduce((sum, wall) => sum + wall.evidence.confidence, 0) / contributingWalls.length;
    const resolved = resolveInteriorRoomFace(centerlineBoundary, walls, config.endpointTolerance);
    if (!resolved) fallbackCount += 1;

    return {
      id: `room:${index + 1}`,
      kind: 'room',
      boundary: resolved?.boundary ?? centerlineBoundary,
      evidence: {
        sourceCadEntityIds,
        method: resolved ? 'closed-wall-interior-face' : 'closed-wall-centerline-face',
        confidence: Math.max(0, Math.min(resolved ? 0.97 : 0.88, averageConfidence * (resolved ? 0.96 : 0.84))),
      },
      validationState: 'inferred',
    };
  });

  const warnings: string[] = [];
  if (walls.length > 0 && candidates.length === 0) {
    warnings.push('No closed room faces were found from wall topology. Gaps or unresolved wall joins may require review.');
  }
  if (fallbackCount > 0) {
    warnings.push(`${fallbackCount} room face${fallbackCount === 1 ? '' : 's'} could not be resolved to thickness-aware interior wall faces and remain centerline-based for review.`);
  }

  return { candidates, warnings };
}

function collectBoundaryEvidence(boundary: Array<{ x: number; y: number }>, walls: WallCandidate[], tolerance: number) {
  const ids = new Set<string>();
  for (let i = 0; i < boundary.length; i += 1) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    const wall = walls.find(candidate => sameSegment(a, b, candidate.start, candidate.end, tolerance));
    wall?.evidence.sourceCadEntityIds.forEach(id => ids.add(id));
  }
  return [...ids];
}

function sameSegment(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
  tolerance: number,
) {
  return (near(a1, b1, tolerance) && near(a2, b2, tolerance)) ||
    (near(a1, b2, tolerance) && near(a2, b1, tolerance));
}

function near(a: { x: number; y: number }, b: { x: number; y: number }, tolerance: number) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}
