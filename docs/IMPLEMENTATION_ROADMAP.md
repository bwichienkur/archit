# Implementation Roadmap

## Implemented in foundation PR

- React/TypeScript/Vite editor
- CAD-style workspace layout
- shared building domain model for 2D/3D
- React Three Fiber 3D wall rendering
- wall selection and property inspection
- editable wall thickness/height
- command-based undo/redo
- immutable source-CAD lineage concept
- normalized CAD schema
- normalized CAD SVG renderer for line/polyline/circle/arc
- ASP.NET Core CAD import API
- native worker isolation adapter
- safe failure when no licensed provider is installed
- geometry kernel and tests
- builder catalog/selection types
- takeoff calculations and tests
- CI build/test workflow

## Next: real DWG milestone

1. Acquire/configure ODA Drawings SDK or Autodesk-compatible SDK.
2. Implement the native worker executable against the normalized JSON protocol.
3. Add fixture DWGs with known expected entity/layer/bounds values.
4. Persist original DWG and normalized document in object storage.
5. Replace in-memory jobs with durable queue + persistence.
6. Render imported normalized CAD in the main viewport and expose layer/entity inspection.
7. Add import validation report UI.

## Semantic BIM milestone

- wall candidate detection from layers/parallel linework and native architecture objects
- door/window recognition from blocks and smart objects
- room-boundary graph detection
- confidence + manual review workflow
- source entity lineage for every semantic object
- levels and elevations
- hosted openings and wall joins

## Editing milestone

- architectural unit parser/formatter
- endpoint/midpoint/intersection/perpendicular snapping
- numeric move/rotate/length edits
- wall join regeneration
- door/window hosting
- trim/extend/split/offset
- command coalescing for drag interactions
- dirty-region geometry regeneration

## Builder configurator milestone

- room/surface selection
- product catalog persistence
- material compatibility rules
- flooring/tile/baseboard/crown takeoffs
- cabinetry domain and snapping
- pricing/markup/waste formulas
- standard/upgrade/premium packages
- customer-safe configuration mode

## Production platform milestone

- PostgreSQL persistence and organization tenancy
- object storage for DWG/spec/model assets
- queue-backed CAD workers
- authentication and roles
- project/version/revision history
- audit trail
- PDF/SVG construction output
- DXF/DWG/IFC export strategy
- performance profiling for large drawings
