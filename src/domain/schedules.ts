import type { BuildingModelV2 } from './building';

export type OpeningScheduleRow = {
  mark: string;
  openingId: string;
  kind: 'door' | 'window' | 'cased-opening';
  hostWallId: string;
  hostWallName: string;
  levelId: string;
  levelName: string;
  width: number;
  height: number;
  sillHeight: number | null;
  subtype: string | null;
  handing: 'left' | 'right' | null;
  swing: 'in' | 'out' | null;
  validationState: string;
  sourceCadEntityIds: string[];
};

export function buildOpeningSchedule(model: BuildingModelV2): OpeningScheduleRow[] {
  const wallById = new Map(model.walls.map(wall => [wall.id, wall]));
  const levelById = new Map(model.levels.map(level => [level.id, level]));
  const counters: Record<'door' | 'window' | 'cased-opening', number> = { door: 0, window: 0, 'cased-opening': 0 };
  const prefixes: Record<'door' | 'window' | 'cased-opening', string> = { door: 'D', window: 'W', 'cased-opening': 'O' };

  return model.openings
    .slice()
    .sort((a, b) => compareOpenings(a, b, wallById))
    .map(opening => {
      const wall = wallById.get(opening.hostWallId);
      if (!wall) throw new Error(`Opening ${opening.id} references missing host wall ${opening.hostWallId}.`);
      const level = levelById.get(wall.levelId);
      if (!level) throw new Error(`Host wall ${wall.id} references missing level ${wall.levelId}.`);
      counters[opening.kind] += 1;
      return {
        mark: `${prefixes[opening.kind]}${String(counters[opening.kind]).padStart(2, '0')}`,
        openingId: opening.id,
        kind: opening.kind,
        hostWallId: wall.id,
        hostWallName: wall.name,
        levelId: level.id,
        levelName: level.name,
        width: opening.width,
        height: opening.height,
        sillHeight: opening.kind === 'window' ? opening.sillHeight ?? 0 : null,
        subtype: opening.subtype ?? null,
        handing: opening.handing ?? null,
        swing: opening.swing ?? null,
        validationState: opening.lineage.validationState,
        sourceCadEntityIds: [...opening.lineage.sourceCadEntityIds],
      };
    });
}

export function openingScheduleToCsv(rows: OpeningScheduleRow[], geometryUnits: BuildingModelV2['geometryUnits']): string {
  const headers = [
    'Mark','Type','Level','Host Wall','Width','Height','Sill Height','Units','Subtype','Handing','Swing','Validation State','Opening ID','Source CAD Entity IDs',
  ];
  const lines = rows.map(row => [
    row.mark,
    row.kind,
    row.levelName,
    row.hostWallName,
    number(row.width),
    number(row.height),
    row.sillHeight == null ? '' : number(row.sillHeight),
    geometryUnits,
    row.subtype ?? '',
    row.handing ?? '',
    row.swing ?? '',
    row.validationState,
    row.openingId,
    row.sourceCadEntityIds.join(';'),
  ].map(csvCell).join(','));
  return [headers.map(csvCell).join(','), ...lines].join('\r\n');
}

export function buildOpeningScheduleCsv(model: BuildingModelV2): string {
  return openingScheduleToCsv(buildOpeningSchedule(model), model.geometryUnits);
}

function compareOpenings(
  a: BuildingModelV2['openings'][number],
  b: BuildingModelV2['openings'][number],
  wallById: Map<string, BuildingModelV2['walls'][number]>,
) {
  const wallA = wallById.get(a.hostWallId);
  const wallB = wallById.get(b.hostWallId);
  const level = (wallA?.levelId ?? '').localeCompare(wallB?.levelId ?? '');
  if (level !== 0) return level;
  const wall = (wallA?.name ?? a.hostWallId).localeCompare(wallB?.name ?? b.hostWallId);
  if (wall !== 0) return wall;
  const offset = a.offsetFromWallStart - b.offsetFromWallStart;
  if (offset !== 0) return offset;
  return a.id.localeCompare(b.id);
}

function number(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
