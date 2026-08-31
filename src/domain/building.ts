export type Point2 = { x: number; y: number };
export type ValidationState = 'imported' | 'inferred' | 'confirmed' | 'modified';
export type GeometryLengthUnit = 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters' | 'unitless';

export type SourceLineage = {
  sourceCadEntityIds: string[];
  inferenceMethod?: string;
  confidence?: number;
  validationState: ValidationState;
};

export type Level = {
  id: string;
  name: string;
  elevation: number;
  floorToFloorHeight: number;
  defaultCeilingHeight: number;
};

export type WallOpening = {
  id: string;
  kind: 'door' | 'window' | 'cased-opening';
  hostWallId: string;
  offsetFromWallStart: number;
  width: number;
  height: number;
  sillHeight?: number;
  subtype?: string;
  handing?: 'left' | 'right';
  swing?: 'in' | 'out';
  lineage: SourceLineage;
};

export type ArchitecturalWall = {
  id: string;
  levelId: string;
  name: string;
  start: Point2;
  end: Point2;
  thickness: number;
  height: number;
  baseElevation: number;
  wallType: 'exterior' | 'interior' | 'foundation' | 'pony' | 'unknown';
  assemblyId?: string;
  openingIds: string[];
  lineage: SourceLineage;
};

export type RoomSurfaceSelection = {
  productVariantId?: string;
  materialId?: string;
  wastePercent?: number;
};

export type ArchitecturalRoom = {
  id: string;
  levelId: string;
  name: string;
  roomType: string;
  boundary: Point2[];
  ceilingHeight: number;
  floor?: RoomSurfaceSelection;
  walls?: RoomSurfaceSelection;
  ceiling?: RoomSurfaceSelection;
  baseboard?: RoomSurfaceSelection;
  crown?: RoomSurfaceSelection;
  lineage: SourceLineage;
};

export type Stair = {
  id: string;
  fromLevelId: string;
  toLevelId: string;
  kind: 'straight' | 'l' | 'u' | 'winder';
  origin: Point2;
  rotation: number;
  width: number;
  riserHeight: number;
  treadDepth: number;
  riserCount: number;
};

export type RoofPlane = {
  id: string;
  levelId: string;
  boundary: Point2[];
  pitch: number;
  baseElevation: number;
  overhang: number;
  materialId?: string;
  /** Unit vector in plan space pointing from the eave toward increasing roof elevation. */
  riseDirection?: Point2;
  /** Highest elevation represented by this plane when known. */
  ridgeElevation?: number;
};

export type Cabinet = {
  id: string;
  levelId: string;
  roomId?: string;
  kind: 'base' | 'wall' | 'tall' | 'vanity' | 'pantry' | 'island' | 'corner' | 'drawer' | 'sink-base' | 'appliance';
  origin: Point2;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  hostWallId?: string;
  productVariantId?: string;
};

export type Fixture = {
  id: string;
  levelId: string;
  roomId?: string;
  category: 'plumbing' | 'electrical' | 'lighting' | 'appliance' | 'furniture';
  origin: Point2;
  rotation: number;
  width?: number;
  depth?: number;
  height?: number;
  productVariantId?: string;
};

export type BuildingModelV2 = {
  schemaVersion: 2;
  projectId: string;
  projectName: string;
  units: 'imperial' | 'metric';
  /** All geometric distances in this model use this unit. It is never inferred from display preferences. */
  geometryUnits: GeometryLengthUnit;
  levels: Level[];
  walls: ArchitecturalWall[];
  openings: WallOpening[];
  rooms: ArchitecturalRoom[];
  stairs: Stair[];
  roofPlanes: RoofPlane[];
  cabinets: Cabinet[];
  fixtures: Fixture[];
};
