# NK1 Neural Connectome — Integration Ledger

**Updated:** 2026-11-26  
**Repository:** `ailtron1ss-rgb/NK1`  
**Work branch:** `aspect/neural-connectome-integration-20261126`  
**Canonical source baseline:** `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`  
**Master Plan X reference snapshot:** `9008a8982a5173304456bee2c604bd0bc8665964`  
**Progress:** 20/100 — seven owner runtimes and dependency contracts inspected  
**Status:** analysis/inventory only; no source runtime code integrated by this ledger commit.

## Safety and source-of-truth rules

- The work branch is isolated from `workpass70-source` and `main`.
- The `gearonone.zip` archive is an immutable baseline; it is not modified here.
- `main` is treated as release/metadata-only unless a verified release task explicitly says otherwise.
- No existing branch or PR is deleted, rebased, merged, or force-updated by this work.
- PR status is not treated as proof of integration. A change is only **INTEGRATED** after its exact code is present on the canonical source SHA.
- Distinguish **IMPLEMENTED**, **CONNECTED**, **TESTED**, **MEASURED**, and **RELEASED**. These are separate claims.

## Baseline evidence

- Master Plan X v2.0 identifies `workpass70-source` as canonical and records `9008a898...` as its reference snapshot.
- The consolidation ledger PR #1133 records the subsequent source merge #1191 at `7802c329...`, then merge #1139 at `7e601680...`; the latter is the current source checkpoint used for this work branch.
- Comparing `9008a898...` to `7e601680...` returns **15 commits ahead, 0 behind**.
- Repository default branch is `main`; README describes it as release/metadata-only. The README's own older checkpoint is stale and must not override live branch evidence.
- The latest open-PR search returned its first 100 entries only. A prior full REST census recorded in #1133 reported 1,160 branches and 264 open PRs after #1139; that census is a snapshot, not a newly repeated full census.

## Target system topology

The target is one runtime with seven ownership domains, not seven competing runtimes:

1. **Self** — identity, continuity, metacognition, self-observation.
2. **Governance** — policy, consent, capability, approvals, quarantine.
3. **Memory** — MemoryOS2 as the sole canonical record owner; MemoryFabric as the lifecycle/write boundary; indexes and graphs are projections.
4. **World** — admission, grounded world state, perception, prediction, active perception.
5. **Embodiment** — voice, avatar, motor/body state, device interfaces.
6. **Agency** — motivation, goals, planning, ActionGateway, outcome verification.
7. **Evidence / Research** — experiments, provenance, holdouts, skill evaluation and promotion.

The intended causal spine is:

`Ingress → Admission/Perception → Grounded World → Appraisal/Attention → Goals → Workspace → P61/P64 Arbitration → Plan → Governance → ActionGateway → External Postcondition Verification → Outcome Receipt → Reflection/SelfAuthorship → Memory/Learning Consolidation`.

The runtime cycle remains `Perceive → Appraise → Plan → Act → Reflect → Consolidate`; implementation may expose additional internal stages, but they must retain one decision identity and causal lineage.

## Initial connection evidence

