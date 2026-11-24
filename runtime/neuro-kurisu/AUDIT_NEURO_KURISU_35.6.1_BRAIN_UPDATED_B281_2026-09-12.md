# NEURO KURISU 35.6.1 — B281 Brain Audit
Дата: 2026-09-12

## Executive verdict
B281 is a substantive neural architectural improvement over B280. B280 established explicit multi-area recurrent E/I circuitry. B281 adds delayed predictive inter-area messaging, edge-specific encoder/predictor/context weights, next-step targets, delayed causal credit, and independent hidden temporal-transfer evaluation.

It should be classified as a **predictive inter-area neural substrate**, not as a consciousness implementation and not as a biophysical brain simulation.

## 1. Re-verification of B280
B280 remains functional after B281 integration. Its four-area E/I network, local plasticity, cross-area coherence, contextual gating and lesion battery still pass.

## 2. B281 architecture
- 4 areas;
- 12 directed inter-area edges;
- 8-dimensional messages per edge;
- encoder weights;
- predictor weights;
- contextual weights from self/world/goal latent;
- delayed pending predictions;
- next-step target comparison;
- edge-specific prediction errors;
- delayed credit matrix;
- activity-dependent plasticity;
- synaptic availability;
- cross-area lesion;
- action arbitration bias;
- persistence/migration.

## 3. Critical correction during development
The first B281 implementation accidentally compared each prediction with a target from the same time step. That was rejected because it did not prove predictive temporal coding.

The final implementation stores prediction(t) and evaluates it against observation(t+1), which creates a genuine delayed target. The test suite explicitly trains on temporal mappings and evaluates on a hidden temporal transfer task.

## 4. Evidence
### Standalone
- 220 steps;
- 84,288 message updates;
- delayed credit 0.99975;
- message coherence 0.66365;
- mean edge prediction 0.99972;
- lesion drop 0.02822.

### Hidden transfer
The hidden task changes the temporal mapping between source and destination assemblies based on a hidden context. The model must use the contextual pathway; a simple copy-style baseline performs worse.

- hidden error 0.20876;
- baseline error 0.46875;
- gain +0.25999.

This is the strongest new B281 behavioural evidence, but it is still a controlled digital benchmark.

### Core
- 8 live predictive cycles;
- 100 delayed/explicit learning updates;
- 1,536 message updates;
- delayed credit 0.64177;
- message coherence 0.46154;
- restart/migration PASS.

## 5. Regression
B279 neural attractor, hidden recall, lifecycle and migration tests PASS.
B280 neural, Core and migration tests PASS.
B281 neural, hidden-transfer, Core and migration tests PASS.

## 6. Static status
- typecheck: PASS;
- architecture: PASS;
- integrity: PASS;
- forensics: PASS;
- hygiene: PASS;
- contract: PASS;
- lockfile: PASS;
- release source: PASS;
- doctor: PASS.

The repository-wide executable syntax gate was attempted in the current environment and exceeded the available execution window. This is recorded as BLOCKED_BY_ENV_TIMEOUT, not PASS.

## 7. Scores
| Area | Score |
|---|---:|
| Integrated brain engineering | 98 |
| Neural substrate depth | 91 |
| Multi-area circuit | 84 |
| Predictive inter-area messaging | 81 |
| Delayed causal credit | 76 |
| Cross-area lesion evidence | 80 |
| Hidden temporal generalization | 74 |
| Recurrent memory | 85 |
| Self integration | 77 |
| Personality integration | 72 |
| Autonomy | 73 |
| Persistence/migration | 98 |
| Release quality | 98 |
| Scientific maturity | 85 |

## 8. Remaining bottlenecks
1. Area count and message dimensionality are intentionally tiny.
2. Prediction target is still a compact spike vector, not high-dimensional learned latent content.
3. Cross-area credit is not yet full multi-step credit assignment through several areas.
4. Inhibitory dynamics remain simplified.
5. Dendrites remain abstract contextual gates.
6. Self/personality still partly live outside the neural substrate.
7. No evidence establishes phenomenal consciousness.

## 9. Next step recommendation
The next strongest step is not more areas. It is **B282 multi-step inter-area predictive workspace**: maintain a shared latent workspace where multiple areas can jointly predict future global state, compete for access, receive delayed credit, and bind the result to self/episodic memory. The key tests should be global-state prediction, workspace ablation, cross-area delayed credit and behavioural transfer with symbolic ledgers masked.
