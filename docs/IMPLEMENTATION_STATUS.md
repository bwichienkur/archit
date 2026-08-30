# Archit implementation status

This file is the execution ledger for the product roadmap. A phase is marked **Started** only when production-facing code or tests exist in the repository; documentation-only work does not count.

## Foundation dependency chain

DWG ingestion -> normalized immutable CAD -> fidelity validation -> semantic extraction -> geometry/topology -> parametric BIM -> configurator -> takeoff/pricing -> collaboration/export.

| Phase | Area | State | Current implementation |
|---|---|---|---|
| 1 | Production DWG ingestion | Started | Schema-v2 API contract, isolated native worker, SHA-256/schema validation, bounded timeout, durable local artifact/job storage, durable filesystem queue, background processing and restart recovery. Licensed DWG decoding remains an external SDK/runtime dependency. |
| 2 | High-fidelity 2D CAD renderer | Started | Source-aligned renderer supports the major normalized 2D CAD entity families, block instances, layer visibility/isolation and source inspection. |
| 3 | CAD fidelity validation | Started | Deterministic counts/bounds/unsupported/XRef/font checks, structured validation UI and worker-output integrity checks. |
| 4 | Semantic recognition | Started | Unit-aware walls, thickness-aware rooms, deterministic opening recognition, explicit handing/swing preservation, confidence/evidence and review/acceptance workflow. |
| 5 | Geometry kernel | Started | Core geometry, snapping, intersections, topology, room-face offsets, spatial grid indexing and regression tests. |
| 6 | Parametric walls | Started | Wall domain, joins, assemblies, hosted openings, recalculation plus move/rotate/mirror/offset/split/trim/extend geometry operations. |
| 7 | Doors/windows | Started | Recognition, strict hosting, 2D symbols, editable dimensions/offsets/sills, handing/swing, opening families, schedules and true 3D voids. |
| 8 | Room engine | Started | Thickness-aware room faces, room surfaces, manual boundary override, naming/type editing, label-point calculation and dynamic inferred-room recalculation. |
| 9 | Full 3D generation | Started | Standalone BuildingModelV2 scene composes room floors/ceilings, walls with openings, stairs, cabinets, fixtures and persisted sloped roof planes. Root editor integration and richer geometry remain. |
| 10 | Professional editing tools | Started | CAD/BIM selection, snaps, numeric edits, command undo/redo plus wall move/rotate/mirror/offset/split/trim/extend kernels. Interaction bindings remain. |
| 11 | Undo/redo/revisions | Started | V2 commands, durable project revisions, model revision diff engine and functional Save. Revision compare/restore UI remains. |
| 12 | Multi-story | Started | Level validation/sorting, height deltas, add/copy-level operations and stacked-wall relationship detection. Level-management UI remains. |
| 13 | Roof system | Started | Rectangular gable solver, persisted rise directions/ridge elevation, plan/slope takeoffs, schedules and sloped 3D roof rendering. Hip/valley/intersections remain. |
| 14 | Stair system | Started | Deterministic stair solver, constraints, footprint, schedule and 3D step generation. L/U/winder geometric decomposition and railings remain. |
| 15 | Cabinet configurator | Started | Cabinet domain plus deterministic wall-hosted cabinet-run solver and filler calculation. Corner solving, countertops and visual UI remain. |
| 16 | Materials/finishes | Started | Product/material metadata, room-surface selections, PBR material descriptors and render-quality presets. Texture/material UI remains. |
| 17 | Manufacturer catalog | Started | Typed product catalog plus durable local backend repository/search API. |
| 18 | Compatibility rules | Started | Typed room/surface/object compatibility engine prevents invalid assignments. |
| 19 | Builder configurator | Started | Configuration sessions, quantity/waste, price books, compatibility, approval state and isolated BuilderConfiguratorPanel component. Root workspace integration remains. |
| 20 | Furniture/interior planning | Started | Furniture placement domain plus oriented containment/collision validation. Drag/drop UX remains. |
| 21 | Electrical/lighting | Started | Fixture domain, compatibility targets, generic clearance rules and outlet-spacing analysis. Symbol/layout authoring UI remains. |
| 22 | Plumbing | Started | Plumbing fixture domain and generic clearance/host validation foundation. Rough-in/routing remains. |
| 23 | Takeoff engine | Started | Surface/trim/package calculations plus whole-building wall/opening/floor/ceiling/roof/cabinet/fixture aggregation. |
| 24 | Cost/pricing | Started | Catalog pricing, effective price books, labor/material/markup/allowance overrides. Estimate/version UI remains. |
| 25 | Selection management | Started | Draft/customer/builder/locked states plus role-aware approval/rejection transition engine. Audit/approval UI remains. |
| 26 | Construction output | Started | Lineage-aware level SVG, opening CSV, export manifests and durable export-job API contracts/repository. PDF/DXF/DWG/IFC/GLTF generators remain format-specific work. |
| 27 | Annotation/dimensioning | Started | Imported annotations render and an editable annotation authoring domain supports dimensions, leaders, text/tags, markers and revision clouds. Canvas authoring UI remains. |
| 28 | Schedules | Started | Opening, room-finish, stair, roof and fixture schedules plus isolated schedule/export panel. |
| 29 | Collaboration | Started | Durable comments/events, project SignalR groups, live broadcasts and frontend timeline domain. Presence/conflict resolution UI remains. |
| 30 | SaaS/tenancy | Started | Tenant/membership permission model, durable local tenant repository/API contracts, project-scoped roles, production CORS and PostgreSQL schema boundary. External identity provider and DB-backed repositories remain. |
| 31 | Builder price books | Started | Effective-dated material/labor/markup/allowance overrides with deterministic pricing and tests. |
| 32 | Catalog ingestion | Started | CSV template/parser/normalization/validation plus durable catalog persistence. XLSX and manufacturer API/vendor synchronization remain. |
| 33 | AI design assistant | Started | Advisory proposal contracts enforce explicit review and prohibit geometry-review auto-patches. Model/provider integration remains. |
| 34 | Code/compliance checks | Started | Profile-driven deterministic checks with optional citations; no jurisdiction rules are hard-coded. Jurisdiction/version datasets remain. |
| 35 | Site planning | Started | Lot polygons, front/rear/side setback validation and site-area helpers. Contours/drainage/landscape remain. |
| 36 | Rendering quality | Started | R3F pipeline, PBR material descriptors and review/standard/presentation quality presets. HDR/reflections/texture streaming remain. |
| 37 | Walkthrough/presentation | Started | Orbit view plus deterministic first-person pose stepping and room-boundary constraints. UI/gamepad/tours remain. |
| 38 | Mobile/tablet review | Started | Responsive editor shell and role-focused review data contracts exist; dedicated mobile component integration remains. |
| 39 | Performance hardening | Started | Async/recoverable jobs, spatial grid indexing and renderer/domain separation. Web Workers/BVH/instancing/LOD remain. |
| 40 | Reliability/regression | Started | CI plus broad CAD/geometry/BIM/configurator/pricing/schedule/platform regression coverage. Production DWG corpus and visual/performance baselines remain. |

