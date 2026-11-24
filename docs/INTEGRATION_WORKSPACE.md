# NK1 integration workspace — 2026-10-22

Status: integration workspace created from `workpass70-source`. This is not yet a merged release.

## Source branches to reconcile
- `workpass70-source` — current working source baseline, including recent cognitive-cycle/persistence changes.
- `workpass71-learning-eval-paired-seeds` — learning evaluation with paired seeds.
- `workpass71-learning-integrity` — learning data/integrity work.
- `workpass73-audit-fixes` — audit fixes.
- `workpass79-cognitive-rebuild` — cognitive rebuild and skill-retention evaluation.
- `workpass79-learning-input-integrity` — learning input integrity.
- `workpass86-prioritized-replay` — prioritized replay.
- `workpass87-cleanrl-eval-protocol` — CleanRL evaluation protocol.
- `workpass88-avalanche-forgetting-metrics` — catastrophic-forgetting metrics.

## Integration rules
1. Preserve all source branches; do not force-push or overwrite them.
2. Do not blindly merge histories: GitHub compare reported no common ancestor against `main` for the inspected branches.
3. Port compatible file-level changes into this workspace, preserving existing behavior and resolving overlaps deliberately.
4. For every imported change, record source branch, target paths, rationale, and any adaptation.
5. Run targeted tests and the relevant CI workflows; do not label the integration validated until checks pass.
6. Keep the GitHub Release ZIP separate from source integration; a branch commit does not update a release asset.

## Current limitation
This workspace commit records the integration scope and safety rules only. It does not claim that the listed branches have been merged or that CI passes. The next implementation step is to inspect source trees and port concrete code/test changes by subsystem.
