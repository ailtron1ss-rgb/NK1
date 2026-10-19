# NEURO-KURISU — PROJECT STATE INDEX v34.47.0

Дата: 2026-09-06
Статус: research-release

## 1. Каноническая архитектура

Канонический runtime находится в `src/organism/`. Точка запуска сервера: `src/server/server.mjs`. Основной субъект: `OrganismCore`.

Домены канонического организма:
- `core` — цикл организма, планы, temporal resolution, decision/result surfaces.
- `cognition` — внимание, self-model, reasoning, perception, consciousness-research mechanisms.
- `memory` — память и derived Experience Continuum.
- `world` — world models, grounding, prediction, reality reconciliation.
- `body` — embodiment, native perception, multimodal inputs, device state.
- `learning` — continual learning, adaptation, development.
- `persistence` — state migration, projection, replay, integrity.
- `system` — contracts, governance, evidence, observability.
- `language` — language/model integration; language model is not the owner of organism state.

## 2. Источники истины

1. `MemoryOS2` — canonical memory truth.
2. `OrganismCore.persisted.state` — canonical live organism state.
3. `ReleaseContract`/`VERSION.json` — release/schema truth.
4. External observers/evidence systems — external truth channels, not self-certification.

Derived layers MUST NOT become competing sources of truth.

## 3. Experience Continuum v2

`ExperienceContinuumFabric` is a bounded derived layer over MemoryOS2.

Capabilities:
- logical hot/warm/cold tiers;
- bounded experience graph;
- semantic/temporal/causal/identity/goal edges;
- cold consolidation clusters;
- identity gravity signal;
- bounded identity-gravity history;
- cognitive-integrity flags;
- internal indexes for predictable lookup cost.

Identity Gravity is a pressure/evidence signal. It does not directly rewrite personality or identity.

## 4. Adaptive temporal resolution

`TemporalResolutionGovernor` provides two runtime resolutions:
- `pulse` — full cognitive cycle;
- `micro` — temporal/metabolic continuity update without a fake cognitive decision.

Mobile default cadence is eight cycles between pulses, dynamically tightened by external signal, pressure, uncertainty, prediction error, energy and thermal conditions.

Micro-cycles do not create persistent decision traces. External events force a pulse.

## 5. Embodiment

Canonical Live2D assets live in `public/live2d/Kurisu/` and are independently checked through `/api/embodiment/status`.

The canonical Live2D runtime now supports adaptive asset quality: quality uses the original 4096 texture, mobile uses a separately verified 2048 texture. User touch on the viewer triggers the real TapHead/TapBody motion groups. The legacy Live2D implementation is preserved only as reference; canonical UI/runtime owns actual execution.

## 6. Legacy archive policy

The original large archive is treated as a source of historical assets, evidence, ideas and reference implementations.

Classification:
- `integrated` — runtime asset or mechanism actually integrated and tested.
- `adapted` — useful concept or implementation pattern rewritten for the current architecture.
- `reference` — preserved for study, not runtime dependency.
- `excluded-runtime` — duplicate/obsolete/conflicting implementation kept out of canonical runtime.

No historical parallel organism core may become a second runtime owner.

## 7. Evidence levels

Use these levels consistently:
`PROVEN`, `IMPLEMENTED`, `FUNCTIONAL INDICATOR`, `OBSERVED`, `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED`, `FAILED`.

Architectural functionality is not evidence of phenomenal consciousness.

## 8. Current verified state

- Typecheck: PASS.
- Project-state audit: PASS.
- Component-conflict audit: PASS.
- Temporal-resolution test: PASS.
- Experience Continuum tests: PASS (see BIG PASS 74 suite).
- 1000-cycle mobile horizon: PASS.
- 2000-cycle mobile horizon: PASS.
- 5000-cycle long-horizon test with repeated external pulses: UNRESOLVED / TIMEOUT on current qualification window.

## 9. Current major known limits

1. 5000-cycle run with periodic full cognitive pulses still exhibits a long-horizon performance wall.
2. Physical qualification on the actual Android handset has not yet replaced host-side qualification.
3. Semantic sensorium remains partly engineered rather than learned.
4. Social mind and self-generated motives remain substantially incomplete.
5. Consciousness evidence remains research-level and does not justify a claim of subjective experience.

## 10. Next high-value integration targets

- isolate 3500+ pulse cost and long-history growth;
- qualify adaptive Live2D asset profile on the real Android handset;
- Experience Graph index/compaction profiling;
- autobiographical identity-lineage integration without duplicate truth stores;
- unified sensorium;
- developmental self and social mind;
- native Android organism host;
- causal/perturbational consciousness research harness.

## 11. Reproducibility

Before every major pass:
1. use the newest archive as baseline;
2. compare against the largest historical archive available;
3. run legacy classification and conflict audit;
4. search for existing implementations before adding components;
5. update version/schema/manifests;
6. run targeted tests plus release checks;
7. record unresolved results explicitly.
