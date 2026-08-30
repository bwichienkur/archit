export type CadPoint = { x: number; y: number; z?: number };
export type CadBounds = { min: CadPoint; max: CadPoint };
export type CadMatrix = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export type CadEntityType =
  | 'line' | 'polyline' | 'arc' | 'circle' | 'ellipse' | 'spline' | 'text' | 'mtext'
  | 'dimension' | 'leader' | 'hatch' | 'block-reference' | 'solid' | '3d-face' | 'point' | 'unknown';

export type CadUnits = 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters' | 'unitless';

export type CadLayer = {
  id: string;
  name: string;
  visible: boolean;
  frozen?: boolean;
  locked: boolean;
  color?: string;
  lineType?: string;
  lineWeight?: number;
  transparency?: number;
};

export type CadStyle = {
  color?: string;
  lineType?: string;
  lineWeight?: number;
  transparency?: number;
};

export type CadEntity = {
  id: string;
  sourceHandle: string;
  ownerHandle?: string;
  type: CadEntityType;
  layerId: string;
  bounds: CadBounds;
  transform?: CadMatrix;
  style?: CadStyle;
  geometry: Record<string, unknown>;
  properties: Record<string, string | number | boolean | null>;
  sourceBlockName?: string;
  unsupported?: boolean;
  unsupportedReason?: string;
};

export type CadBlockDefinition = {
  id: string;
  name: string;
  sourceHandle: string;
  basePoint: CadPoint;
  entityIds: string[];
  isExternalReference?: boolean;
  externalPath?: string;
};

export type CadDocument = {
  schemaVersion: 2;
  sourceFileName: string;
  sourceSha256: string;
  sourceCadVersion?: string;
  drawingUnits: CadUnits;
  unitScaleToMeters?: number;
  bounds: CadBounds;
  layers: CadLayer[];
  blocks: CadBlockDefinition[];
  entities: CadEntity[];
  warnings: string[];
};

export type CadValidationSeverity = 'info' | 'warning' | 'error';
export type CadValidationIssue = {
  code: string;
  severity: CadValidationSeverity;
  message: string;
  entityId?: string;
  sourceHandle?: string;
  layerId?: string;
  delta?: number;
};

export type CadImportValidation = {
  sourceFileName: string;
  sourceEntityCount: number;
  normalizedEntityCount: number;
  unsupportedEntityCount: number;
  sourceBounds?: CadBounds;
  normalizedBounds?: CadBounds;
  boundsDelta?: number;
  missingReferences: string[];
  missingFonts: string[];
  issues: CadValidationIssue[];
  warnings: string[];
  passed: boolean;
};
