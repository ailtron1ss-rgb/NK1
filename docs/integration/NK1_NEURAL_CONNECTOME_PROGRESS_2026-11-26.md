# NK1 Neural Connectome — Integration Ledger

**Updated:** 2026-11-26  
**Repository:** `ailtron1ss-rgb/NK1`  
**Work branch:** `aspect/neural-connectome-integration-20261126`  
**Canonical source baseline:** `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`  
**Master Plan X reference snapshot:** `9008a8982a5173304456bee2c604bd0bc8665964`  
**Progress:** 12/100 — inventory and topology discovery started  
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

**Progress is 12/100.** This measures completion of the requested unified integration work, not the percentage of NK1 product readiness.
