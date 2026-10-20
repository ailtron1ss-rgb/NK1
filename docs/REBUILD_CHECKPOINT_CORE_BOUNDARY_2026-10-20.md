# NK1 rebuild checkpoint — core boundary slice

**Date:** 2026-10-20  
**Branch:** rebuild  
**Implementation commit:** ac6f55502a4aaef417517d91e85e2bec6046391e  
**Status:** IMPLEMENTED; exact-head CI pending at checkpoint creation.

## Completed in this slice

- Added runtime validation at the public OrganismCore.observe entrypoint, before full-cycle/spine-only routing.
- Malformed observation values (null, arrays, primitives) fail with a stable TypeError code before the cognitive cycle can mutate state.
- Only the documented runtime modes `full` and `operational` are accepted; invalid mode values fail closed.
- Validation is non-mutating and has no external side effects.
- Added tests for both accepted modes, valid observation shape, malformed observations, invalid/missing mode and input immutability.
- Added `test:cognitive-cycle-boundary` and wired it into `.github/workflows/workpass79-cognitive-regression.yml`; push on `rebuild` now runs this gate.

## Evidence and validation boundary

Run from `runtime/neuro-kurisu`:

```bash
npm run test:cognitive-cycle-boundary
```

Expected line:

```text
NK1_COGNITIVE_CYCLE_BOUNDARY=PASS assertions=9 modes=2 rejectsMalformedObservation=true rejectsInvalidMode=true mutation=false
```

The GitHub Actions run on the exact commit must be inspected before this slice is labelled CI-validated. No local command was executed by the GitHub source-editing connector. This guard validates API shape; it does not prove reasoning quality, autonomy, consciousness, or the full runtime path.

## Open core-island gates

1. Inspect exact-head CI and fix any failure without weakening assertions.
2. Add the cognitive-cycle boundary contract to the architecture/contract index and exercise it through the actual server request path.
3. Trace the production cycle and action path for any side-effect bypass; test the finding before changing it.
4. Run typecheck and the broader cognitive integration suite.
5. Keep all unknown live-model/device/retrieval/learning gates open until measured.

## Rollback

Revert implementation commit `ac6f55502a4aaef417517d91e85e2bec6046391e`; no persistent schema migration or state rewrite was introduced.
