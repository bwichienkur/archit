# Archit implementation status

This file is the execution ledger for the product roadmap. A phase is marked **Started** only when production-facing code or tests exist in the repository; documentation-only work does not count.

## Foundation dependency chain

DWG ingestion -> normalized immutable CAD -> fidelity validation -> semantic extraction -> geometry/topology -> parametric BIM -> configurator -> takeoff/pricing -> collaboration/export.

| Phase | Area | State | Current implementation |
|---|---|---|---|
| 1 | Production DWG ingestion | Started | `ICadImportProvider`, API upload flow, isolated native worker contract. Licensed ODA/Autodesk worker remains external dependency. |
| 2 | High-fidelity 2D CAD renderer | Started | `CadReferenceLayer`, normalized line/polyline/arc/circle rendering, imported CAD editor view, source entity selection/inspection, and CAD layer visibility/isolate controls. |
| 3 | CAD fidelity validation | Started | Deterministic entity-count, bounds, unsupported-entity, XRef/font validation with structured issues plus an editor validation-report modal. |
| 4 | Semantic recognition | Started | Semantic candidate/evidence model, deterministic parallel-line wall detector, and room candidates inferred from closed wall topology. |
| 5 | Geometry kernel | Started | Core geometry kernel, snapping/intersection engine, endpoint topology, bounded-face detection, and tests. |
| 6 | Parametric walls | Started | Shared wall domain and command editing exist; joins/assemblies remain. |
| 7 | Doors/windows | Started | Hosted opening domain exists; recognition, renderer and editing remain. |
| 8 | Room engine | Started | Room domain, surface selections, and closed-face boundary inference exist; wall-face offsets, labeling, editing and dynamic recalculation remain. |
| 9 | Full 3D generation | Started | Walls generated from shared model in Three.js; remaining architectural generators pending. |
| 10 | Professional editing tools | Started | Source/semantic selection, layer isolation, property editing and command architecture exist; full CAD toolset pending. |
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
| 40 | Reliability/regression | Started | Vitest geometry/takeoff/validation/semantic/topology tests and CI exist; DWG corpus pending. |

## Current sprint

Completed in this tranche:

1. Normalized CAD schema v2 foundations.
2. Production validation report UI.
3. Imported CAD source view with entity inspection.
4. CAD layer visibility and isolate controls.
5. Endpoint topology and closed-room boundary inference.

Next execution order:

1. Add parametric wall join graph and hosted openings.
2. Add semantic candidate review/accept/reject workflow.
3. Convert accepted semantic candidates into the building model with explicit source-coordinate lineage.
4. Add project/import revision persistence boundary.
5. Add architectural units parser/formatter and numeric coordinate editing.
6. Add dynamic room recalculation after wall edits.
7. Expand exact CAD rendering for ellipse, text/MText, dimensions, hatches and blocks.
8. Connect the licensed native DWG worker when SDK credentials/runtime are available.

## Definition of done for CAD fidelity

- Original DWG remains immutable.
- Every normalized entity retains its source handle/lineage.
- Unsupported entities are retained and reported, never silently dropped.
- Source and normalized entity counts and bounds are validated within explicit tolerances.
- Semantic inference never alters source CAD geometry.
- User modifications create a building-model revision rather than modifying the imported reference.
