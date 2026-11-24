# WorkPass 37 — integration matrix and source disposition (2026-10-13)

## Canonical design

`OrganismCore` owns action orchestration. `ActionGateway` is the single tool side-effect/idempotency boundary. `ExternalObserverFabric` owns the shared external observation projection; it is not duplicated per adapter. `OutcomeCognition`/the causal projection and `CanonicalTemporalCreditAuthority` consume the exact outcome/decision linkage. `MemoryOS2` remains the only writable long-term memory owner, reached via `MemoryFabric`; no second “WILL memory” or “Legacy memory” is added.

## Active integrations changed in WorkPass37

| Source/area | Reused structure | Integration/modification | Boundary kept | Evidence/status |
|---|---|---|---|---|
| Canonical `ActionGateway` | Existing tool registry, outcome verifier, action audit | Stable request fingerprint, persisted pending/completed receipt, per-key single flight, conflict detection, restore-safe fail-closed behavior | It does not claim exactly-once remote execution where provider idempotency/receipt is absent; uncertain pending actions require recovery | Focused suite 13/13 |
| `OrganismCore` and reusable skill executor | Existing lifecycle, action outcome and persistence path | Deterministic child idempotency keys per skill step; finalizer joins receipt with outcome/observer/temporal-credit state | No second orchestrator or second event journal | Controlled end-to-end tests pass |
| ExternalObserverFabric | Existing observation source classes and postcondition evaluation | Only explicitly declared independent source plus verified postcondition can create observation; exact caller decision ID controls temporal credit | Never infer a decision from an execution ID; unknown/missing source does not earn external credit | Targeted integration test pass |
| StateMigrations / ReleaseContract | Existing persisted-organism migration path | Version 35.59.0/schema 225; initialize/preserve bounded receipt ledger | Historical schemas retained via migration, not forked by subsystem | Schema 223 and 224 migration test pass |
| MemoryOS2 retrieval | Existing lexical/fuzzy/semantic pipeline | Align controlled candidate benchmark's as-of semantics with baseline to avoid comparing current wall clock against 2033 fixtures | Synthetic uplift is 0; promotion intentionally remains disabled | Benchmark pass, no uplift |
| Root/app/release metadata | Existing root audit aliases, app script suite, assets/linkage checks | Add schema alignment and idempotency suite to runtime/root audit; refresh active inventory and task records | Does not stand in for Vite production build/browser E2E | Audit suites included |

## Source archives / Legacy disposition

The WorkPass36 baseline already contains source and legacy material for NeuroCore V143/V126, Kurisu v9/v56, WILL, Lumina, Letta, Hexis, Conscio, DeepCode, NOMEGA and split Grok packages. WorkPass37 did not download a parallel replacement repository: available sources were used rather than duplicating them. The previous WorkPass36 matrix and immutable SHA-256 manifests remain historical evidence.

- **Adapted to canonical runtime:** WILL decision/agency bridge, Lumina/Conscio tokenization-compatible shared primitive, Letta/Hexis/Conscio serialization adapters and selected tool/research adapters.
- **Canonical ownership:** MemoryOS2 owns writable memory; MemoryFabric is its mutation/query boundary; ActionGateway owns keyed tool execution receipts; ExternalObserverFabric owns shared observation evidence.
- **Compatibility projections:** old memory/event formats round-trip through adapters; old IDs are preserved as provenance/context rather than inserted as unresolved edges into the canonical graph.
- **Rendering only:** Live2D and legacy sprite resolvers remain UI presentation, not organism state owners. UI/asset files are retained.
- **Research-only/provenance:** NeuroCore/NOMEGA/DeepCode experiments and old source ZIPs stay available for focused promotion after equivalent behavior and measured benefit are established; archive presence is not counted as runtime integration.

## Known residual gaps

- Real external provider/device receipts, reconnect and remote idempotency are not proven by a controlled mock/tool test.
- Full application dependency-installed build, browser Live2D E2E, clean-room restore/rollback and soak remain open.
- Retrieval benchmark is at parity only; no candidate promotion until independent labelled temporal holdout demonstrates uplift.
- Function inventory is broad, but static liveness/syntax and probe audits do not prove every function's semantics. Continue capability evidence for critical journeys.
