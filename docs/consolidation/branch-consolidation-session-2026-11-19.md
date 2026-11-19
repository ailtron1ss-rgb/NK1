# NK1 — branch consolidation session (2026-11-19)

## Canonical baseline and boundaries

- Repository: `ailtron1ss-rgb/NK1`.
- Canonical working source: `workpass70-source`; `main` remains a separate release/report line.
- The stable `Neuro` release contains metadata for `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, size 135,290,615 bytes, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Release ZIP bytes were not materialized in this execution. No extraction manifest, per-file hash audit, or source-to-release parity claim is made. The later `HOTFIX1` asset is a different artifact and is not substituted for the stable baseline.

## New selective integration — HMX imported-text redaction

PR [#973](https://github.com/ailtron1ss-rgb/NK1/pull/973) was merged into `workpass70-source`.

- Exact tested PR head: `141dba806c1617ebf63e31755ac87d581cc89c84`.
- Squash merge commit: `11611332fbf8a429f2c66867e4bb7652f2cd5f8e`.
- Changed files: 3; additions 100; deletions 3.
- New `HmxImportRedactor.ts` screens HMX free text for known key/token/credential URL/email/phone patterns. The current canonical bridge applies it to imported memory content, episode summaries and cluster names and emits an explicit warning when a known pattern is redacted.
- Real-runtime test uses `OrganismSystemFabric` and canonical MemoryOS2 storage. It checks that known sensitive fixture strings do not reach canonical memory, replacement markers are present, surrounding ordinary text survives, and a warning is reported.
- TDD red phase: run #44502961425 failed at the expected assertion because the original importer stored the fixture email/token unchanged.
- Green phase: run #44503771773 SUCCESS on exact head `141dba806c1617ebf63e31755ac87d581cc89c84`.
- All 9 PR-triggered Actions runs on that exact head succeeded, including HMX bridge, memory integrity, source lineage, unified runtime, WorkPass79 and NeuroCore core regression.
- Runtime typecheck reported `TYPECHECK=PASS mode=node-strip-syntax-only`; the dedicated run notes that semantic `tsc` checking was unavailable in that workflow because TypeScript was not installed there. The broader NeuroCore regression workflow did complete its own app/runtime checks.
- Redaction is heuristic risk reduction, **not** a universal PII/secret detector. It does not replace consent, review or deferred protected sections.
- No dependency, package manifest, workflow, release ZIP or `main` change was included.

### Why PR #866 was not merged wholesale

PR #866 remains an open Draft donor with 21 files (+1,650/-116). At comparison time its branch was 370 commits behind the current source and had 79 unique commits ahead from an old merge base. Its redactor was integrated into the older `HexisCanonicalMemoryProjector`, while the active source uses `HexisHmxCanonicalMemoryBridge`. The useful redaction behavior was transplanted into the current owner; the old projector and unrelated app/runtime/memory changes were not reintroduced.

## Related work verified from prior and parallel sessions

These were already integrated before this selective port and were not re-applied:

- [#954](https://github.com/ailtron1ss-rgb/NK1) — HMX / MemoryOS2 canonical bridge and lifecycle integration; merge commit `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f`.
- #967 — interoceptive estimator input-boundary port; merge commit `7384022f9d0e0fb0126fd448f1b436072070e29c`; its focused Actions run #44499706405 succeeded.
- The live report `docs/BRANCH_CONSOLIDATION_AFFECT_RESTORE_2026-11-19_RU.md` records the completed affect restore family reconciliation (#961/#965/#971) and explicitly retains the wider #619 donor for a separate 14-file audit. No duplicate affect restore implementation was added here.
- Existing review `docs/consolidation/live-branch-review-2026-11-19-after-pr970.md` remains the broader provenance/disposition record for old HeXis, Hermes, HMX, N.E.K.O. and other donor PRs.

## Fresh branch / PR census

A complete paginated read during this execution returned:

- **972 branch refs**.
- **956 unique HEAD commits**.
- **16 excess names** beyond one name per unique HEAD.
- One exact shared-HEAD group of **17 branch names**, all at commit `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`.
- **367 open PRs** in the current paginated read.

The 17 shared-HEAD names are:
`nk1-all-branches-merge-2026-10-23`,
`nk1-integration-workspace-2026-10-22`,
`rebuild`,
`workpass79-cognitive-rebuild`,
`workpass116-seed-clustered-learning-eval`,
`workpass117-verified-replay-admission`,
`workpass118-multi-source-learning-integration`,
`workpass119-skill-retrieval-feedback-curriculum`,
`workpass120-verified-skill-revision-gate`,
`workpass121-ledger-bound-promotion-proposals`,
`workpass122-promotion-gate-coverage-hardening`,
`workpass123-authenticated-skill-lifecycle`,
`workpass124-learning-evidence-hardening`,
`workpass135-durable-shadow-run-registry`,
`workpass203-independent-candidate-evaluator`,
`workpass206-runtime-evaluator-wiring`,
`workpass313-actions-history-audit`.

Current open-PR head/base reference scan found four live dependencies:
- #109 uses `nk1-all-branches-merge-2026-10-23` as base.
- #91 and #86 use `rebuild` as base.
- #124 uses `workpass206-runtime-evaluator-wiring` as base.

The other 13 names in the shared-HEAD group were not found as heads or bases of currently open PRs in this snapshot. That alone is **not** proof they can be retired: closed/merged PR history, tags/releases, workflow branch filters, rulesets, deployments, docs and external consumers still need a separate check.

The branch metadata marks both `main` and `workpass70-source` as not protected. This is metadata, not a complete audit of repository rulesets or deployment protections.

## Honest disposition

- Completed: selective, tested HMX text-redaction integration in the current canonical importer; exact-head PR checks passed; PR #973 merged and verified as the current source head at merge time.
- Completed earlier and cross-checked to avoid duplication: #954 HMX/MemoryOS2 integration and #967 interoception port.
- Not completed: reducing refs to a few dozen, full file/line/byte review of all 972 branches, complete historical/deployment reference audit of duplicate aliases, or ZIP content parity against the October 19 release.
- No branch ref was deleted or force-moved. The connected GitHub operations available in this session expose file/commit/ref creation and ref updates, but no branch-ref deletion action. Do not claim branch cleanup from PR merges; merging a PR does not delete its head branch.
- Preserve all donor branches until their full tree/blob/path and reference review is documented. Equal HEAD is a strong duplicate signal, not blanket permission to delete an alias.

## Snapshot caveat

The branch census and open-PR counts are time-stamped snapshots. The source branch continued to advance through parallel work during this session. At the time the report was committed, re-read the live branch head rather than treating an earlier observed SHA as current.


## Selective consolidation — B299 personality evidence + restore integrity (PR #980)

PR [#980](https://github.com/ailtron1ss-rgb/NK1/pull/980) was merged into `workpass70-source`.

- Donor PR #666: trait-specific evidence gate; its code change made matured action phenotypes contribute to trait influence without requiring that trait's own evidence.
- Donor PR #668: B299 restore integrity; its changes blocked accessor-backed state and hardened numeric, action, history and trait-vector restoration.
- Both donors modified `B299CausalPersonalityDevelopmentLoop.ts` and were based on the same obsolete source head `608435493b4af3b4a222d385f1b77d978d18583b`. They were therefore consolidated together rather than merged independently.
- New current-source branch: `aspect/b299-personality-consolidation-20261119`.
- Tested/rebased candidate head: `0b2fdc326dbc5a927903f7286a7b1811bbbc80c0`.
- TDD red run #44510431851: the new real-component test observed `verify` bias `0.0248475586` with zero trait evidence; expected zero.
- Full unified runtime push run #44511701708: SUCCESS on the exact candidate head.
- PR exact-head Actions: **48/48 SUCCESS**, 0 failed, 0 cancelled, 0 pending. This includes NeuroCore core regression validation, app build/typecheck, runtime checks, memory, Hexis, Emotion Restore, cognition and organism smoke.
- Merge commit: `a7d9919671c4479a7e30c306f52450a63b61af08`; its parent is the then-current source head `3a4492b40f1dde3648acd7f907ceceea0598584d`.
- Four files changed: B299 runtime, one consolidated integration test, runtime package script, unified runtime workflow. No dependency-lock, release ZIP, `main`, or unrelated personality module change.
- Current-source compare immediately after merge: identical to merge commit (no ahead/behind commits).

The old donor PRs #666 and #668 were closed as superseded/completed, each with a comment linking the replacement PR #980. Their source branches were deliberately retained as historical provenance; no branch refs were deleted.

The test/restore logic explicitly rejects root/nested Proxy inputs using Node's `util.types.isProxy` before descriptor traversal, rejects getter/setter descriptors, rebuilds the canonical seven-action B299 state field by field, validates numeric values without string coercion, bounds history to 192 valid entries, and gates each trait's action influence by its own `traitEvidence01 / 0.32`. Valid version-1 B299 snapshots retain round-trip behavior.

## Snapshot after PR #980

- `workpass70-source` was re-read after merge; do not infer the current branch count from the prior census.
- PR #980 is merged; #666 and #668 are closed as superseded. Donor branch refs remain present pending a separate exhaustive ref-retirement audit.
- This B299 merge adds no evidence that the complete 972-branch repository has been line-by-line reviewed or that October 19 release ZIP contents match source bytes.
