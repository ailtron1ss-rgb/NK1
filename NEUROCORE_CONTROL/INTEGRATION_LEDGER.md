# Integration ledger

| Area | Existing owner/path | Current status | Next action |
|---|---|---|---|
| UI ↔ runtime API | `app/src/neuro-kurisu/api.ts`, `app/src/organism/store.ts`, backend `/api/organism/ui-snapshot` | IMPLEMENTED upstream; NeuroCore env alias added | Verify all UI actions against a live runtime |
| Organism host | `OrganismRuntime.ts` | IMPLEMENTED upstream; no local/device validation in this session | Run runtime smoke + shutdown/restart persistence tests |
| Canonical state/core | `OrganismCore.ts` | Existing canonical owner preserved | Inspect persistence/recovery paths before changes |
| Subsystem composition | `OrganismSystemFabric.ts` | IMPLEMENTED upstream | Check subsystem contracts/health as one composition |
| Canonical memory | `MemoryOS2.ts` via `MemoryFabric` | SINGLE OWNER IN CODE; new regression authored, not yet run | Execute owner identity + restore + retrieval suites |
| Cognitive cycle | `UnifiedCognitiveCycle.ts` | IMPLEMENTED upstream | Keep strict-cycle and runtime-wiring tests in release gate |
| Action permissions | `ActionGateway.ts` | Existing authority preserved | Audit all action callers; no direct execution shortcuts |
| Local LLM | `OpenAICompatibleLocalChatProvider.ts` | OPTIONAL ADAPTER IMPLEMENTED upstream | Run llama.cpp handshake, generation, timeout and fallback tests |
| 3D embodiment | `Avatar3DStage.tsx`, VRM/GLB adapters | RIG/RENDER PATH EXISTS; requested full body not accepted | Build anatomical articulated body + IK and validate model-less fallback |
| Android/Termux | toolchain/startup scripts | DOCUMENTED; DEVICE UNVERIFIED | Test exact Node 24 / Python 3.11 and phone resource budgets |
| Product identity | browser metadata, home screen, health endpoint | PARTIALLY MIGRATED to NeuroCore | Search/fix remaining visible old product labels without breaking compatibility |
| Release acceptance | typecheck, app tests, runtime suites, CI, device tests | NOT YET VERIFIED for this branch | Run all gates and keep failure evidence |

## Donor branch decisions

- PR #1218 RecoveryWatchdog durability fix is already present in the pinned baseline. Do not port it a second time.
- PR #1217 is the superseded test-first predecessor; no port.
- PR #1170 RuntimeCheckpointEnvelope, PR #1174 ContinuityLedger durability, and PR #1198 persistence integration are review candidates only. Compare against the present source before extracting unique behaviour; never merge wholesale across diverged bases.
- External/legacy research projects remain donor material. Assimilate only specific tested behaviour with a mapped canonical owner.

All local integration percentages remain 0 until code is in this branch and validated. Existing upstream implementation is recorded as inherited baseline, not as work completed by this pass.
