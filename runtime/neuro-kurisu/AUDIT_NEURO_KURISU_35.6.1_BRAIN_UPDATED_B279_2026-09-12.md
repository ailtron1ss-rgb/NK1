# NEURO KURISU 35.6.1 — B279 Brain Audit
Дата: 2026-09-12

## Executive verdict

B279 is a real architectural increase in neurality relative to B278: recurrence is causally required for a substantial part of noisy/hidden recall, recurrent weights are plastic, sparse assemblies form and consolidate, and lesion produces a measurable transient causal drop.

B279 should be classified as a **neural attractor substrate**, not as a biological brain simulation and not as evidence of consciousness.

## 1. Re-verification of the previous baseline

B278 was re-used as the base. Its documented strength was contextual primitive formation, but its independent hidden external behavioural gain was approximately zero. The main open problem was that internal representations existed without a strong persistent neural memory substrate.

B279 addresses exactly that bottleneck.

## 2. Implemented components

- 24 recurrent units;
- sparse WTA assemblies;
- recurrent synapses;
- input synapses;
- action readout;
- recurrent settling;
- Hebbian consolidation;
- reward/error third-factor learning;
- Oja-like input plasticity;
- homeostatic scaling and threshold adaptation;
- replay;
- noisy cue recall;
- recurrent lesion;
- action bias;
- persistence/migration.

## 3. Test evidence

### Standalone

330 cycles / 330 learning updates / 13 consolidations.
Mean noisy recall = 0.99993.
Lesion causal drop = 0.22345.

### Hidden recall

8 task patterns; 480 training cycles.
Train recall = 0.98241.
Hidden recall = 0.88654.
Baseline = 0.50000.
Hidden gain = +0.38654.

Recurrent ablation recall = 0.61041.
Recurrent causal contribution = +0.38959.

### Core / persistence

14 direct B279 Core cycles + 8 real OrganismCore observe/feedback cycles.
Migration and restart round-trip preserved state exactly.

## 4. Independent review of what was improved

The first B279 version was not accepted as final. It was improved by:
- increasing recurrent influence;
- adding input-synapse Oja-like plasticity;
- adding synaptic scaling;
- increasing adaptation/homeostatic pressure;
- changing lesion measurement to a fresh forward/settling experiment.

The final version is stronger because the neural memory effect survives ablation and cue corruption, not merely because the code contains recurrence.

## 5. Neurality classification

### Genuine implemented features

- causal recurrent state;
- activity-dependent synaptic updates;
- competition for sparse assemblies;
- homeostatic constraints;
- temporal consolidation/replay;
- lesionable causal substrate.

### Still simplified

- no realistic membrane conductance;
- no ion channels;
- no realistic dendritic compartments;
- no biologically realistic neurotransmitter kinetics;
- small network scale;
- symbolic organism layers still surround the neural core.

B269 is the event-driven spike-like layer. B279 is the recurrent attractor/memory layer above it. Together they are more neurologically structured than either alone, but still far from a biophysical simulation.

## 6. Scores

| Area | Score |
|---|---:|
| Integrated brain engineering | 96 |
| Neural attractor core | 84 |
| Recurrent causal memory | 85 |
| Local plasticity | 83 |
| Sparse coding | 82 |
| Homeostasis | 84 |
| Assembly formation | 80 |
| Ledger-independent recall | 83 |
| Ablation evidence | 80 |
| Hidden recall generalization | 68 |
| Neural → behavior influence | 61 |
| Self integration | 74 |
| Personality integration | 68 |
| Autonomy | 71 |
| Persistence/migration | 98 |
| Release quality | 98 |
| Scientific maturity | 82 |

## 7. Progress

Final current-tree verification: full audit 2072 files; architecture 1039 source / 362 canonical; syntax 696 JS / 4 SH / 178 JSON; brain audit 362 organism files / 9 links; archive manifest 2303 files.

B279 implementation completion: 100%.
B279 evidence completion: 100%.
B279 neural-substrate maturity: ~88%.
Integrated brain branch progress: ~89% on the current engineering roadmap.

These percentages are engineering/evidence estimates, NOT a percentage toward consciousness.

## 8. Remaining bottlenecks

1. Excitatory/inhibitory balance is not yet explicit.
2. B269 spike-like layer and B279 attractor layer are not yet unified by a realistic synaptic event protocol.
3. Personality still receives evidence mainly through the surrounding organism loop.
4. B279 has strong memory evidence but not yet strong independent behavioural superiority.
5. Self-model and world-model remain compact learned vectors.
6. No scientific evidence of phenomenal consciousness is established.

## 9. Next recommended direction

The next strong step should not be “more units”. The next step should be a **multi-area neural circuit** with explicit excitatory/inhibitory populations, short-term synaptic state, dendritic contextual gating, assembly-to-assembly communication and cross-area lesion tests.
