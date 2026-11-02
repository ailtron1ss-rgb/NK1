# NK1 — WorkPass: affect-state restore integrity

**Date:** 2026-11-02  
**Branch:** `aspect/affect-state-restore-integrity-20261102`  
**Base:** `workpass70-source` at `608435493b4af3b4a222d385f1b77d978d18583b`

## Why this pass matters

EmotionAppraisalEngine already feeds appraisal episodes, interoceptive regulation pressure, action bias, memory salience and feeling-access records into the organism. Its previous restore path spread the persisted object and nested objects directly into live state. It accepted arbitrary array entries, non-finite counters, malformed outcome rows and accessor-backed objects. A corrupt snapshot could therefore reintroduce invalid affect state after restart, despite the normal runtime path clamping its inputs.

## Implemented

- Replaced direct object spreading in `EmotionAppraisalEngine.restore` with an allowlisted reconstruction of the version-2 state.
- Read only own data properties; getters are never invoked. Invalid prototypes and revoked proxies fall back to defaults.
- Bounded counters, timestamps and normalized 0..1 signals; restored only known emotion labels and action tendencies.
- Rebuilt interoceptive vectors field-by-field, rather than merging untrusted nested objects.
- Validated emotion/feeling history entries and bounded history to 128 records.
- Bounded outcome map size and key syntax, validated each calibration row, and prevented prototype-key injection.
- Extended WorkPass172 regression coverage for throwing getters, malformed numeric fields, invalid history, hostile outcome keys and revoked proxies.
- Added a dedicated CI workflow to run the affect/interoception/persistence regression and runtime typecheck when these files change.

## Verification boundary

The test and typecheck commands are now wired into a dedicated GitHub Actions workflow. They have **not** been executed from this editing session. CI must pass on the exact PR head before this work is considered tested or merge-ready. No Release ZIP was changed or claimed.

## Remaining work in this aspect

1. Run the new workflow and fix any regressions it exposes.
2. Apply the same restore-contract audit to persistent personality dynamics and self-model snapshots, with explicit compatibility tests.
3. Verify the full runtime path: appraisal → action bias → selected action → avatar semantic state → renderer readback.
4. Add a multi-session personality continuity holdout: same inputs should preserve invariants, while verified experience changes only adaptive traits within bounded drift.
5. Verify the 2D / 2.5D / VRM handoff on real browser/device runtimes; unit contracts alone do not prove rendering or lip-sync timing.

## Status

- Implementation: **committed to aspect branch**
- Automated test coverage: **added, not yet executed here**
- CI: **pending**
- Merge: **not merged**
- Release artifact: **unchanged**
