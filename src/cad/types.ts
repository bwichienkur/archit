export type CadPoint = { x: number; y: number; z?: number };
export type CadBounds = { min: CadPoint; max: CadPoint };

export type CadEntityType =
  | 'line' | 'polyline' | 'arc' | 'circle' | 'spline' | 'text' | 'mtext'
  | 'dimension' | 'leader' | 'hatch' | 'block-reference' | 'point' | 'unknown';

export type CadLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string;
  lineType?: string;
};

export type CadEntity = {
  id: string;
  sourceHandle: string;
  type: CadEntityType;
  layerId: string;
  bounds: CadBounds;
  geometry: Record<string, unknown>;
  properties: Record<string, string | number | boolean | null>;
  unsupported?: boolean;
};

export type CadDocument = {
  schemaVersion: 1;
  sourceFileName: string;
  sourceSha256: string;
  drawingUnits: 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters' | 'unitless';
  bounds: CadBounds;
  layers: CadLayer[];
  entities: CadEntity[];
  warnings: string[];
};

export type CadImportValidation = {
  sourceFileName: string;
  sourceEntityCount: number;
  normalizedEntityCount: number;
  unsupportedEntityCount: number;
  missingReferences: string[];
  missingFonts: string[];
  warnings: string[];
  passed: boolean;
};
