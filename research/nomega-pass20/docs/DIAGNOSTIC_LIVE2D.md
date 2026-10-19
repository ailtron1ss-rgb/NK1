# DIAGNOSTIC 83 — Live2D / Kurisu archive reality

neuro_kurisu size/path: /home/workdir/artifacts/neuro_kurisu exists=True
- MISSING: legacy-original/public/live2d/Kurisu/Kurisu.model3.json
- MISSING: legacy-original/src/main-bootstrap.ts
- MISSING: legacy-original/package.json
Total files under neuro_kurisu: 647

## Conclusion
Live2D **model and app source are NOT in the available archive**.
`verify-live2d.mjs` expects `public/live2d/Kurisu/Kurisu.model3.json` — absent.
index.html references `/src/main-bootstrap.ts` — absent.
What exists: docs, hype reports, verify script without assets.

## Interaction that WORKS now
Nullseed: `runtime/hub.html` + `nullseed_console.html` + CLI.
To get Live2D you must supply the actual model package (not present here).