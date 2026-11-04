# N.E.K.O. → NeuroK / NK1 adaptation tree
**Snapshot:** 2026-11-04  
**Canonical source:** `ailtron1ss-rgb/NK1`, branch `workpass70-source`  
**Verified source tip at this pass:** `d8902d765ef218a32125567f24345fea77f1c902`

## 1. Archive provenance

Five uploaded ZIPs were inspected as separate fragments of the same N.E.K.O. source snapshot. Their combined compressed size is approximately 320 MB; the extracted inventory contains approximately 6,099 files.

| Archive | Compressed size | SHA-256 |
|---|---:|---|
| archive2New.zip | 7.9 MB | `ab1b002f3d896df155c811161fbc502f85923634c1e13f776426bc0a92480a7d` |
| archiveNew.zip | 71 MB | `479c699461c341b116c8fb90f2dc69c610ba62fb0969fe053278aebe38eba14d` |
| archive33New.zip | 222 MB | `d320d12871e39179f9b56cc9c0f82f4ac1893b91b1b6241d308cc7e829690a31` |
| archiveNe5w.zip | 176 KB | `ddd5f507a16ac0a45e1b203750da140c7963e3f2ec5f596f8e7487cbda0d1b35` |
| archive4New.zip | 19 MB | `61400c2d0cb087258a3f03db6bf5d614384521861b44c6267ad9ecbb895d3dc8` |

Inventory highlights: 663 Python modules in the primary logic archive; 354 JavaScript assets plus avatar/audio/animation resources in the static archive; 3,031 plugin/test files in the plugin archive; and approximately 1,858 Python test files in that archive. Python AST parsing and JavaScript syntax checks passed in the previous archive audit. Full pytest execution was not established because dependency setup was incomplete and selected runs timed out; do not infer that the entire upstream test suite passed.

## 2. Integration tree

```text
N.E.K.O. source patterns
├── Memory
│   ├── BM25 + local vector search + RRF
│   ├── Recent → Facts → Reflections → Persona
│   └── append-only EventLog / Outbox
│
├── Agent execution
│   ├── plugin manifests / SDK
│   ├── plugin filter / task executor
│   └── browser / computer-use adapters
│
├── Autonomy
│   └── proactive controller, consent and stale-session guards
│
└── Embodiment
    ├── Live2D / VRM / MMD
    ├── speech / ASR / TTS
    └── motion and avatar assets

NK1 canonical owners
├── MemoryOS2 + MemoryFabric
│   └── N.E.K.O. hybrid ranking → PR #774 (isolated shadow adapter)
├── FileStateStore / RuntimeEvidenceBus / OperationalJournal
│   └── critical-event fsync and bounded rotation → PR #775
├── ActionGateway
│   ├── capability classes and approval records
│   ├── input/output contracts
│   ├── durable idempotency ledger
│   └── provider receipt reconciliation
├── OrganismRuntime / RuntimeClockScheduler / OrganismState
│   └── autonomy and proactive work remain under canonical cadence/consent gates
├── GroundedWorldState / ExternalObserverFabric / spatial MemoryOS2
│   └── observed, frame-aware spatial evidence workstreams (#730, #738, #746)
└── AvatarStage / Avatar3DStage / VRM runtime adapter
    └── preserve existing 2D and 3D renderer paths (#524, #533)
```

## 3. Stage-by-stage decisions

