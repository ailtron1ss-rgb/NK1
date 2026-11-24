# WorkPass72 handover — retrieval residency correctness and working structure

**Date:** 2026-10-19  
**Branch:** `workpass70-source`  
**Status:** WorkPass72 verifier-provenance hardening and expanded regression CI passed at `87564ddfd1f0d8758994c3ab0edb45511434a1b5` ([GitHub Actions run](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39302836266)). This validates the current targeted/regression workflow only; it is not production approval.

## Behavioral defect found

In `MemoryOS2.retrieve()`, the candidate loop rebuilt each missing 48-dimensional hashed lexical vector and changed the item's residency to `warm`. Later cleanup only cleared non-retained items whose tier was still `cold`. As a result, the cleanup could not undo the warming caused by retrieval. The vector similarity was explicitly excluded from final ranking and was only used to increment the legacy `semanticHits` counter. This spent CPU/RAM and changed residency for a signal that did not affect ranking.

## Implementation in this pass

- Removed query-time vector materialization and hashed-cosine calculation from retrieval.
- Kept `semanticHits` in the persisted state shape for compatibility, but stopped incrementing it from a non-semantic hash projection. Explicit `get()`, encoding/consolidation and residency planning retain ownership of vector materialization.
- Tightened `p2697-mobile-residency.mjs`: after retrieval, materialized-vector count must remain unchanged and hot/warm/cold counts must remain unchanged.
- Expanded the active GitHub Actions regression suite to run candidate coverage, numeric and fuzzy retrieval, bilingual concept recall, query-intent ranking, the two residency regressions, background semantic-index maintenance and embedding privacy.
- Added root `AGENTS.md` with a canonical file map, working procedure, evidence terminology and conservative cleanup policy.

## Delayed policy-learning evidence gate

The policy outcome ledger previously recorded an `independentVerified` flag but still emitted the full candidate reward and the MemoryFabric adapter always forwarded that reward into adaptive policy updates. WorkPass72 now sets unverified outcome reward to zero, tracks verified resolutions and unverified attempts separately, limits reward/causal-credit aggregates to independently verified outcomes, and updates AdaptiveMemoryPolicy only for verified outcomes. An unverified observation no longer consumes its pending decision, so later independent proof can resolve that same decision. The same gate now protects `CausalReplayCreditAssigner`: unverified attempts are kept in its bounded recent records, return zero causal credit, and do not mutate credit/outcome/eligibility/delay aggregates. Older snapshots without verification counters cannot prove the provenance of historic policy reward means, so restore resets those means to zero and exposes `legacyAggregatesDiscarded` rather than carrying uncertain reward forward as trusted evidence. A focused regression checks that unverified resolution leaves the policy diagnostics unchanged and verified resolution changes the reward state. This is an integration guard, not proof that the upstream verifier always represents real-world truth; caller provenance still must be audited.

## Verification provenance hardening — committed, awaiting CI

A further audit found that `ExperienceContinuumFabric.recordReplayValidation()` trusted a caller-provided `independentVerified: true` boolean. The policy ledger's internal reward gate was working, but this upstream flag was not proof. The committed patch makes the flag non-authoritative: only the exact normalized result object emitted by `OutcomeVerificationService`, with a matching `external-postcondition` observation, can authorize verified replay learning. A copied/serialized object and a tool-contract ACK do not pass. Duplicate unverified evidence can be promoted by later trusted proof while retaining the original validation ID; the causal-credit ledger upgrades the existing record idempotently instead of double-counting it. `tests/workpass72-verification-provenance-boundary.mjs` exercises boolean spoofing, token identity, delayed promotion, and idempotency; the active CI workflow now runs it. Do not call this pass validated until that run finishes.

## Why this is not a retrieval-quality claim

This is a resource/residency correctness fix. No recall uplift is claimed. The multi-seed benchmark still uses its existing synthetic fixture; independent, provenance-backed, temporally separated holdout data is still required before claiming real quality gains.

## First CI feedback and test-fixture correction

The first expanded CI failed at `memory-retrieval-numeric-terms.mjs`: records were seeded with 2033 timestamps but the test called `temporalMode: 'current'`. Current mode deliberately uses wall-clock time and ignores `asOfAt`; use explicit `temporalMode: 'at'` for deterministic point-in-time fixtures. This is a test-fixture correction, not a change to the production temporal contract. The fixture now uses explicit point-in-time mode and the expanded CI must be re-run before claiming validation success.

