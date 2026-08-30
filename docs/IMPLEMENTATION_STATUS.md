# Archit implementation status

This file is the execution ledger for the product roadmap. A phase is marked **Started** only when production-facing code or tests exist in the repository; documentation-only work does not count.

## Foundation dependency chain

DWG ingestion -> normalized immutable CAD -> fidelity validation -> semantic extraction -> geometry/topology -> parametric BIM -> configurator -> takeoff/pricing -> collaboration/export.

| Phase | Area | State | Current implementation |
|---|---|---|---|
| 1 | Production DWG ingestion | Started | Schema-v2 API contract, isolated native worker, SHA-256/schema validation, bounded timeout, local artifact persistence, queued background processing, restart-recoverable job state, and frontend polling. Licensed ODA/Autodesk worker remains external dependency. |
| 2 | High-fidelity 2D CAD renderer | Started | Source-aligned renderer supports lines, polylines, circles/arcs, ellipses, sampled splines, text/MText, leaders/dimensions, hatches, solids/faces, points and normalized 2D block instances; layer visibility/isolate and source inspection are wired. |
| 3 | CAD fidelity validation | Started | Deterministic entity-count, bounds, unsupported-entity, XRef/font validation with structured issues plus editor validation UI and worker-output integrity checks. |
| 4 | Semantic recognition | Started | Unit-aware wall detection, closed-room topology, thickness-aware interior room faces, deterministic door/window recognition from metadata/block names, candidate evidence/confidence, review states, and explicit acceptance. |
| 5 | Geometry kernel | Started | Core geometry, snapping/intersections, endpoint topology, bounded-face detection, thickness-aware face offsets and regression tests. |
| 6 | Parametric walls | Started | Architectural wall domain, endpoint join graph, join classification, source-aligned V2 editing, hosted openings and dynamic room recalculation. Wall assemblies remain. |
| 7 | Doors/windows | Started | Deterministic recognition, strict wall hosting, 2D door/window symbols, editable offsets/dimensions/sills, overlap/host validation, undo/redo, and true 3D wall void generation are implemented. Handing/swing inference and richer families remain. |
| 8 | Room engine | Started | Closed topology now resolves thickness-aware interior wall faces when unambiguous; V2 room overlay/inspection and inferred-room recalculation after wall edits are wired. Labels/manual boundary editing remain. |
| 9 | Full 3D generation | Started | V2 walls generate in Three.js using source proportions and are decomposed around hosted door/window voids. Floors, ceilings, roofs, stairs and fixtures remain. |
| 10 | Professional editing tools | Started | CAD/BIM selection, layer isolation, wall/opening property edits, snapping foundation and V2 command undo/redo exist; full CAD toolset remains. |
| 11 | Undo/redo/revisions | Started | BuildingModelV2 wall/opening commands support undo/redo; editor Save creates durable local projects/revisions. Diff/branch UI remains. |
| 12 | Multi-story | Started | Level/elevation domain exists; UI and vertical relationships remain. |
| 13 | Roof system | Started | Roof-plane domain exists; solver/rendering/takeoff pending. |
| 14 | Stair system | Started | Parametric stair domain exists; solving/rendering pending. |
| 15 | Cabinet configurator | Started | Cabinet domain and product catalog foundation exist; layout/snapping generator pending. |
| 16 | Materials/finishes | Started | Product/material metadata and room-surface selections exist. |
| 17 | Manufacturer catalog | Started | Catalog/product/variant domain exists. |
| 18 | Compatibility rules | Started | Typed room/surface/object compatibility engine prevents invalid product placement. |
| 19 | Builder configurator | Started | Configuration session, compatible assignment/replacement, waste/quantity tracking and locked selection behavior are implemented with tests. |
| 20 | Furniture/interior planning | Started | Furniture target roles and generic placement domain exist; collision/layout UI pending. |
| 21 | Electrical/lighting | Started | Fixture domain and compatibility targets support electrical/lighting categories. |
| 22 | Plumbing | Started | Plumbing fixture domain and compatible host targets exist; rough-in rules pending. |
| 23 | Takeoff engine | Started | Surface, trim, waste and package-coverage calculations with tests. |
| 24 | Cost/pricing | Started | Catalog pricing plus effective builder overrides and deterministic material/labor/markup calculation. |
| 25 | Selection management | Started | Draft/customer-approved/builder-approved/locked configuration states exist; workflow UI/audit remains. |
| 26 | Construction output | Planned | Export contracts should follow model stabilization. |
| 27 | Annotation/dimensioning | Started | Imported normalized dimensions/leaders/text render; authoring/editing engine remains. |
| 28 | Schedules | Planned | Opening/room topology is now stable enough to begin schedule contracts next. |
| 29 | Collaboration | Planned | Backend boundary selected; SignalR/event model pending. |
| 30 | SaaS/tenancy | Started | Durable local project/revision repository, restart-recoverable CAD job store and production CORS restrictions exist; Postgres, auth and tenant isolation remain. |
| 31 | Builder price books | Started | Effective-dated material/labor/markup/allowance overrides with catalog fallback and tests. |
| 32 | Catalog ingestion | Planned | Depends on catalog persistence/manufacturer schemas. |
| 33 | AI design assistant | Planned | Must remain advisory above deterministic geometry. |
| 34 | Code/compliance checks | Planned | Depends on stable BIM topology and jurisdiction data. |
| 35 | Site planning | Planned | Extend domain after house geometry is mature. |
| 36 | Rendering quality | Started | R3F pipeline exists; production PBR/lighting/LOD pending. |
| 37 | Walkthrough/presentation | Started | Orbit/perspective foundation exists; first-person navigation pending. |
| 38 | Mobile/tablet review | Started | Responsive shell exists; dedicated review UX pending. |
| 39 | Performance hardening | Started | Async/recoverable CAD jobs and architectural separation exist; spatial indexes/BVH/Web Workers remain. |
| 40 | Reliability/regression | Started | CI plus geometry/takeoff/validation/semantic/topology/wall/opening/room/unit/configurator/price-book tests exist; production DWG corpus remains. |

