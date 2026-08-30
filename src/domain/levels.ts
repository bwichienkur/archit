import type { BuildingModelV2, Level } from './building';

export type LevelIssue = { code: string; message: string; levelId?: string; objectId?: string };

export function sortLevels(levels: Level[]) {
  return [...levels].sort((a,b) => a.elevation - b.elevation || a.id.localeCompare(b.id));
}

export function validateLevels(model: BuildingModelV2): LevelIssue[] {
  const issues: LevelIssue[] = [];
  const ids = new Set<string>();
  for (const level of model.levels) {
    if (ids.has(level.id)) issues.push({ code:'duplicate-level', levelId:level.id, message:`Duplicate level id ${level.id}.` });
    ids.add(level.id);
    if (!(level.floorToFloorHeight > 0)) issues.push({ code:'invalid-floor-height', levelId:level.id, message:`Level ${level.name} must have a positive floor-to-floor height.` });
    if (!(level.defaultCeilingHeight > 0) || level.defaultCeilingHeight > level.floorToFloorHeight) issues.push({ code:'invalid-ceiling-height', levelId:level.id, message:`Level ${level.name} has an invalid default ceiling height.` });
  }
  const sorted = sortLevels(model.levels);
  for (let i=1;i<sorted.length;i+=1) {
    if (sorted[i].elevation <= sorted[i-1].elevation) issues.push({ code:'overlapping-level-elevation', levelId:sorted[i].id, message:`Level ${sorted[i].name} does not sit above ${sorted[i-1].name}.` });
  }
  const levelIds = new Set(model.levels.map(level => level.id));
  for (const wall of model.walls) if (!levelIds.has(wall.levelId)) issues.push({ code:'orphan-wall', objectId:wall.id, message:`Wall ${wall.id} references missing level ${wall.levelId}.` });
  for (const room of model.rooms) if (!levelIds.has(room.levelId)) issues.push({ code:'orphan-room', objectId:room.id, message:`Room ${room.id} references missing level ${room.levelId}.` });
  for (const stair of model.stairs) {
    if (!levelIds.has(stair.fromLevelId) || !levelIds.has(stair.toLevelId)) issues.push({ code:'orphan-stair', objectId:stair.id, message:`Stair ${stair.id} references a missing level.` });
    if (stair.fromLevelId === stair.toLevelId) issues.push({ code:'same-level-stair', objectId:stair.id, message:`Stair ${stair.id} must connect different levels.` });
  }
  return issues;
}

export function levelHeightDelta(model: Pick<BuildingModelV2,'levels'>, fromLevelId: string, toLevelId: string) {
  const from = model.levels.find(level => level.id === fromLevelId);
  const to = model.levels.find(level => level.id === toLevelId);
  if (!from || !to) throw new Error('Both stair levels must exist.');
  return to.elevation - from.elevation;
}
