# WorkPass96 — Live2D canonical asset integrity gate
Date: 2026-10-24

## Goal

Verify the complete deployed Live2D asset chain before relying on viewer rendering. The canonical model owner remains `runtime/neuro-kurisu/public/live2d`; `app/public/live2d` is still a generated, hash-locked deployment shadow.

## Implemented

- Added `app/scripts/test-live2d-assets.mjs`.
- The test calls the same fail-closed `hydrateCanonicalPublicAssets` helper used by the app's Vite wrapper, then validates every canonical manifest item against the expected byte length and SHA-256 in both canonical and hydrated locations.
- Validates the quality and mobile Cubism v3 model JSON files, referenced Moc/physics/CDI/texture/motion/expression assets, texture minimum sizes, expression coverage and matching expression/motion-group sets across model variants.
- Verifies that each viewer expression name maps to an expression actually present in the model, that the three Pixi/Cubism runtime bundles are local repository files, and that the hidden/visible ticker lifecycle and expression-cache protections remain present.
- Adds the asset gate to `app/package.json` normal test entry points and the focused Node.js 24 Live2D workflow. Workflow path filters now include canonical runtime assets and the shared public-asset manifest.

## Why this matters

A viewer can be syntactically valid yet fail to render if one expression, motion, texture, model binary or vendor bundle is missing or differs from the canonical source. This gate detects those failures earlier and prevents accidental drift between the runtime's canonical model and the UI build's hydrated copy.

## Validation boundary

The new integrity test and CI run are pending observation on the exact current HEAD. A successful hash/JSON gate verifies packaging consistency and declared resource reachability; it does **not** replace actual browser WebGL/Cubism rendering, visual expression inspection, acoustic lip-sync measurements or physical Android/Termux audio tests.
