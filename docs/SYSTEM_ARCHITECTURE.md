# Archit System Architecture

## Principle

The DWG is immutable source truth. Archit maintains three distinct layers:

1. **CAD Source Model** — lossless normalized representation of imported CAD entities.
2. **Building Domain Model** — semantic, parametric objects such as walls, rooms, doors, windows and finishes.
3. **Render Models** — disposable 2D/3D representations derived from the domain model.

The Three.js scene is never the application database.

## CAD ingestion

Production DWG support must use a real DWG-capable provider. The application will expose a `CadImportProvider` abstraction so an Autodesk Platform Services/RealDWG or ODA implementation can be selected without coupling the rest of the product to a vendor SDK.

Pipeline:

`DWG -> CAD worker/provider -> normalized CAD model -> validation -> semantic inference -> user confirmation -> building model`

No AI/raster tracing is permitted as the authoritative import path.

## Fidelity

Every semantic object retains `sourceCadEntityIds`. Inferred objects are visibly different from confirmed objects. Unsupported source geometry remains CAD reference geometry instead of being silently discarded. Future validation compares source and semantic geometry and reports tolerances/deviations.

## Frontend

React + TypeScript. Zustand will own UI/editor state. A geometry package will own computational geometry. React Three Fiber renders the 3D projection. The 2D renderer is independent but reads the same domain model.

## Backend target

ASP.NET Core API, PostgreSQL/PostGIS, object storage for DWG/assets, queue-backed CAD workers, and SignalR for processing status/collaboration. CAD SDK licensing and deployment constraints must be resolved before the production importer is implemented.

## Editing

Edits target domain objects and execute through commands. Commands will support execute/undo and identify affected geometry so a single wall edit does not rebuild an entire house.

## Current milestone

The initial UI intentionally uses fixture geometry. It proves shared 2D/3D model projection, selection, CAD lineage display, inferred-vs-confirmed semantics, and the intended professional editor layout. It does **not** claim DWG parsing is implemented yet.
