# Release 35.6.11 / B358

## Major update
Implemented learned compositional program revision in B276. Repeated execution consequences can now reorder the persistent multi-step program at sequence boundaries. The revision survives restart and is causally removable by matched program ablation.

## Verified
- B358 program revision/restart/ablation: PASS, 5/5 seeds.
- B357 consequence learning/unseen transfer: PASS.
- B355 compositional execution remains the foundation for the revised path.

## Open / honest limits
- B356 full trajectory regression did not finish within the available runtime window after B358; status TIMEOUT/OPEN, not PASS.
- Full clean TypeScript semantic compile did not finish within the current runtime window; the local project does not contain `node_modules/.bin/tsc`. Existing Node strip-type execution remains functional for the targeted tests.
- Physical Android/Termux gate remains OPEN.
