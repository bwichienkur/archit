import type { BuildingModelV2, Point2 } from './building';

export type RoomSurfaceGeometry = {
  id: string;
  roomId: string;
  levelId: string;
  kind: 'floor' | 'ceiling';
  boundary: Point2[];
  elevation: number;
};

export function buildRoomSurfaces(model: BuildingModelV2): RoomSurfaceGeometry[] {
  const levelById = new Map(model.levels.map(level => [level.id, level]));
  const surfaces: RoomSurfaceGeometry[] = [];

  for (const room of model.rooms) {
    const level = levelById.get(room.levelId);
    if (!level) throw new Error(`Room ${room.id} references missing level ${room.levelId}.`);
    if (room.boundary.length < 3) throw new Error(`Room ${room.id} has fewer than three boundary vertices.`);

    const boundary = room.boundary.map(point => ({ ...point }));
    surfaces.push({
      id: `surface:${room.id}:floor`,
      roomId: room.id,
      levelId: room.levelId,
      kind: 'floor',
      boundary,
      elevation: level.elevation,
    });
    surfaces.push({
      id: `surface:${room.id}:ceiling`,
      roomId: room.id,
      levelId: room.levelId,
      kind: 'ceiling',
      boundary: boundary.map(point => ({ ...point })),
      elevation: level.elevation + room.ceilingHeight,
    });
  }

  return surfaces;
}
