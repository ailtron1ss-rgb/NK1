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

---

## Final exact-head verification — 2026-11-26

This section is authoritative for the current integration checkpoint and supersedes earlier intermediate matrix counts and pending statuses above.

### Exact source identities

- Canonical source: workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e (unchanged).
- Integration branch: aspect/p0-persistence-integration-20261126.
- Exact tested integration head: eb1d8a68aae1f8160fde55c2c0915a6453683a80.
- PR: [#1198](https://github.com/ailtron1ss-rgb/NK1/pull/1198), OPEN / DRAFT; GitHub reports mergeable/clean.
- Branch contains seven commits ahead of canonical source and zero behind; canonical was not modified.
- PR #1170 and #1174 remain as original Draft source PRs. Their implementations are reconciled on this branch; neither was merged.
- 27 changed files in the PR, including the final CI harness and test-fixture hardening.

### Final exact-head Actions matrix

**78/78 completed SUCCESS; zero failures, zero cancelled, zero queued or running.**

Selected exact-head runs:
- [Cognitive Core Consolidation #45801839912](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839912) — joint save/Watchdog/envelope/sidecar test, envelope restore/fault matrix, ContinuityLedger durability, restart, active-information regression and semantic runtime TypeScript tsc.
- [Continuity runtime durability #45801839323](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839323) — formal durability gate, durable process restart, FileStateStore crash recovery, kill/resume, longitudinal continuity and persistent continuity integration.
- [NeuroCore core regression validation #45801839882](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839882) — app build/typecheck, runtime typecheck, memory, evidence fusion, CEF, Hexis, causal spine, UserModel, local language, speech, avatar and Live2D regressions.
- [Clean prototype startup smoke #45801839667](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839667) — clean production quickstart and development mode both PASS.
- [WorkPass79 cognitive runtime regression #45801842646](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801842646) — provider boundaries, timeout/payload bounds, client-disconnect abort, real HTTP provider path, causal attribution and safety interrupt/wake routing PASS.
- [Unified organism runtime #45801843081](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801843081) — PASS.
- [Paired cluster-bootstrap memory retrieval integrity #45801842985](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801842985) — PASS.
- [Independent evidence and memory evaluation #45801839742](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839742) — sanitized evidence export/digest, isolated bilingual MemoryOS2 A/B, HMAC-only per-query trace, independent scorers and Inspect AI task PASS.
- [Module Dependency Audit #45801839580](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839580) — PASS.
- [ActionGateway receipt to SelfAuthorship recovery #45801843022](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801843022) — PASS.
- [Embodiment / voice / cognitive context #45801839543](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45801839543) — PASS.

### Regression fixes completed in this integration branch

1. Speculative checkpoint generation rollback: initial joint test failed with in-memory generation 2 instead of committed generation 1. Production fix restores the previous envelope together with RecoveryWatchdog state when Core save fails. Sidecar observer runs only after canonical save succeeds. Subsequent successful commit advances exactly one generation.
2. Asynchronous restart fixture lifecycle: legacy big-pass-155 and big-pass-324 restart tests now await runtime stop() before reopening shared journal/state paths.
3. Clean-start harness race: startup smoke now waits for the supervisor's own final readiness banner before making an external gateway request; clean production quickstart and development mode both pass.
4. WorkPass82 cancellation fixture port collision: runtime test server now gets a distinct OS-assigned ephemeral loopback port after the fake provider binds. The formerly failing end-to-end client-disconnect cancellation scenario passes.

### Master Plan X acceptance status

- [x] Integrated current-source checkpoint envelope v2, OperationalJournal cursor and five-owner restore/repair.
- [x] Integrated durable ContinuityLedger rollback marker and RecoveryWatchdog commit semantics.
- [x] Single Core durable-save boundary with owner envelope and Watchdog checkpoint.
- [x] Joint red/green regression: failed Core save rolls back envelope generation and Watchdog success marker; no sidecar projection occurs; next successful save advances one generation.
- [x] Focused and full exact-head Actions matrix: 78/78 SUCCESS.
- [x] Semantic runtime TypeScript typecheck and module dependency audit.
- [x] Clean production startup and development startup.
- [x] Broad NeuroCore, Unified organism, memory, voice, avatar, CEF, local inference and causal runtime regressions.
- [ ] Independent code review of PR #1198.
- [ ] Android/Termux soak: cold restart, storage interruption/power loss, checkpoint latency p50/p95, payload bytes and peak heap.
- [ ] Integrate into workpass70-source after review and device acceptance.
- [ ] Release ZIP / tag verification and legal approval.

**Decision:** PR #1198 remains Draft. Code and exact-head CI are green, but independent review and physical-device durability/performance acceptance are not complete. Do not merge or release on CI evidence alone.