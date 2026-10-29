# WorkPass617 — continuous body intent wiring

**Date:** 2026-10-29  
**Working branch:** `work/nk1-body-intent-unification-2026-10-29`  
**Base source head:** `d1fa4bb37e2c948683aa0d4ce4bfb6da98f6fcc4` (`workpass70-source`)

## Scope

First code pass toward a common control contract for Live2D now and rigged 2.5D/3D bodies later.

- Add a deterministic, bounded action/affect-to-pose mapper.
- Add optional normalized head yaw/pitch, torso angles and breathing intensity to EmbodimentIntent v1.
- Wire AvatarStage and both app/standalone viewers to the same pose channels.
- Keep legacy payloads valid and reject malformed/out-of-range optional channels.
- Add regression tests, schema changes and changelog evidence.

## Limitations

This pass does **not** add a production 2.5D/3D asset, skeleton, IK, modular mesh wardrobe or a full autonomous motor planner. The pose mapper is a bounded continuous adapter, not a learned motion generator. Visual/browser/device validation and exact-head CI remain required before merge or Release ZIP refresh.

## Acceptance commands

- `cd app && npm run test:embodiment-timeline`
- `cd runtime/neuro-kurisu && node tests/live2d-integrity.mjs`
- `cd app && npm run typecheck`
- Browser E2E and Android/Termux validation remain separate release gates.
