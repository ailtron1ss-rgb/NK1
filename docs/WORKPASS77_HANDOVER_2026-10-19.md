# WorkPass77 — continuation handover (2026-10-19)

**Repository:** [ailtron1ss-rgb/NK1](https://github.com/ailtron1ss-rgb/NK1)  
**Active branch:** `workpass70-source`  
**Branch head at handover creation:** `23027caf41210b03260b0a243aee471090ca6f1a`  
**Purpose:** give the next chat a reliable resume point without requiring the user to restate the project mission.

> Always query the live branch head and Actions before relying on the SHAs/statuses below. This handover is a snapshot, not a permanent source of current status.

## Mission — keep this fixed

Build **NeuroCore / нейроядро** as one cohesive, genuinely functional, memory-rich, learning-capable and adaptive digital organism/personality, with Makise Kurisu as the intended identity/persona direction. The old `Neuro-Kurisu` directory name is historical lineage, not a separate project. Work code-first, preserve one canonical owner per capability, inspect upstream research and source code continuously, adapt only when justified, and prove behavior through tests/ablations. No decorative modules, fake metrics, empty stubs, duplicate state owners, blind source copying, or unsupported consciousness/autonomy claims.

Read first:
1. [NEUROCORE_START_HERE.md](../NEUROCORE_START_HERE.md)
2. [AGENTS.md](../AGENTS.md)
3. [README.md](../README.md)
4. [WorkPass76 audit/open-work register](WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md)
5. [Rebuild/evidence ledger](WORKPASS75_REBUILD_AND_EVIDENCE_LEDGER_2026-10-19.md)
6. [Research intake ledger](RESEARCH_INTAKE_LEDGER.md)
7. [Local LLM live smoke guide](LOCAL_LLM_SMOKE_GUIDE.md)

## Implemented in this continuation

- Fixed the language invocation completion timestamp ordering defect; added the source-order/backend attribution regression.
- Added a cold-memory retrieval regression and wired it into the active CI workflow.
- Wired temporal fact revision, historical/current query and bounded revision-history regressions into the core workflow.
- Added a static runtime test reachability audit that checks workflow/package-script references, required regression coverage and missing paths. It now emits the exact list of 76 unreferenced candidates. These are **review candidates**, not confirmed dead tests.
- Added a real server HTTP integration test using a loopback fake OpenAI-compatible provider. It checks actual chat response, provider/backend identity, model identity, latency and single-call behavior.
- Added an opt-in live `llama.cpp` smoke test. It skips cleanly unless `LLAMA_CPP_SMOKE_URL` is explicitly set and logs no prompt/output text.
- Added a PowerShell guide for running live inference on the Dell G3.
- Added the durable project charter, continuous research/upstream adaptation policy, and a source-intake ledger preserving known candidates plus names whose exact source must still be resolved.
- Reconciled the current open-work register; GitHub REST checks showed no open repository issues or pull requests at the time of inspection.

## Evidence and CI snapshot

| Run | Status observed | What it covers |
|---|---|---|
| [39319849208](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319849208) | **PASS** | Cold retrieval residency regression wired into the active workflow |
| [39320023335](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320023335) | **PASS** | Temporal revision/history regressions, runtime typecheck and core suite |
| [39320207064](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320207064) | **PASS** | Runtime test reachability audit: 1,200 runnable test-shaped files, 1,124 directly referenced, 76 candidates, 1,647 package scripts, 1,308 explicit references, zero missing paths |
| [39320623533](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320623533) | **PASS** | Test coverage audit, runtime typecheck, fake-provider HTTP chat integration and remaining core regression step |
| [39320833685](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320833685) | **PASS** | Optional live-smoke default skip plus app build/typechecks, fake-provider HTTP path and core regressions |
| [39320980715](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320980715) | **IN PROGRESS when checked** | Coverage audit now emits candidate paths; current full regression suite |
| [39321059462](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39321059462) | **IN PROGRESS when checked** | README change triggered the same core workflow |

The current branch head at this handover was a later documentation/source-ledger commit than the last completed code validation. Do not call the current head green until the live Actions query confirms the latest relevant run's conclusion.

## Still open — do not mark complete without evidence

### P0 — runtime reliability
1. Confirm the latest full CI run on the live head and inspect all failed steps/logs.
2. Add deterministic HTTP-level failure-path tests for provider 503/timeout, fallback provenance, cooldown observation and cancellation; preserve no-secret/no-network default CI.
3. Run the opt-in live local model smoke on Dell G3 and record actual model file/hash, quantization, context, GPU layers, cold/warm latency and output limits.
4. Test process restart while a language request or action is in flight; verify locks, state recovery and no duplicate side effects.

### P1 — memory and learning validity
5. Run independent RU/EN retrieval holdouts with same-corpus baseline, leakage audit, insertion-order/shuffle controls, per-case outputs and uncertainty intervals. Prior `recallDelta=0` means **no uplift claim** until new measurements justify one.
6. Run test-time learning transfer, no-learning controls, reversal/interference and selective forgetting. Separate test categories instead of collapsing them into one score.
7. Verify temporal fact revision with a labelled autobiographical corpus and test provenance/confidence calibration on conflicting facts.
8. Trace one action through accepted intent → ACK loss/timeout → process restart → read-after-write → independent postcondition → verified learning credit; include spoofed/copied/late proof and duplicate replay.

### P2 — integration and maintainability
9. Extend the static test audit to trace package-script-to-script calls and dynamic/aggregate test runners. Review the 76 candidates against imports, docs, generated manifests and provenance; do not bulk-delete.
10. Generate source import/call graph, package dependency/license inventory and public asset provenance. Preserve historical snapshots and exact source lineage.
11. Run browser/Live2D/TTS E2E, audio interruption/viseme timing and 24–72 hour soak. Capture traces rather than relying on synthetic indicators.
12. Tournament upstream model/architecture candidates (Mamba-3/SSD, FLA, RWKV-7, Titans/TTT, sparse-attention candidates, MoBA, Oja/fast-weight variants, HiPPO and memory-management methods) against a measured bottleneck. Audit exact source revisions/licenses first; unresolved names such as LIRA/GSA/DPLR/IPLR/MEMO artifacts must be disambiguated before porting.

## Research integration rule

Use [RESEARCH_INTAKE_LEDGER.md](RESEARCH_INTAKE_LEDGER.md) as a living ledger. It is deliberately explicit about what is merely a candidate versus what has been integrated. For every source: capture upstream URL/revision, license, files inspected, mechanism, expected benefit, downside, integration boundary, same-budget baseline, behavioral regression/ablation, result, resource cost and decision. Keep incompatible ideas isolated until a fair tournament resolves them.

## Evidence boundary

**Implemented:** source code, tests, CI wiring and durable handover artifacts exist.  
**Proven in CI:** the named regressions and workflows passed on the named commits/runs.  
**Not proven:** real-model quality, independent memory uplift, continual-learning transfer, autonomous external agency, device performance, subjective experience or consciousness. Software self-report is not evidence of consciousness.

Next session: check live head and Actions first, then continue at P0 item 1 and the deterministic provider failure-path test. Do not ask the user to restate the mission.


## Status refresh after handover creation

- **PROVEN (CI):** run [39320980715](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320980715) completed successfully on commit `0fbc6a85522497156ec254f983938d53a1912321`. The coverage audit passes after adding exact candidate paths to its JSON log; full runtime regression suite passed.
- **PROVEN (CI):** run [39321059462](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39321059462) completed successfully on `953ba963c4b1be247b6c183cf461f7ad464ce114`, including the opt-in live-smoke default skip, app build/typechecks, HTTP fake-provider regression and core suite.
- **Current branch head after the documentation-only handover links:** `dccbd3e332c4429f22c5c651b1b71a187fe18ab0`.
- **Latest run observed at this refresh:** [39321285670](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39321285670) was queued on the current head after updating `AGENTS.md`. Check it to completion before calling the current head CI-verified.
- Research ledger now explicitly preserves earlier requested candidates (Mamba-3/SSD, FLA, MoBA, preconditioned DeltaNet KKT/WY/`solve_tril`, Gated Oja, TTT, GSA, NSA, LIRA uncertainty/write gating, HiPPO, DPLR/IPLR, RWKV-7/Goose, fused updates, context parallelism, MEMO artifacts and `erase_control.py`). Unresolved names are marked as unresolved instead of assigned guessed upstream sources.


### Final snapshot for this chat handoff

- **Branch head when checked:** `86a142108de6e9f99955e7b508dcd8cf962d3de7` (`README.md` now links this handover).
- **Latest Actions runs:** [39321337981](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39321337981) on the current head and [39321285670](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39321285670) on the immediately preceding documentation-only head were still in progress when checked. The most recent completed full core run remains [39321059462](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39321059462), **PASS** on the code/workflow that includes the fake-provider HTTP test and opt-in live-smoke default-skip test.
- Start the next chat by polling both runs; do not claim the exact current head is green until one completes successfully. Code/workflow did not change after the validated test/audit commit `0fbc6a85522497156ec254f983938d53a1912321`; intervening commits were documentation/ledger/README updates.


## WorkPass78 — strategy and execution system added (2026-10-20)

### Artifacts committed
- [Master strategy and brain map](NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md): product invariants, provisional triage scorecard, 20-domain logical architecture, interaction envelope/trace, cautious human-brain analogy, 20-item risk register, release phases, scientific directions, known file ownership and next 12 tasks.
- [1,000-work-unit backlog](NEUROCORE_1000_WORK_UNIT_BACKLOG.md): 20 domains × 10 subareas × 5 lifecycle stages = 1,000 planned work units. All remain PLANNED / UNVERIFIED until evidence is linked. This must not be interpreted as 1,000 code changes to generate or as completed work.
- Updated `NEUROCORE_START_HERE.md`, `AGENTS.md` and `README.md` to link the strategy/backlog and preserve the continuation contract across chats.

### Integrity and status boundaries
- The master-plan scorecard is an explicitly provisional engineering triage estimate; it is not a measured benchmark and must not be promoted without raw measurements.
- The human-brain comparison is a functional analogy, not anatomical equivalence or evidence of consciousness.
- A complete list of every source file is **not yet proven**. The strategy records known canonical starting paths and specifies the required live path manifest, import/call graph, dynamic test-runner graph, SBOM/license inventory, and source/asset provenance reports.
- The backlog is intentionally a planning grid. Do not generate empty modules, mass tickets or cosmetic changes to increase completion counts.
- These documentation commits do not close the outstanding runtime release gates. Live Dell G3 inference, independent retrieval uplift, transfer learning, restart-safe external action proof, real embodiment E2E, target-device soak and release packaging remain open until verified.

### Next action queue
1. Refresh current branch head and latest Actions; do not rely on historical run state.
2. Implement provider HTTP failure-path regressions (503, timeout, malformed response, cancellation, fallback provenance, cooldown and recovery).
3. Add restart/fault-injection tests while a language request and an external action are in flight.
4. Run actual `llama.cpp` smoke on Dell G3 and record model hash/configuration plus cold/warm latency.
5. Generate source/call graph, dynamic test-runner graph, dependency/SBOM/license and asset provenance inventories.
6. Build independent RU/EN retrieval holdouts and leakage-resistant baseline/candidate experiments.
7. Prove learning transfer with no-learning, wrong-feedback, reversal, interference and selective-forgetting controls.
8. Complete action verification matrix for lost ACK, independent postcondition, spoofed/late evidence, duplicate replay and restart.
9. Complete production build and real browser/Live2D/TTS interruption/reconnect tests.
10. Run soak and target-hardware resource profiling; complete clean-room packaging and rollback gates.

**Resume contract:** on “работай над проектом” / “продолжай NeuroCore” / “@GitHub продолжай”, inspect live branch and Actions, read the charter + AGENTS + this handover + master strategy + backlog + research ledger, then continue the highest-impact unresolved item with code/tests where possible. Never ask the user to restate the mission.
