import type { ArchitecturalRoom, ArchitecturalWall, BuildingModelV2, GeometryLengthUnit, Level, SourceLineage, WallOpening } from '../domain/building';
import { validateHostedOpening } from '../domain/wallGraph';
import { convertLength } from '../units/architectural';
import type { OpeningCandidate, RoomCandidate, SemanticCandidate, WallCandidate } from './types';

export type SemanticAcceptanceOptions = {
  projectId: string;
  projectName: string;
  units: 'imperial' | 'metric';
  geometryUnits: GeometryLengthUnit;
  level?: Level;
  defaultWallHeight?: number;
  defaultRoomType?: string;
};

export function createBuildingModelFromCandidates(
  candidates: SemanticCandidate[],
  acceptedCandidateIds: Set<string>,
  options: SemanticAcceptanceOptions,
): BuildingModelV2 {
  const level = options.level ?? defaultLevel(options.geometryUnits);
  const accepted = candidates.filter(candidate => acceptedCandidateIds.has(candidate.id));

  let walls = accepted.filter((candidate): candidate is WallCandidate => candidate.kind === 'wall')
    .map(candidate => toArchitecturalWall(candidate, level.id, options.defaultWallHeight ?? level.defaultCeilingHeight));
  const rooms = accepted.filter((candidate): candidate is RoomCandidate => candidate.kind === 'room')
    .map((candidate, index) => toArchitecturalRoom(candidate, level.id, level.defaultCeilingHeight, options.defaultRoomType ?? 'unclassified', index));
  const openingCandidates = accepted.filter((candidate): candidate is OpeningCandidate => candidate.kind === 'door' || candidate.kind === 'window');
  const openings = openingCandidates.map(candidate => toHostedOpening(candidate, walls));

  const openingIdsByWall = new Map<string, string[]>();
  for (const opening of openings) {
    const ids = openingIdsByWall.get(opening.hostWallId) ?? [];
    ids.push(opening.id);
    openingIdsByWall.set(opening.hostWallId, ids);
  }
  walls = walls.map(wall => ({ ...wall, openingIds: openingIdsByWall.get(wall.id) ?? [] }));

  return {
    schemaVersion: 2,
    projectId: options.projectId,
    projectName: options.projectName,
    units: options.units,
    geometryUnits: options.geometryUnits,
    levels: [level],
    walls,
    openings,
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

function toHostedOpening(candidate: OpeningCandidate, walls: ArchitecturalWall[]): WallOpening {
  if (!candidate.hostWallCandidateId || candidate.offsetFromWallStart == null) {
    throw new Error(`Accepted ${candidate.kind} ${candidate.id} has no deterministic host wall. Review or reject it before creating the building model.`);
  }
  const hostWallId = `wall:${candidate.hostWallCandidateId}`;
  const wall = walls.find(item => item.id === hostWallId);
  if (!wall) throw new Error(`Accepted ${candidate.kind} ${candidate.id} references a wall candidate that was not accepted.`);

  const opening: WallOpening = {
    id: `opening:${candidate.id}`,
    kind: candidate.kind,
    hostWallId,
    offsetFromWallStart: candidate.offsetFromWallStart,
    width: candidate.width,
    height: candidate.height,
    sillHeight: candidate.kind === 'window' ? candidate.sillHeight ?? 0 : undefined,
    subtype: candidate.subtype,
    handing: candidate.kind === 'door' ? candidate.handing : undefined,
    swing: candidate.kind === 'door' ? candidate.swing : undefined,
    lineage: lineage(candidate),
  };
  const issues = validateHostedOpening(opening, wall);
  if (issues.length) throw new Error(`Accepted ${candidate.kind} ${candidate.id} is invalid for ${hostWallId}: ${issues.join(' ')}`);
  return opening;
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

function defaultLevel(geometryUnits: GeometryLengthUnit): Level {
  if (geometryUnits === 'unitless') {
    throw new Error('A level with explicit dimensions is required before accepting semantic geometry from a unitless drawing.');
  }
  return {
    id: 'level:ground',
    name: 'Ground Floor',
    elevation: 0,
    floorToFloorHeight: convertLength(10, 'feet', geometryUnits),
    defaultCeilingHeight: convertLength(9, 'feet', geometryUnits),
  };
}