| Connection / aspect | Live PR evidence | Current observed state | Integration risk |
|---|---|---|---|
| Seven-domain subsystem registry and read-only ports | [#1176](https://github.com/ailtron1ss-rgb/NK1/pull/1176): 34 snapshot ports across seven domains | Draft; 9 files; head `305d4f2...`; compare with source: 11 ahead / 16 behind, diverged | Must reconcile accessors and avoid diagnostics triggering ticks/scheduling |
| World → appraisal / predictive attention | [#1175](https://github.com/ailtron1ss-rgb/NK1/pull/1175) | Draft; 32 files; head `0d3b382...`; 169 ahead / 15 behind, diverged; GitHub reports not mergeable | Very large stale/stacked branch; inspect owner boundaries and tests before selective port |
| Current-cycle workspace → P61/P64 | [#1186](https://github.com/ailtron1ss-rgb/NK1/pull/1186) | Draft; 5 files; head `a29e67f...`; 8 ahead / 15 behind, diverged | Validate one competition per tick and same-cycle ignition, then port only minimal diff |
| Decision identity across cognitive cycle | [#1167](https://github.com/ailtron1ss-rgb/NK1/pull/1167) | Draft; 15 files; head `bf06021...`; 21 ahead / 16 behind, diverged | Must share identity across plan/action/outcome/CEF without synthetic dangling event edges |
| Atomic runtime checkpoint | [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170) | Draft; 12 files; head `236cbd1...`; 23 ahead / 6 behind, diverged | Core persistence owner overlap; compare with continuity/watchdog changes |
| Continuity journal / recovery watchdog | [#1174](https://github.com/ailtron1ss-rgb/NK1/pull/1174) | Draft; 13 files; head `9e7294d...`; 20 ahead / 15 behind, diverged | Must reconcile with one checkpoint generation and one recovery authority |
| UI runtime truth / recovery | [#1171](https://github.com/ailtron1ss-rgb/NK1/pull/1171) | Draft; 44 files; head `bccdc72...`; 118 ahead / 16 behind, diverged | Large surface; separate API truth, UI projection, avatar controls and recovery states |
| Avatar v12 / PBR / mobile controls | [#1164](https://github.com/ailtron1ss-rgb/NK1/pull/1164) | Draft; 60 files; head `11cbb2c...`; 145 ahead / 17 behind, diverged | Preserve v5 canonical model; observed browser contact acceptance failure needs resolution |
| Observation admission / provenance | [#821](https://github.com/ailtron1ss-rgb/NK1/pull/821) | Draft; 19 files; GitHub reports not mergeable | Critical ingress trust boundary; compare current source and preserve host-attestation semantics |
| HTTP perimeter / closure growth | [#1193](https://github.com/ailtron1ss-rgb/NK1/pull/1193) | Draft; head `ef7ccd8...`; base snapshot `9008a898...` | Recheck current base and exact-head CI |
| Memory write policies | [#1194](https://github.com/ailtron1ss-rgb/NK1/pull/1194) | Draft; head `9cf2478...`; stacked on #1193 | Do not treat as standalone merge; inspect combined lineage |
| Plugin ingress quarantine | [#1169](https://github.com/ailtron1ss-rgb/NK1/pull/1169) | Draft; stacked on #1170 | Must integrate after canonical checkpoint owner is settled |
| Durable delivery outbox / social delivery | [#1182](https://github.com/ailtron1ss-rgb/NK1/pull/1182), [#1181](https://github.com/ailtron1ss-rgb/NK1/pull/1181) | Both Draft | Keep external communication permissions separate from internal initiative and tool execution |
| Verified agency / affect / learning | [#1168](https://github.com/ailtron1ss-rgb/NK1/pull/1168), [#1173](https://github.com/ailtron1ss-rgb/NK1/pull/1173), [#1177](https://github.com/ailtron1ss-rgb/NK1/pull/1177), [#1180](https://github.com/ailtron1ss-rgb/NK1/pull/1180) | Draft; #1168 and #1173 reported not mergeable | Verify decision-bound evidence, temporal freshness and independent promotion gates |
| Expanded development plan | [#1196](https://github.com/ailtron1ss-rgb/NK1/pull/1196) | Draft documentation-only PR | Reconcile its 103-step plan with Master Plan X; do not create a competing task register |

**Important:** Workflow runs fetched for PR heads show many successful completed workflows, but this is not a blanket exact-head green verdict. The fetched run listing is first-page-only; some runs may refer to earlier commits. Re-fetch exact-head status and workflow runs immediately before any merge decision.

## First engineering priorities

1. Freeze and prove the current source ref/tree; refresh the full branch and PR census from all pages.
2. Read canonical source ownership for `OrganismCore`, `OrganismRuntime`, `OrganismSystemFabric`, `UnifiedCognitiveCycle`, `CognitiveEventFabric`, `MemoryOS2`, `MemoryFabric`, `ActionGateway`, world and embodiment owners.
3. Build a file/class/method-level registry and directed connection matrix. Each edge must identify source, target, port/event, owner, evidence and test.
4. Reconcile the P0 causal spine: observation admission → world → appraisal/attention → workspace → decision → plan/action → external verification → durable outcome → reflection/memory.
5. Reconcile checkpoint, continuity journal and recovery into one durable generation; no parallel persistence owners.
6. Integrate UI/avatar/voice through the canonical versioned organism/brain frame, preserving current canonical renderer/model and truthful fallback states.
7. Add only missing connection tests; do not duplicate existing tests or create shadow subsystems.
8. Run exact-head CI and integration tests; only then propose merge order. Do not merge or release without explicit acceptance and source/archive/legal gates.

## Progress ledger

- [x] Confirm repository identity, default branch and permissions.
- [x] Identify the canonical source checkpoint from the 26-Nov consolidation ledger and compare it with the Master Plan reference SHA.
- [x] Retrieve the first page of current open PRs and inspect the major architecture PR metadata.
- [x] Compare eight major aspect PR heads with the current source checkpoint; all eight are divergent and require reconciliation.
- [ ] Complete full paginated branch and open-PR census.
- [ ] Inventory all source files, classes, owners and public ports.
- [ ] Produce complete connection matrix and missing-edge register.
- [ ] Reconcile P0 causal spine and durable recovery.
- [ ] Selectively port and verify implementation changes on isolated aspect branches.
- [ ] Complete integration, device/browser acceptance and release evidence.

**Progress is 20/100.** This measures completion of the requested unified integration work, not the percentage of NK1 product readiness.


## Census and architecture audit refinement — 26 Nov 2026

- The full census artifacts in PR #1133 were fetched and parsed: **1,160 branch refs** across two JSONL parts (600 + 560), and **264 open PRs** in the full open-PR JSONL. This is a complete paginated census snapshot after merge #1139, not a newly repeated live REST enumeration in this work session.
- The census records 1,160 unique branch HEADs and zero duplicate HEAD groups. It did **not** establish global tree-SHA uniqueness; do not infer that all branches contain unique code.
- Current canonical source tree SHA recorded by the consolidation ledger: `bd5eb23dc2d7c029c6b9ae9e10c49257590e571e`.
- The 24-Nov Deep Engineering Audit counted 11,535 tree entries and 746 organism source files, but against an older source checkpoint (`54f9ec7...`). These counts are historical reference only; a fresh tree/file census at `7e601680...` remains required.
- A separate special-mechanisms workpass reported `audit:architecture` PASS (2,542 source files, 710 canonical files, zero missing imports/cycles), but `audit:core-physical-ownership` FAIL due to missing canonical `MemorySubsystemRuntime` extraction and a Core line-regression threshold. This is branch/workpass evidence, not yet re-run on current canonical source.
- The 26-Nov execution register uses a strict denominator of 144 unique T3 tasks. Its initial audit recorded 0/144 fully completed at the complete proof threshold; 8/144 had exact-PR-head inspection and 6/144 had green PR-head CI in that earlier snapshot. This does not mean there is no code: it means none was credited as fully complete across all required gates in that register. Re-audit on current source is required before adopting those counts as live progress.

### Updated work ledger

- [x] Retrieve both full branch census JSONL parts (600 + 560 records) and full open-PR census (264 records) from the existing consolidation artifact.
- [x] Read the 26-Nov branch integration ledger and current-source merge evidence for #1191 and #1139.
- [x] Separate current-source tree SHA from the Master Plan reference SHA and older documentation baselines.
- [x] Capture first-pass diverged-PR matrix for the eight primary architecture PRs.
- [ ] Re-enumerate live branch refs and open PRs directly from GitHub REST, all pages, to refresh the snapshot.
- [ ] Recount source tree entries and organism files at exact current SHA.
- [ ] Re-run architecture, ownership, dependency and import-cycle audits at exact current SHA.


## Canonical owner inspection — source files fetched from `workpass70-source`

The following seven owner runtime files were read from the canonical source branch. These are actual source files, not just roadmap labels:

| Domain | Canonical owner | Declared dependencies | Main responsibility visible in source |
|---|---|---|---|
| Embodiment | `core/EmbodimentSubsystemRuntime.ts` | none | Sensorium, multimodal perception, PerceptionEngine, camera evidence, active perception |
| World | `core/WorldSubsystemRuntime.ts` | embodiment | Grounded world state, world models, prediction, active inference and causal world bridges |
| Memory | `core/MemorySubsystemRuntime.ts` | world | MemoryOS2, MemoryFabric, episodic/autobiographical/semantic/working memory, lifecycle and consolidation |
| Self | `core/SelfSubsystemRuntime.ts` | memory, world | Identity continuity, SelfAuthorship, personhood, UserModel evidence, metacognition and self-state |
| Governance | `core/GovernanceSubsystemRuntime.ts` | self | CapabilityRegistry, IntegritySentinel, ReplayEngine, resilience, constitutional arbiter and lifecycle |
| Agency | `core/AgencySubsystemRuntime.ts` | self, world, governance | Goals, project execution, budget, quorum, scheduling and initiative lifecycle |
| Evidence / Research | `core/EvidenceResearchSubsystemRuntime.ts` | world, memory, governance | Prediction/evidence ledgers, evidence firewall, research sessions, skill acquisition and controlled experiments |

### Structural findings

- `OrganismSystemFabric` is the composition root for these seven physical owners. Its source exposes `names()`, `get()`, `contracts()`, `capabilityMatrix()`, `dependencyOrder()`, `dependencyCycles()`, `executionOrder()`, `systemGraph()`, `snapshot()` and `restoreFromPersisted()`.
- The declared dependency order is embodiment → world → memory → self → governance → agency → research. The contract source records the dependency edges and execution ranks; the runtime graph should still be tested on the exact current SHA.
- `CognitiveSubsystemPorts` and `CognitiveSubsystemRegistry` are a separate dependency-inverted read-only facade over the seven owners. They are not a second set of physical subsystem owners.
- PR #1176 adds the 34-port read-only probe details/cache/flight evidence on top of that facade. It should be evaluated as observability hardening, not treated as the missing seven-domain architecture itself.
- `MemorySubsystemRuntime` physically owns many memory mechanisms, but its source constructs `MemoryOS2` and a `MemoryFabric` that receives that canonical store. Knowledge importers and evidence bridges are explicitly wired through `MemoryFabric`. A full write-call audit is still required to prove there are no bypass writers or shadow stores.
- `CognitiveEventFabric` describes itself as a thin causal ledger and explicitly avoids becoming a second source of truth for memory, world or goals. Its schema includes the strict eleven-stage operational cycle and parent/receipt lineage.
- `OrganismSystemFabric.restoreFromPersisted()` restores the physical owners and adapters in an explicit sequence. This is a key integration point for checkpoint/recovery reconciliation.

### Current evidence classification

- **IMPLEMENTED (structural):** seven owner runtime classes, their dependency declarations, composition fabric, system contracts and snapshots/restores are present in the current source tree.
- **CONNECTED (partial):** owner-level assembly and dependency metadata exist; every end-to-end runtime call edge has not yet been traced.
- **TESTED (partial):** focused branch tests exist for subsystem ports, workspace order, world→appraisal/attention and event lineage; their PRs are still draft/diverged, so they do not prove all tests pass on current source.
- **MEASURED:** no new target-device or end-to-end latency measurement performed in this workpass.
- **RELEASED:** no new work from this branch is in main or the published ZIP.

### Next source-level work

1. Trace the actual `OrganismRuntime → OrganismCore → OrganismSystemFabric` construction and restore path.
2. Locate the canonical cognitive cycle boundary and enumerate all stage call sites in execution order.
3. Trace each edge from observation admission through world/appraisal/attention/workspace/P61-P64/goal/plan/action/outcome/learning.
4. Audit all writes into MemoryOS2 and all derived projections for single-writer compliance.
5. Connect the event lineage to durable checkpoint/recovery without promoting the bounded CEF ring buffer into a second autobiography.
