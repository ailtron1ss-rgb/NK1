# Integration ledger

| Area | Existing owner/path | Current status | Next action |
|---|---|---|---|
| UI ↔ runtime API | `app/src/neuro-kurisu/api.ts`, `app/src/organism/store.ts`, backend `/api/organism/ui-snapshot` | IMPLEMENTED upstream; NeuroCore env alias added | Verify all UI actions against a live runtime |
| Organism host | `OrganismRuntime.ts` | IMPLEMENTED upstream; no local/device validation in this session | Run runtime smoke + shutdown/restart persistence tests |
| Canonical state/core | `OrganismCore.ts` | Existing canonical owner preserved | Inspect persistence/recovery paths before changes |
| Subsystem composition | `OrganismSystemFabric.ts` | IMPLEMENTED upstream | Check subsystem contracts/health as one composition |
| Canonical memory | `MemoryOS2.ts` via `MemoryFabric` | SINGLE OWNER IN CODE; identity, restore/round-trip and capacity/lifecycle regressions are included in the gate; branch execution pending | Inspect CI results, then add write-idempotency and action-governance coverage |
| Cognitive cycle | `UnifiedCognitiveCycle.ts` | IMPLEMENTED upstream | Keep strict-cycle and runtime-wiring tests in release gate |
| Action permissions | `ActionGateway.ts` | Existing authority preserved | Audit all action callers; no direct execution shortcuts |
| Local LLM | `OpenAICompatibleLocalChatProvider.ts` | OPTIONAL ADAPTER IMPLEMENTED upstream | Run llama.cpp handshake, generation, timeout and fallback tests |
| 3D embodiment | `proceduralHumanoidRig.ts`, `Avatar3DStage.tsx`, `articulatedBodyParticles.ts` | 61-bone hierarchy / 60 movable pivots; 22-particle / 21-segment stream; IK, 150-degree hinge limits, heel/toe contact and friction wired; 20 Hz motion snapshots implemented; new scheduler regression pending CI | Run all focused rig/solver suites; then continuous surface, balance, gait and phone profiling |
| Android/Termux | toolchain/startup scripts | DOCUMENTED; DEVICE UNVERIFIED | Test exact Node 24 / Python 3.11 and phone resource budgets |
| Product identity | browser metadata, home screen, health endpoint | PARTIALLY MIGRATED to NeuroCore | Search/fix remaining visible old product labels without breaking compatibility |
| Release acceptance | typecheck, app tests, runtime suites, CI, device tests | NOT YET VERIFIED for this branch | Run all gates and keep failure evidence |

## Source synchronization and donor decisions

- Product branch is seeded from `3526f618...` and synchronized through source head `3857e805...` by merge commit `e5fa0fbb...`; the source branch and `main` were not modified.
- PR #1218 RecoveryWatchdog durability fix is already present in the pinned baseline. Do not port it a second time.
- PR #1217 is the superseded test-first predecessor; no port.
- PR #1170 RuntimeCheckpointEnvelope, PR #1174 ContinuityLedger durability, and PR #1198 persistence integration are review candidates only. Compare against the present source before extracting unique behaviour; never merge wholesale across diverged bases.
- External/legacy research projects remain donor material. Assimilate only specific tested behaviour with a mapped canonical owner.

Upstream implementation is recorded as inherited baseline, not as work completed by this pass. A test entering the CI command is not equivalent to a passed test.
