# NK1 P0 Persistence Integration — Execution Checkpoint

**Date:** 2026-11-26  
**Base:** `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`  
**Branch:** `aspect/p0-persistence-integration-20261126`

## Ownership contract

1. Core is the single canonical durable-save authority.
2. Runtime prepares one bounded generation envelope before the Core save.
3. RecoveryWatchdog advances `lastCheckpointAt` only inside the successful Core store commit callback.
4. RuntimeCheckpointCommitObserver projects sidecar owners only after that Core commit resolves.
5. ContinuityLedger remains append-only and uses a durable `.rollback` marker.
6. On Core save failure, the watchdog marker and speculative envelope generation must roll back; no sidecar projection may run.

## Joint regression

The integration test asserts:
- failed Core save does not advance `lastCheckpointAt`;
- the in-memory envelope generation returns to the previous committed generation;
- no OpenLoop sidecar projection occurs on failure;
- the next successful save advances exactly one generation;
- sidecar projection occurs only after Core save succeeds.

The first integration commit intentionally does not restore the speculative envelope, to demonstrate RED before the production fix.

## Acceptance gates

- [ ] Joint regression red for the intended generation rollback defect.
- [ ] Minimal rollback fix and focused green test.
- [ ] Exact-head CI and semantic runtime typecheck.
- [ ] Independent review.
- [ ] Android/Termux cold-restart and storage-loss soak.
- [ ] Later canonical integration in a separate reviewed step.

No modifications to `main`, Release assets, `gearonone.zip`, or `workpass70-source`.


## Live verification — 2026-11-26

### Branch and provenance

- Canonical base remains `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`.
- Integration branch head with production fix: `fe87a69a4ba4051c540eabb8595ba569c53f015c`.
- Draft PR: [#1198](https://github.com/ailtron1ss-rgb/NK1/pull/1198), 25 changed files; 3 commits ahead of canonical, 0 behind.
- Original PRs #1170 and #1174 remain open/draft and unchanged; this branch does not alter canonical source, `main`, release assets or the immutable source ZIP.

### Red/green proof for the joint ownership contract

- Initial integration CI [Cognitive Core Consolidation run 45799886978](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45799886978) passed metacognitive, envelope generation, mixed-sidecar recovery, five-owner projection fault matrix, invalid-envelope quarantine and all six continuity-ledger durability tests.
- The new joint test failed for the intended reason: after injected canonical Core save failure, the in-memory envelope generation was `2` instead of the prior committed `1` (`recovery-watchdog-checkpoint-semantics-20261124.mjs:132`). It was not a setup, import or syntax failure.
- Minimal production correction in `OrganismCore.ts` captures the previous committed envelope and restores it in the same catch that restores RecoveryWatchdog after a failed Core save. The post-commit observer remains strictly after the successful canonical save.
- On fixed head `fe87a69a4ba4051c540eabb8595ba569c53f015c`, [NK1 Cognitive Core Consolidation run 45800053473](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45800053473) completed **SUCCESS**. Steps passed: joint Core/Watchdog/envelope/sidecar semantics, checkpoint generation, projection fault matrix, continuity ledger durability, Core watchdog restart, active-information regression, pinned TypeScript compiler installation and semantic runtime `tsc`.
- On the same exact head, [Continuity runtime durability run 45800053522](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45800053522) completed **SUCCESS**; [Module Dependency Audit run 45800053449](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45800053449) completed **SUCCESS**; [ActionGateway receipt / SelfAuthorship recovery run 45800053059](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45800053059) completed **SUCCESS**.
- [Integrated software baseline run 45800053565](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45800053565) was still running at checkpoint time. [NeuroCore core regression validation run 45800053053](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45800053053) was also still running.
- The exact-head full Actions set contained 78 workflow runs at checkpoint time: 50 completed success, 14 in progress, 14 queued/pending, zero failures. This is an intermediate matrix, not full CI completion.

### Current acceptance status

- [x] Joint regression observed RED for the intended envelope-generation rollback defect.
- [x] Minimal rollback fix implemented.
- [x] Joint regression GREEN on exact fixed head.
- [x] Focused checkpoint envelope, five-owner projection fault matrix, ContinuityLedger six-test suite, Core watchdog restart, active-information regression.
- [x] Semantic runtime TypeScript typecheck (Cognitive Core Consolidation).
- [x] Continuity durability workflow and Module Dependency Audit.
- [ ] Remaining full exact-head Actions matrix: still in progress.
- [ ] Independent review.
- [ ] Android/Termux cold-restart, performance and storage-loss soak.
- [ ] Later canonical integration in a separate reviewed step.

**Do not merge or release yet.** Full regression validation, independent review and device gates remain open. This branch is an integration candidate only.
