# WorkPass287 — cognitive architecture call-path triage (2026-10-22)

## Scope and honest status

This pass adds a repeatable source-contract check and records an initial call-path triage. A source file's existence, an import, or a component name in the architecture map does **not** prove that it executes in the active production lifecycle. The current GitHub connector exposes source files and search, but does not provide an executed runtime trace for this branch. Accordingly, no subsystem is labelled ACTIVE solely from static presence.

## Initial classification

| Domain | Static evidence observed | Status for runtime activation |
|---|---|---|
| Sensorium/perception | Map references multimodal perception, perception router, perception engine; physical owner includes EmbodimentSubsystemRuntime | UNVERIFIED |
| Attention/global workspace | Map references CognitiveNetworkBus and GlobalWorkspaceSubstrateV2 | UNVERIFIED |
| Homeostasis/affect | Map references IntrinsicMotivationEngine, EmotionAppraisalEngine and embodied state | UNVERIFIED |
| Self-model/continuity | Map references IdentityContinuity, SelfAuthorship, continuity guards and persistence kernel | UNVERIFIED |
| Goals/values | Map references endogenous goal genesis/lifecycle and canonical action arbiter | UNVERIFIED |
| World-model | WorldSubsystemRuntime plus contextual model, active inference and grounded state | UNVERIFIED |
| Memory | MemoryOS2 is declared as the only writable canonical memory authority; graph/source-monitor/autobiographical systems are listed as supporting mechanisms | UNVERIFIED |
| Executive planning | CognitiveExecutionPlanner, CanonicalActionPolicyArbiter, ActionGateway and EvidenceFirewall are listed as the intended boundary | UNVERIFIED |
| Embodiment/action | EmbodiedActionExecutor, sensorimotor loop and Android/voice adapters are listed | UNVERIFIED |
| Outcome learning | ExternalObserverFabric, OutcomeVerificationService, B294 causal spine and canonical temporal-credit authority are listed | UNVERIFIED |
| Social model | Relationship manager, social initiative engine and B288 self/other model are listed | UNVERIFIED |
| Metacognition/governance | MetaCognitiveMonitor, CognitiveImmuneSystem, IntegritySentinel and RecoveryWatchdog are listed | UNVERIFIED |
| Lifecycle | OrganismCore and OperationalMicroCycleRuntime are listed as full/reduced-resolution lifecycle owners | UNVERIFIED |
| Research | EvidenceResearchSubsystemRuntime, research bridge, claim assessment and sandboxed rewrite engine are listed | UNVERIFIED |

The classification deliberately errs on the side of evidence. The current source references justify that these mechanisms are represented in the source architecture; they do not justify a stronger runtime status without tracing callers from the active ingress/lifecycle.

## Concrete issues and next implementation targets

1. **Architecture dependency cycles are expected in a recurrent organism.** Do not treat the full cognitive graph as a DAG or break feedback links merely to satisfy a topological sort. Separate startup/lifecycle dependencies from runtime feedback edges.
2. **Source-path integrity is now an executable contract.** The new test checks unique IDs/references through `validateCognitiveArchitecture()`, exactly one declared owner for canonical writable memory/final action decision/side-effect execution, valid flow endpoints, and existence of all mapped source paths.
3. **Static source checks are not activation checks.** The next stronger step is to trace the live caller chain in `OrganismCore` from full-cycle entry to coordinator, planner, final arbiter, gateway, outcome verification and next-cycle state update. Then separately trace the reduced-resolution micro-cycle and ensure it cannot award action success or learning credit without verified outcome evidence.
4. **Avoid duplicate systems.** The intended authorities remain: OrganismCore for lifecycle/persisted organism state, MemoryOS2 for writable canonical memory, CanonicalActionPolicyArbiter for final policy decision, ActionGateway for side effects, independent outcome observers/verifier for reality evidence, and evidence-gated promotion for learned candidates.
5. **Do not promote a learning candidate on self-reported success.** Hermes/P23 work stays downstream of attributable experience and independent evaluation/holdout; generator and promotion authority remain separate.

## Validation command

From `runtime/neuro-kurisu` run:

```sh
node --experimental-strip-types tests/workpass287-cognitive-architecture-contract.mjs
```

This command was added but not executed in this GitHub-only pass. Its result is therefore pending, not PASS. No dependency was added.
