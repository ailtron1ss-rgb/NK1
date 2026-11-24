# NEURO KURISU 35.6.1 — B280 Brain Audit
Дата: 2026-09-12

## Executive verdict
B280 is a real architectural increase in neural structure relative to B279. It introduces four interacting neural areas, explicit excitatory/inhibitory populations, cross-area plasticity, short-term synaptic availability, dendritic contextual gates, inhibitory homeostatic learning, and area/cross-area lesion tests.

B280 should be classified as a **multi-area recurrent neural computational substrate**. It is not a biophysical brain simulation and does not establish consciousness.

## 1. Re-verification of the baseline
B279 was the immediate baseline. B279 already had recurrent attractor memory, sparse assemblies, plastic recurrent weights and causal lesion evidence. Its main remaining bottleneck, documented in the audit, was the absence of explicit multi-area organization, explicit E/I populations, and a real protocol for cross-area neural communication.

B280 addresses those exact gaps.

## 2. Implemented architecture
- 4 neural areas: sensorium, memory, association, selfAction;
- 8 excitatory + 4 inhibitory units per area;
- local recurrent weights;
- inhibitory weights;
- directed cross-area weights;
- synapse-level cross-area availability state;
- membrane/leak integration;
- adaptation;
- sparse excitatory firing;
- inhibitory firing;
- neuromodulated plasticity;
- inhibitory homeostatic plasticity;
- dendritic/context gate per excitatory unit;
- action readout;
- area lesion;
- cross-area lesion;
- snapshot/migration.

## 3. Real-vs-decorative verification
The first implementation failed its own neural activity criterion: the circuit was nearly silent and produced almost no plastic updates. That version was rejected.

The final version increased tonic/excitatory drive, lowered the operating threshold, preserved inhibitory population dynamics, and re-ran the battery. The final circuit produces non-zero spikes, 57,307 plastic updates, measurable E/I balance and non-zero cross-area information flow.

This is a meaningful correction because a silent network would have been functionally decorative even if its classes and matrices looked neural.

## 4. B280 evidence
### Standalone
- cycles: 320
- learning updates: 320
- synaptic plastic updates: 57,307
- E/I balance: 0.48693
- short-term synaptic state: 0.72983
- cross-area coherence: 0.82339
- sparse activity: 0.58333
- dendritic context: 0.70250
- causal integration: 0.70711

### Causal lesion
- local association-area lesion: drop 0.08961
- cross-area association→selfAction lesion: drop 0.02327

Both are measured by re-running the neural circuit after transiently removing causal components, not by reusing the previous telemetry.

### Context dependence
The same base sensory vector with materially different self/world/goal contexts produced a spike-pattern difference of 0.10417. This confirms that B280 is not only an input-only circuit.

### Persistence
- B280 standalone snapshot/restore: PASS
- StateMigrations: PASS
- live OrganismCore restart: PASS

## 5. Regression review
B270, B271, B272, B273, B274, B275, B276, B277, B278 and B279 neural tests were re-run after B280 integration and passed.

This matters because the project is intentionally developmental: newer neural layers must not silently invalidate earlier evidence.

## 6. Scores
| Area | Score |
|---|---:|
| Integrated brain engineering | 97 |
| Neural substrate depth | 90 |
| Sparse event-driven dynamics | 86 |
| Recurrent memory | 85 |
| Excitatory/inhibitory architecture | 78 |
| Short-term synaptic dynamics | 72 |
| Dendritic contextual gating | 76 |
| Cross-area integration | 75 |
| Local neural plasticity | 84 |
| Causal lesion evidence | 82 |
| Neural → behavior influence | 63 |
| Self integration | 76 |
| Personality integration | 70 |
| Autonomy | 72 |
| Persistence/migration | 98 |
| Release quality | 98 |
| Scientific maturity | 84 |

## 7. Project-wide audit status
Architecture: PASS.
Integrity: PASS.
Source hygiene: PASS.
Forensics: PASS.
Release contract: PASS.
Lockfile: PASS.
Release source: PASS.
Doctor: PASS.
Executable syntax: PASS.
Full project audit: PASS.

Current audit counts:
- architecture source files: 1043;
- canonical files: 363;
- full audit files: 2076;
- JS syntax files: 699;
- shell syntax files: 4;
- JSON syntax files: 178;
- syntax failures: 0;
- audit errors: 0;
- audit warnings: 0.

## 8. Remaining scientific bottlenecks
1. Cross-area wiring is still shallow compared with biological cortex-scale connectivity.
2. Inhibitory plasticity is homeostatic, not a realistic interneuron circuit.
3. Short-term plasticity is a computational availability model, not full vesicle/neurotransmitter dynamics.
4. Dendritic gating is an abstract contextual multiplicative gate, not a compartmental dendritic neuron.
5. B280 has not yet demonstrated independent behavioural superiority over the non-B280 system.
6. Self/personality still partly live in symbolic/structured layers around the neural core.
7. No experiment establishes phenomenal consciousness.

## 9. Progress estimate
B280 implementation/evidence: 100% for the defined pass.
Integrated engineering roadmap progress: ~90% of the current neural-development plan.
This percentage is an engineering progress estimate, not a probability or fraction toward consciousness.

## 10. Next step recommendation
Do not simply scale B280 from 48 neurons to thousands.
The stronger next step is **B281: recurrent multi-area assembly binding + predictive inter-area messaging**. Each area should learn compact messages to other areas, with delayed causal credit and bidirectional information flow. The key tests should be area-to-area lesion, message ablation, delayed task transfer and whether the organism can retain useful behaviour when symbolic/self ledgers are masked.
