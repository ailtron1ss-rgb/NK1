# BIG PASS 166 — Release Notes

## Main achievement
The existing world-model family is now coordinated by an adaptive ensemble controller. It learns which existing model is reliable from outcomes, exposes disagreement and uncertainty, and is on the actual public planner path.

## New verification
- `tests/big-pass-166-world-ensemble.mjs`
- controller-level reliability test
- core integration test
- longitudinal A/B effect test
- restart persistence test

## Persistence
`worldModelEnsemble` is migrated, projected and restored through the canonical state pipeline.

## Completion tracking
`PROJECT_COMPLETION_MATRIX_35.6.1_BIG_PASS_166_RU.md` is the authoritative checklist for the first analysis plan.