## Current continuation tranche

Implemented on `feature/remaining-platform-phases`:

1. Multi-level validation, level copy/stack operations and stair level relationships.
2. Deterministic stair solving and rectangular gable roof solving.
3. Persisted roof rise metadata and sloped Three.js roof geometry.
4. Standalone BuildingModelV2 3D scene with floors/ceilings, opening-aware walls, roofs, stairs, cabinets and fixtures.
5. Professional wall geometry operations: move, rotate, mirror, offset, split, trim and extend.
6. Richer opening families plus manual room labels/boundaries.
7. Whole-building takeoffs and expanded construction schedules.
8. Cabinet-run solving, interior collision/containment and generic MEP placement rules.
9. Editable annotation model and role-aware selection approvals.
10. Lineage-aware SVG export, export manifests and durable export-job persistence contracts.
11. CSV catalog ingestion and durable catalog repository/search API.
12. Profile-driven compliance checks and site-setback analysis.
13. Durable collaboration events/comments with SignalR project broadcasts.
14. Tenant roles/permissions and durable tenant membership repository contracts.
15. BuildingModelV2 revision diff engine.
16. Advisory-only AI proposal contracts.
17. First-person walkthrough movement/boundary kernel.
18. PBR material descriptors and rendering quality presets.
19. Grid spatial index for large-plan querying.
20. Durable local CAD import queue replacing the process-only channel.
21. PostgreSQL schema and provider-neutral database connection boundary.
22. Production API/web Docker images and SPA nginx configuration.
23. Isolated builder configurator and schedule/export UI components.

## Remaining implementation work that can proceed without external vendor credentials

- Bind the standalone BuildingModelV2 3D scene and isolated panels into the root editor shell.
- Build level/roof/stair/cabinet/material/furniture/MEP editing workspaces.
- Add revision comparison/restore and collaboration/presence UI.
- Add project/tenant administration UI and enforce server authorization once identity claims are available.
- Add background export processors for formats Archit can generate directly (SVG/JSON/CSV/GLTF) and artifact download endpoints.
- Expand roof solver to hip/shed/flat/intersections and stair solver to L/U/winder/railings.
- Add countertops, backsplash, cabinet fillers/end panels and appliance openings.
- Add catalog images/spec/model asset versioning and import-review UI.
- Add worker-based spatial indexing/geometry processing, instancing, LOD and performance benchmarks.
- Add screenshot regression and generated DWG fixture corpus tests where licensing permits.

## External/configuration dependencies

These cannot be truthfully completed by application code alone:

- A licensed ODA/Autodesk-compatible native DWG runtime for actual proprietary DWG decoding/round-trip export.
- A registered PostgreSQL .NET provider and configured database connection before database-backed repository implementations can be enabled.
- Cloud object-storage/service-bus credentials and provider SDK/runtime before cloud adapters can replace local durable storage/queue implementations.
- An identity provider/OIDC configuration before production authentication can enforce tenant permissions.
- Jurisdiction/version-specific building-code datasets before compliance findings can make authoritative code claims.
- AI model/provider credentials before advisory AI proposals can be generated.

## CAD fidelity invariants

- Original DWG remains immutable.
- Every normalized entity retains source handle/lineage.
- Unsupported entities are retained and reported, never silently dropped.
- Source and normalized counts/bounds are validated within explicit tolerances.
- Upload SHA-256 is verified against worker output.
- Semantic inference never alters source CAD geometry.
- Drawing units are explicit before semantic geometry becomes editable BIM.
- Opening dimensions are not invented when source metadata is absent.
- Ambiguous door handing/swing metadata is not coerced.
- AI never silently mutates source or semantic geometry.
- User modifications create building-model revisions rather than modifying imported CAD.
