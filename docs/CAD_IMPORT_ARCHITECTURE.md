# CAD Import Architecture

## Goal

Preserve DWG source geometry and metadata without guessing. The original drawing is immutable; semantic BIM objects are derived and independently editable.

## Provider boundary

`ICadImportProvider` is the only API layer allowed to understand a vendor-specific DWG SDK. The web API selects a configured native worker through `ARCHIT_CAD_IMPORTER_PATH`.

The native process model is deliberate:

- isolates native SDK crashes from ASP.NET Core
- isolates vendor licensing/deployment requirements
- permits ODA or Autodesk implementations
- allows worker upgrades without changing frontend/domain contracts
- provides a stable JSON boundary for automated fixtures and validation

## Worker protocol

The configured executable is invoked with:

`--input <source.dwg> --output <normalized.json> --validation <validation.json>`

It must return exit code `0` only when normalization completed successfully.

### Normalized entity geometry

The first schema version uses these canonical geometry payloads:

- `line`: `{ start: {x,y,z?}, end: {x,y,z?} }`
- `polyline`: `{ vertices: [{x,y,z?}], closed: boolean }`
- `circle`: `{ center: {x,y,z?}, radius }`
- `arc`: `{ center: {x,y,z?}, radius, startAngle, endAngle }` where angles are radians

Additional entity types remain present in the normalized document even when the browser renderer does not yet have a specialized visualization. Unsupported entities must be marked; they must not be silently discarded.

## Required source preservation

For every entity preserve at minimum:

- source handle/object id
- source layer
- coordinates and geometry
- block transforms
- entity type
- relevant properties and extended metadata where available
- bounds

A later binary sidecar may preserve vendor-specific data that should not be flattened into JSON.

## Validation

The worker must emit a separate validation report. Production validation should compare:

- source entity count vs normalized count
- drawing units
- drawing extents/bounds
- layer count and names
- unsupported/custom entities
- missing xrefs
- missing fonts
- block references
- per-entity geometry bounds

A normalized import can succeed while semantic interpretation remains unresolved. Those are different states.

## Semantic conversion

Normalized CAD is then analyzed by separate semantic services. They may infer walls, doors, windows, rooms and fixtures, but every inferred object carries source entity ids and a confidence/review state.

Semantic conversion never mutates normalized CAD.

## Production provider recommendation

ODA Drawings SDK is a strong fit for native DWG data access, and ODA Architecture SDK can expose smart architectural objects when a DWG contains AutoCAD Architecture entities. Autodesk-compatible alternatives can implement the same provider contract. Provider selection is a licensing/deployment decision, not a domain-model decision.
