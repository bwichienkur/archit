# Archit

Professional CAD-to-BIM home design and builder configuration platform.

## Current foundation

- Professional CAD-style editor shell
- Shared building domain model
- Interactive 2D wall selection
- Parametric 3D wall projection from the same model
- 2D / 3D / split modes
- Source CAD lineage concept
- Inferred vs confirmed building semantics
- Layer controls and validation UI foundation

> The current geometry is a fixture used to establish the editing architecture. Production DWG parsing is intentionally not faked; it will be integrated through a licensed DWG-capable provider.

## Run

```bash
npm install
npm run dev
```

## Architecture

See `docs/SYSTEM_ARCHITECTURE.md`.
