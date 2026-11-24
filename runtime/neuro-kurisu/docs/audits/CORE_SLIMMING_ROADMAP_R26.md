# Core slimming roadmap — R26

## Current state

`src/organism/core/OrganismCore.ts` is still a large orchestration surface (~10.2k lines). Ownership is now cleaner: the Core no longer directly owns the R23 bounded recurrent substrate, and direct constructor count is five.

## What changed in this pass

- R23 bounded recurrent ownership moved to `DevelopmentalNeuralRuntime`.
- Canonical neural access moved behind `NeuralSubstrateBackend`.
- mLSTM is an explicit research shadow, not a second canonical source of truth.
- The old absolute 3,482-line physical audit threshold was replaced by a regression guard because it was a stale historical threshold and no longer reflected the current release.

## Next extraction targets

1. Extract the ~3,750-line `observe` orchestration body into a dedicated observation runtime with an explicit context contract.
2. Extract the ~400-line `init` / persistence restoration flow into an initialization runtime.
3. Move remaining large operational tool/project execution sections behind dedicated runtime owners.
4. Keep constructor ownership at <=5, then reduce it further as the extracted runtimes become canonical.

The historical 3,482-line target remains a long-term architectural target; it is not claimed as complete in R26.
