# Archit

Professional CAD-to-BIM home design and builder configuration platform.

## Foundation implemented

- professional CAD-style editor workspace
- shared semantic building model driving both 2D and 3D
- interactive selection and editable wall properties
- command-based undo/redo
- normalized source-CAD schema with immutable lineage
- normalized CAD renderer for line/polyline/circle/arc entities
- ASP.NET Core `.dwg` import API
- isolated native CAD worker adapter via `ARCHIT_CAD_IMPORTER_PATH`
- explicit safe failure when a licensed DWG SDK/worker is not configured
- geometry kernel with automated tests
- builder product/selection domain
- deterministic surface, trim and purchasing takeoffs
- CI for frontend tests/build and API build

The demo building geometry remains a fixture until a licensed DWG worker is connected. Production parsing is intentionally not faked or raster-traced.

## Run web app

```bash
npm install
npm run dev
```

## Run API

```bash
npm run api
```

The web app defaults to `http://localhost:5080` for the API. Override with `VITE_API_URL`.

## Configure native DWG import

Build/install a licensed ODA or Autodesk-compatible native worker that follows `docs/CAD_IMPORT_ARCHITECTURE.md`, then set:

```bash
ARCHIT_CAD_IMPORTER_PATH=/absolute/path/to/archit-cad-worker
```

The worker is intentionally out-of-process so native SDK licensing, crashes, versioning, and platform dependencies remain isolated from the web API.

## Architecture

- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/CAD_IMPORT_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
