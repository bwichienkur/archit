import type { CadBounds, CadDocument, CadImportValidation, CadValidationIssue } from './types';

export type CadValidationOptions = {
  boundsTolerance: number;
  requireEntityCountMatch: boolean;
};

const DEFAULT_OPTIONS: CadValidationOptions = {
  boundsTolerance: 1e-6,
  requireEntityCountMatch: true,
};

function maxBoundsDelta(a?: CadBounds, b?: CadBounds): number | undefined {
  if (!a || !b) return undefined;
  return Math.max(
    Math.abs(a.min.x - b.min.x), Math.abs(a.min.y - b.min.y), Math.abs((a.min.z ?? 0) - (b.min.z ?? 0)),
    Math.abs(a.max.x - b.max.x), Math.abs(a.max.y - b.max.y), Math.abs((a.max.z ?? 0) - (b.max.z ?? 0)),
  );
}

export function validateNormalizedCad(
  document: CadDocument,
  source: { entityCount: number; bounds?: CadBounds; missingReferences?: string[]; missingFonts?: string[] },
  options: Partial<CadValidationOptions> = {},
): CadImportValidation {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const issues: CadValidationIssue[] = [];
  const unsupported = document.entities.filter(x => x.unsupported);
  const entityCountMismatch = source.entityCount !== document.entities.length;
  const boundsDelta = maxBoundsDelta(source.bounds, document.bounds);

  if (config.requireEntityCountMatch && entityCountMismatch) {
    issues.push({
      code: 'ENTITY_COUNT_MISMATCH', severity: 'error',
      message: `Source contains ${source.entityCount} entities but normalized output contains ${document.entities.length}.`,
    });
  }

  if (boundsDelta !== undefined && boundsDelta > config.boundsTolerance) {
    issues.push({
      code: 'BOUNDS_DELTA_EXCEEDED', severity: 'error', delta: boundsDelta,
      message: `Normalized drawing bounds differ from source by ${boundsDelta}.`,
    });
  }

  for (const entity of unsupported) {
    issues.push({
      code: 'UNSUPPORTED_ENTITY', severity: 'warning', entityId: entity.id,
      sourceHandle: entity.sourceHandle, layerId: entity.layerId,
      message: entity.unsupportedReason ?? `Unsupported ${entity.type} retained as source metadata.`,
    });
  }

  for (const name of source.missingReferences ?? []) {
    issues.push({ code: 'MISSING_XREF', severity: 'warning', message: `Missing external reference: ${name}` });
  }
  for (const name of source.missingFonts ?? []) {
    issues.push({ code: 'MISSING_FONT', severity: 'warning', message: `Missing font: ${name}` });
  }

  const passed = !issues.some(x => x.severity === 'error');
  return {
    sourceFileName: document.sourceFileName,
    sourceEntityCount: source.entityCount,
    normalizedEntityCount: document.entities.length,
    unsupportedEntityCount: unsupported.length,
    sourceBounds: source.bounds,
    normalizedBounds: document.bounds,
    boundsDelta,
    missingReferences: source.missingReferences ?? [],
    missingFonts: source.missingFonts ?? [],
    issues,
    warnings: document.warnings,
    passed,
  };
}