## Repository organization audit

The exact-blob audit for baseline `585c3d1c66ad452c9684b7969bcbaba9006f60f7` found 9,354 tracked files, 2,891 Markdown files and 39 duplicate-content groups (60 excess paths). All 21 pairs in `contracts/inventory/canonical-public-assets-workpass42.json` were verified by Git blob SHA and recorded size. Removed only those 21 manifest-listed `app/public/live2d/` shadows: 16,690,663 bytes (15.92 MiB) of duplicate tracked payload. These ignored targets hydrate from the sole runtime owner before Vite dev/build/preview, and asset ownership is now a CI gate. Post-cleanup tree: 9,333 tracked files, 18 exact duplicate groups, 39 excess paths. No legacy snapshots, research code, licenses, archives, provenance, viewer, vendor or sprite files were removed. Full inventory: `docs/REPOSITORY_CLEANUP_AUDIT_WORKPASS72.md` and companion JSON.

## Validation

This pass expands `.github/workflows/workpass71-validation.yml` to run:
- runtime TypeScript check and organism smoke;
- speech/continuum/persistence regressions;
- retrieval experiment, candidate coverage, numeric and fuzzy retrieval;
- bilingual concept recall and typed query intent;
- memory residency and background embedding-index behavior;
- embedding request privacy sanitization.

The expanded CI first found a numeric-retrieval fixture seeded with 2033 timestamps but run under `temporalMode: 'current'`. That mode intentionally ignores `asOfAt`; switching this deterministic fixture to explicit `temporalMode: 'at'` made the numeric checks pass. The following run exposed the same mismatch in the fuzzy-retrieval fixture; it too now uses point-in-time mode. `p2684-memory-residency.mjs` now asserts that retrieval leaves cold items cold and explicit `get()` owns vector materialization and the hot transition. These are fixture/assertion correctness changes, not changes to production temporal semantics. Run and inspect CI before counting WorkPass72 as validation-complete.

## Candidate-budget defect found from CI

The first expanded runtime CI got through the retrieval parity/numeric/fuzzy/concept/intent checks and P2684, then P2697 failed its 192-candidate bound. The source showed a real off-by-one pattern: revision and graph expansions checked the size **after** adding a candidate, so a 192-item pool could temporarily become 193 before breaking. WorkPass72 now checks the cap before every expansion insertion and throws a budget error if the invariant is ever violated. P2697 now prints all diagnostics in the failure message and asserts the reported budget is 192, making any future violation attributable rather than opaque. The corrected commit still requires CI validation.

## Remaining high-priority gates

1. Confirm CI for this commit and repair every regression exposed by the expanded suite.
2. Audit any remaining exact duplicates against references/imports/scripts/licenses/provenance before deciding whether to move anything; never delete historical copies by default.
3. Establish and label a real independent retrieval corpus and evaluate recall@k/MRR, paired uncertainty and temporal leakage.
4. Measure p50/p95 retrieval latency, heap/RSS, allocation and thermal/battery impact on the actual target device; don't infer device behavior from desktop CI.
5. Keep real browser/Live2D E2E, Android TTS clock, production build/release contract, license audit and soak tests open until directly observed.


## Final validation follow-up — 2026-10-19

- Expanded WorkPass71 validation run `39302836266` completed **success** on `87564ddfd1f0d8758994c3ab0edb45511434a1b5`. Canonical asset ownership audit, grapheme timeline tests, app script regression suite, app typecheck, development bundle build, runtime typecheck and the full configured speech/memory/retrieval/policy regression tail passed.
- The verification-provenance test now asserts the exact replay-event identity captured from runtime state. Its adaptive replay-governor assertion correctly expects no policy update when no matching prior governor decision exists; verified causal replay-credit promotion remains required and is asserted separately. Duplicate proof delivery must remain idempotent.
- This is **IMPLEMENTED + CI-OBSERVED** correctness evidence for the configured tests. It does not establish that an upstream verifier is inherently truthful, that replay improves real-world recall, or that the organism is production-ready.
- Open gates remain: independent labelled retrieval holdout (`recallDelta` is still 0 / `not-promoted`), real browser/Live2D audio E2E, physical Android/Termux TTS and cancellation evidence, real external action/provider verification, production build/migration/rollback, full license/SBOM review, target-device performance and 24–72 hour soak.
