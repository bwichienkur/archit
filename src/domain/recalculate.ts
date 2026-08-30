import type { ArchitecturalRoom, ArchitecturalWall, BuildingModelV2 } from './building';
import { detectRoomCandidates } from '../semantic/roomDetector';
import type { WallCandidate } from '../semantic/types';

export function recalculateInferredRooms(model: BuildingModelV2): BuildingModelV2 {
  const preservedRooms = model.rooms.filter(room => room.lineage.validationState !== 'inferred');
  const inferredWalls = model.walls.map(toWallCandidate);
  const roomResult = detectRoomCandidates(inferredWalls);
  const levelId = model.levels[0]?.id;
  if (!levelId) return model;

  const generatedRooms: ArchitecturalRoom[] = roomResult.candidates.map((candidate, index) => ({
    id: stableRoomId(candidate.boundary),
    levelId,
    name: candidate.label ?? `Room ${index + 1}`,
    roomType: 'unclassified',
    boundary: candidate.boundary.map(point => ({ x: point.x, y: point.y })),
    ceilingHeight: model.levels.find(level => level.id === levelId)?.defaultCeilingHeight ?? 9,
    lineage: {
      sourceCadEntityIds: [...candidate.evidence.sourceCadEntityIds],
      inferenceMethod: candidate.evidence.method,
      confidence: candidate.evidence.confidence,
      validationState: 'inferred',
    },
  }));

  return { ...model, rooms: [...preservedRooms, ...generatedRooms] };
}

function toWallCandidate(wall: ArchitecturalWall): WallCandidate {
  return {
    id: wall.id,
    kind: 'wall',
    start: wall.start,
    end: wall.end,
    thickness: wall.thickness,
    height: wall.height,
    evidence: {
      sourceCadEntityIds: [...wall.lineage.sourceCadEntityIds],
      method: wall.lineage.inferenceMethod ?? 'building-model-wall',
      confidence: wall.lineage.confidence ?? (wall.lineage.validationState === 'confirmed' ? 1 : 0.8),
    },
    validationState: wall.lineage.validationState,
  };
}

function stableRoomId(boundary: Array<{ x: number; y: number }>) {
  const normalized = normalizeBoundary(boundary)
    .map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)}`)
    .join('|');
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `room:auto:${(hash >>> 0).toString(16)}`;
}

function normalizeBoundary(boundary: Array<{ x: number; y: number }>) {
  if (boundary.length === 0) return boundary;
  let start = 0;
  for (let i = 1; i < boundary.length; i += 1) {
    const a = boundary[i];
    const b = boundary[start];
    if (a.x < b.x || (a.x === b.x && a.y < b.y)) start = i;
  }
  return [...boundary.slice(start), ...boundary.slice(0, start)];
}