| Stage | N.E.K.O. mechanism | NK1 adaptation / decision | State |
|---|---|---|---|
| 01 — retrieval | BM25 + vector + Reciprocal Rank Fusion | Combine already-ranked canonical MemoryOS2 IDs only; no second store, embeddings or prompt path | Implemented as shadow primitive in PR #774; not live-wired |
| 02 — journal durability | append + fsync + bounded rotation | Serialize diagnostic writes; fsync warnings/errors and selected critical lifecycle records; leave ordinary info ticks unsynced | Implemented in PR #775; exact focused CI and typecheck passed |
| 03 — Outbox | pending/done/attempt and dead-letter handling | Do not add another queue: NK1 ActionGateway already has durable idempotency, pending receipts and provider reconciliation. Review any gap against its canonical ledger first | Existing owner; no duplicate implementation |
| 04 — plugin governance | plugin.toml, SDK, runtime flags and UI permission requests | Manifest UI permissions are not runtime tool capabilities. Any future importer must require host-owned capability grants, explicit permission class, bounded input/output contracts and idempotency policy | Adaptation contract only; no automatic plugin execution |
| 05 — autonomy | proactive controller and session/consent guards | Preserve NK1 cadence, silence accounting, user interruption and explicit consent. Do not create a parallel scheduler or background side-effect path | Existing runtime owner; no duplicate controller |
| 06 — perception | camera/screen/browser/computer-use adapters | Accept only producer-marked observed evidence with source/frame provenance; model-generated descriptions must not masquerade as sensor observations | Existing grounded-world/spatial workstreams; device truth remains a separate gate |
| 07 — embodiment | Live2D, VRM, MMD, speech and motion | Keep NK1's selectable 2D/3D renderer and speech gateway. Adapt normalized body-state signals, not N.E.K.O. binaries or runtime ownership | Existing renderer paths; asset/format adaptation remains separate |
| 08 — learning/evaluation | reflection, skill refinement and memory promotion | Keep NK1 evidence lineage, host-owned trust and independent source-group holdout gates. Synthetic adapter tests never authorize promotion | Existing evidence gates; no learning-policy change in these PRs |

## 4. Implemented work in this pass

### PR #774 — memory shadow adapter

- Bounded weighted RRF: `score(d) = Σ weight(c)/(60 + rank(c,d))`.
- Subject scope is applied before a candidate contributes to score; missing owner metadata is excluded in scoped recall.
- Rejects accessor-backed objects, Proxy objects, sparse arrays, malformed records and duplicate channel names.
- Uses locale-independent code-unit tie-breaking.
- Bounds channels to 8, candidate references per channel to 512, and output to 64.
- 11/11 Node 24 tests passed on the exact PR head, including the 4,096-reference maximum-bound case.
- It remains shadow-only. No retrieval uplift or runtime wiring is claimed.

### PR #775 — OperationalJournal durability

- Serializes concurrent writes and exposes flush() as a queue barrier.
- Uses file-handle append and selective file fsync for warnings/errors and named critical lifecycle events.
- Syncs the parent directory after rotation and, for critical writes, after file fsync.
- Uses incoming-byte-aware rotation with 1..5 bounded rotated segments.
- Preserves the existing constructor call shape; no schema migration or new dependency.
- Exact-head CI passed 5/5 focused tests, existing OPERATIONAL_HARDENING, and full organism runtime TYPECHECK.
- This remains a diagnostic journal, not a replayable event store or memory owner.

## 5. Security and promotion boundaries

- N.E.K.O. manifest flags such as enabled/auto_start and UI permissions must never be treated as NK1 host authorization.
- N.E.K.O. Outbox semantics must not bypass ActionGateway's durable idempotency and provider-receipt reconciliation.
- Self-improvement signing keys and expected source revisions remain host-owned; candidate-controlled proof data cannot establish its own trust. Existing host-owned patch-receipt authority work is tracked separately (PR #743); its live composition-root wiring must be verified before any self-modification is enabled.
- RRF promotion requires canonical ranked IDs, immutable RU/EN source/session-clustered holdout, at least five paired seeds, positive recallDelta and no subject leakage or latency regression.
- The OperationalJournal changes do not establish power-loss durability on Android/Termux. Device-level crash/power-loss soak remains required.
- The archives' runtime license is Apache-2.0, but third-party libraries, models, audio and avatar assets retain their own notices/licenses. No binary asset was copied into NK1 in these workpasses.

## 6. Unresolved terminology

The uploaded source archives were searched for `ЕОДП`, `EODP` and `ОДП`; no matching code or documentation token was found. This integration tree therefore does not guess what that subsystem acronym means.

## 7. Release boundary

These changes are draft source-branch PRs. They do not change `main` or the published GitHub Release ZIP. A feature is not considered released until its code is present in the actual published ZIP and the corresponding release artifact is re-verified.
