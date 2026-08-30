import type { ArchitecturalRoom, ArchitecturalWall, BuildingModelV2, Level, SourceLineage } from '../domain/building';
import type { RoomCandidate, SemanticCandidate, WallCandidate } from './types';

export type SemanticAcceptanceOptions = {
  projectId: string;
  projectName: string;
  units: 'imperial' | 'metric';
  level?: Level;
  defaultWallHeight?: number;
  defaultRoomType?: string;
};

export function createBuildingModelFromCandidates(
  candidates: SemanticCandidate[],
  acceptedCandidateIds: Set<string>,
  options: SemanticAcceptanceOptions,
): BuildingModelV2 {
  const level = options.level ?? defaultLevel(options.units);
  const accepted = candidates.filter(candidate => acceptedCandidateIds.has(candidate.id));

  const walls = accepted.filter((candidate): candidate is WallCandidate => candidate.kind === 'wall')
    .map(candidate => toArchitecturalWall(candidate, level.id, options.defaultWallHeight ?? level.defaultCeilingHeight));
  const rooms = accepted.filter((candidate): candidate is RoomCandidate => candidate.kind === 'room')
    .map((candidate, index) => toArchitecturalRoom(candidate, level.id, level.defaultCeilingHeight, options.defaultRoomType ?? 'unclassified', index));

  return {
    schemaVersion: 2,
    projectId: options.projectId,
    projectName: options.projectName,
    units: options.units,
    levels: [level],
    walls,
    openings: [],
    rooms,
    stairs: [],
    roofPlanes: [],
    cabinets: [],
    fixtures: [],
  };
}

function toArchitecturalWall(candidate: WallCandidate, levelId: string, defaultHeight: number): ArchitecturalWall {
  return {
    id: `wall:${candidate.id}`,
    levelId,
    name: `Wall ${candidate.id}`,
    start: { x: candidate.start.x, y: candidate.start.y },
    end: { x: candidate.end.x, y: candidate.end.y },
    thickness: candidate.thickness,
    height: candidate.height ?? defaultHeight,
    baseElevation: 0,
    wallType: 'unknown',
    openingIds: [],
    lineage: lineage(candidate),
  };
}

function toArchitecturalRoom(candidate: RoomCandidate, levelId: string, ceilingHeight: number, roomType: string, index: number): ArchitecturalRoom {
  return {
    id: `room:${candidate.id}`,
    levelId,
    name: candidate.label ?? `Room ${index + 1}`,
    roomType,
    boundary: candidate.boundary.map(point => ({ x: point.x, y: point.y })),
    ceilingHeight,
    lineage: lineage(candidate),
  };
}

function lineage(candidate: SemanticCandidate): SourceLineage {
  return {
    sourceCadEntityIds: [...candidate.evidence.sourceCadEntityIds],
    inferenceMethod: candidate.evidence.method,
    confidence: candidate.evidence.confidence,
    validationState: 'confirmed',
  };
}

function defaultLevel(units: 'imperial' | 'metric'): Level {
  return units === 'imperial'
    ? { id: 'level:ground', name: 'Ground Floor', elevation: 0, floorToFloorHeight: 10, defaultCeilingHeight: 9 }
    : { id: 'level:ground', name: 'Ground Floor', elevation: 0, floorToFloorHeight: 3.05, defaultCeilingHeight: 2.74 };
}