## Current sprint — completed

1. CAD schema v2 on frontend and API contracts.
2. Source validation report and source-entity inspector.
3. CAD layer controls and source-aligned exact reference view.
4. Unit-aware deterministic wall inference and closed-room topology.
5. Semantic review with pending/accepted/rejected states.
6. Explicit promotion into `BuildingModelV2` with immutable CAD lineage.
7. Explicit geometry units; unitless drawings are blocked from BIM promotion until calibrated.
8. Source-aligned editable 2D BIM overlay and V2 wall/room/opening inspection.
9. V2 command undo/redo for wall and hosted-opening edits.
10. Deterministic door/window recognition from explicit metadata and classified block names without inventing dimensions.
11. Strict host-wall matching and accepted-opening validation.
12. 2D door/window symbols and actual 3D wall voids via wall-solid decomposition.
13. Thickness-aware interior room faces with centerline fallback only when offset joins are ambiguous.
14. Architectural unit parsing/formatting/conversion.
15. Builder compatibility, configuration sessions and effective price books.
16. Durable local project/model revisions and functional editor Save.
17. Expanded normalized CAD rendering for major 2D entity families and block instances.
18. Native-worker SHA/schema/integrity checks and timeout protection.
19. CAD imports moved out of the HTTP lifecycle into queue + background worker + durable artifact/job storage with restart recovery.
20. CI runs for every `feature/**` branch.

## Next execution order

1. Add richer door/window family metadata, handing/swing editing and opening schedules.
2. Add floor/ceiling generation from resolved room faces.
3. Add wall assemblies and join cleanup for finish/core layers.
4. Add PostgreSQL repository and cloud object-storage adapters behind the existing persistence interfaces.
5. Replace the in-memory queue with a production durable broker while retaining restart recovery semantics.
6. Add catalog persistence and CSV/XLSX ingestion pipeline.
7. Build builder configurator UI on top of compatibility/session/price-book core.
8. Add schedules and vector export contracts for walls/openings/rooms.
9. Add first-person walkthrough and production PBR materials.
10. Connect the licensed native DWG worker when SDK credentials/runtime are available.

## Definition of done for CAD fidelity

- Original DWG remains immutable.
- Every normalized entity retains source handle/lineage.
- Unsupported entities are retained and reported, never silently dropped.
- Source and normalized counts/bounds are validated within explicit tolerances.
- Upload SHA-256 is verified against worker output.
- Semantic inference never alters source CAD geometry.
- Drawing units are explicit before semantic geometry becomes editable BIM.
- Opening dimensions are not invented when source metadata is absent.
- User modifications create building-model revisions rather than modifying the imported reference.

> Persistence note: the current durable implementation is local filesystem JSON/artifact storage, intentionally behind interfaces so PostgreSQL and cloud object storage can replace it without changing the editor/API contracts.
