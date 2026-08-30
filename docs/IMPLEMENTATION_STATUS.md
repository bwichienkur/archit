# Archit implementation status

This file is the execution ledger for the product roadmap. A phase is marked **Started** only when production-facing code or tests exist in the repository; documentation-only work does not count.

## Foundation dependency chain

DWG ingestion -> normalized immutable CAD -> fidelity validation -> semantic extraction -> geometry/topology -> parametric BIM -> configurator -> takeoff/pricing -> collaboration/export.

| Phase | Area | State | Current implementation |
|---|---|---|---|
| 1 | Production DWG ingestion | Started | `ICadImportProvider`, API upload flow, isolated native worker contract. Licensed ODA/Autodesk worker remains external dependency. |
| 2 | High-fidelity 2D CAD renderer | Started | `CadReferenceLayer`, normalized line/polyline/arc/circle rendering; richer style/layer schema added. |
| 3 | CAD fidelity validation | Started | Deterministic entity-count, bounds, unsupported-entity, XRef/font validation with structured issues. |
| 4 | Semantic recognition | Started | Semantic candidate/evidence model and deterministic parallel-line wall detector. |
| 5 | Geometry kernel | Started | Core geometry kernel plus snapping/intersection engine and tests. |
| 6 | Parametric walls | Started | Shared wall domain and command editing exist; joins/assemblies remain. |
| 7 | Doors/windows | Started | Hosted opening domain exists; recognition, renderer and editing remain. |
| 8 | Room engine | Started | Room domain and surface selections exist; boundary detection remains. |
| 9 | Full 3D generation | Started | Walls generated from shared model in Three.js; remaining architectural generators pending. |
| 10 | Professional editing tools | Started | Selection, property editing and command architecture exist; full CAD toolset pending. |
| 11 | Undo/redo/revisions | Started | Command-based undo/redo exists; durable revision service remains. |
| 12 | Multi-story | Started | Level/elevation domain added; UI and vertical relationships remain. |
| 13 | Roof system | Started | Roof-plane domain added; solver/rendering/takeoff pending. |
| 14 | Stair system | Started | Parametric stair domain added; solving/rendering pending. |
| 15 | Cabinet configurator | Started | Cabinet domain and builder catalog foundation exist; snapping/layout generator pending. |
| 16 | Materials/finishes | Started | Product/material metadata and room surface selections exist. |
| 17 | Manufacturer catalog | Started | Catalog/product/variant domain exists. |
| 18 | Compatibility rules | Planned | Typed target compatibility engine next after richer product domain. |
| 19 | Builder configurator | Planned | Depends on stable rooms/surfaces/catalog targeting. |
| 20 | Furniture/interior planning | Started | Generic fixture/furniture placement domain exists; collision/layout UI pending. |
| 21 | Electrical/lighting | Started | Fixture domain supports electrical and lighting categories. |
| 22 | Plumbing | Started | Fixture domain supports plumbing category; rough-in rules pending. |
| 23 | Takeoff engine | Started | Surface, trim, waste and package-coverage calculations with tests. |
| 24 | Cost/pricing | Started | Catalog pricing fields and takeoff quantities form base; price-book engine pending. |
| 25 | Selection management | Started | Product selections are represented on configurable surfaces; approval workflow pending. |
| 26 | Construction output | Planned | Export contracts should follow model stabilization. |
| 27 | Annotation/dimensioning | Planned | CAD annotation preservation exists; authoring engine pending. |
| 28 | Schedules | Planned | Depends on stable openings/rooms/fixtures. |
| 29 | Collaboration | Planned | Backend boundary selected; SignalR/event model pending. |
| 30 | SaaS/tenancy | Planned | Persistence/auth intentionally deferred until project model stabilizes. |
| 31 | Builder price books | Planned | Depends on pricing and tenancy. |
| 32 | Catalog ingestion | Planned | Depends on catalog persistence and manufacturer schemas. |
| 33 | AI design assistant | Planned | Must remain advisory above deterministic geometry. |
| 34 | Code/compliance checks | Planned | Depends on stable BIM topology and jurisdiction data. |
| 35 | Site planning | Planned | Extend domain after house geometry is mature. |
| 36 | Rendering quality | Started | R3F pipeline exists; production PBR/lighting/LOD pending. |
| 37 | Walkthrough/presentation | Started | Orbit/perspective foundation exists; first-person navigation pending. |
| 38 | Mobile/tablet review | Started | Responsive shell exists; dedicated review UX pending. |
| 39 | Performance hardening | Started | Architectural separation supports incremental render work; spatial index/BVH/workers pending. |
| 40 | Reliability/regression | Started | Vitest geometry/takeoff/validation/semantic tests and CI exist; DWG corpus pending. |

## Current sprint

1. Finish normalized CAD schema v2 adoption through API/renderer.
2. Add production validation report UI.
3. Add layer isolate/freeze/lock behavior.
4. Add room-boundary/topology detection.
5. Add parametric wall join graph and hosted openings.
6. Add semantic candidate review/accept/reject workflow.
7. Add persistence boundary for projects/import revisions.
8. Connect the licensed native DWG worker when SDK credentials/runtime are available.

## Definition of done for CAD fidelity

- Original DWG remains immutable.
- Every normalized entity retains its source handle/lineage.
- Unsupported entities are retained and reported, never silently dropped.
- Source and normalized entity counts and bounds are validated within explicit tolerances.
- Semantic inference never alters source CAD geometry.
- User modifications create a building-model revision rather than modifying the imported reference.
