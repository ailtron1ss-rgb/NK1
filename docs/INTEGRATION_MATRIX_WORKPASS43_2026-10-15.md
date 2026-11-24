# WorkPass 43 integration matrix — canonical runtime targets

The complete source list is `docs/integration-analysis/DOUS_SOURCE_DECISION_MATRIX.csv`; cross-check evidence in `Plants_INTEGRATION_MATRIX.csv` and `SYN_UPSTREAM_USEFULNESS_PLAN.csv`. This pass implements only the receipt/action/UI integrity slice below; no broad upstream tree was copied.

| Priority | Source mechanism | Canonical target | WorkPass43 disposition | Required next acceptance |
|---|---|---|---|---|
| P0 | WILL action reafference and skill credit | `ActionGateway`, `OutcomeCognitionFabric`, `CognitiveEventFabric`, `WillIntegrationBridge`, temporal credit | Stabilized receipt identity and explicit plan→action→outcome→evidence path; strict external correlation | Real device/provider receipt, exact decision/execution lineage, no double reward, restart test |
| P0 | Microsoft Agent Framework / OpenAI Agents SDK typed tool events and guardrails | Gateway contracts, finalizer, CEF | Adapted contracts/ideas to receipt-linked trace; no second workflow runtime | Denied executor side effect zero; failure/replay/resume typed and auditable |
| P1 | OpenClaw / Hermes session and gateway recovery | Existing server sessions, ActionGateway archive, runtime recovery | Security and fail-closed patterns only; no second gateway | Session restart/revocation, archived receipt replay and reconnect E2E |
| P1 | Lumina temporal decay, dreaming and staged toolmaker | `MemoryFabric` candidate/lifecycle route and existing tool approval | Remains candidate; not copied into a parallel store/agent | UTC ordering, approval-before-execution, memory holdout and resource budget |
| P1 | Hexis belief supersession/revert/provenance | `MemoryOS2` revision history, MemoryFabric lifecycle receipts | Remains candidate beyond existing canonical revision features | Supersede/revert/replay across restore with canonical IDs |
| P1 | Mem0 entity extraction/update/conflict candidates | Candidate producer → `MemoryFabric.applyLifecycleCommand` → `MemoryOS2` | Candidate only | Same candidate idempotent, changed payload conflict explicit, labelled set evaluation |
| P1 | llama.cpp local inference | Existing local provider adapter and P40 model ecology | No change in this pass | Actual target hardware, model revision, RAM/VRAM, cold/warm latency, cancellation |
| P1/P2 | Chroma and FAISS retrieval | Read-only candidate ranker over MemoryFabric | Do not activate by assumption | Independent labelled temporal holdout with measured recall/latency/safety win |
| P2 | DSPy and Agent0 evaluation/self-improvement | Isolated research evaluator and gated promotion | No production self-modifying loop added | Reproducible fixed baseline, independent holdout, rollbackable promotion |
| P3 | Hyperon/MeTTa symbolic reasoning | Sandboxed reasoning adapter | Research-only | Typed evidence premise chain; no direct writes or action authority |
| P1/P2 | AutoGPT | Existing project runner / ActionGateway only | Selective reference; license-sensitive portions not copied | Path-specific license review and a proven gap |
| P2 | AutoGen / Langroid / OWL / PocketFlow | Existing task/project execution interfaces | Reference or simplification candidates; no parallel orchestrators | Measurable reduction in complexity with equal-or-better restart semantics |
| P3 | Letta duplicate snapshots | Source inventory/provenance | Duplicate identity preserved in provenance, not treated as independent feature evidence | One canonical source identity, archive provenance retained |
| P3 | Superpowers | Contributor procedure | Methodology only | Root-cause-focused code delta, reviewable diff, rollback safety |

## Canonical integration wiring changed in this pass

```text
AutonomousResourceToolLifeController.plan
        │ stable (tick, toolId, planner) intention
        ▼
CognitiveEventFabric deterministic plan node
        │ decisionId
        ▼
OrganismCore.executeTool
        ▼
ActionGateway durable keyed receipt
        │ execute once / fail closed on ambiguity
        ▼
OrganismCore finalizer
        ├── OutcomeCognitionFabric exact execution identity
        ├── canonical ExternalObserver integration (only if independently verified)
        └── CognitiveEventFabric action → outcome → evidence trace
                   │ persisted with receipt finalization
                   ▼
AutonomousResourceToolLifeController accounting (dedupe by executionId)
```

Any imported mechanism must attach to one of these owners or be rejected. No source is accepted merely because it has a similar subsystem name.
