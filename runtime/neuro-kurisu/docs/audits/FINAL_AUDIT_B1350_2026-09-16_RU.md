# FINAL AUDIT B1350 — 16.09.2026

## 1. Current release

- Application: **35.6.36**
- Organism Core: **75.0.0-b1101-b1350-self-development**
- State schema: **163**
- Release: **B1350**
- Phase: **Stage-38 / Self-Development + Memory + World Generalization**

## 2. Goal alignment

The project target remains a persistent artificial organism/personality Kurisu. B1101–B1350 therefore does not add a standalone chatbot layer. It strengthens the closed developmental loop:

`context → hidden-task inference → selective memory → abstraction/schema → world prediction → adaptive lookahead → counterfactual action credit → decision → outcome → memory operation → policy update → 512D neural plasticity → curriculum pressure`

## 3. Main engineering additions

### B1101–B1350 Self Development Core

1. Learned task prototypes and hidden-task separation.
2. Episodic memory manager with ADD / UPDATE / DELETE / NOOP operations.
3. Selective retrieval with task similarity, utility, transferability and trust.
4. Two-step schema abstraction (episodic → reusable schema → high-stability schema).
5. Action-conditioned lightweight world predictor.
6. Adaptive lookahead with depth 2–4 based on uncertainty/complexity budget.
7. Counterfactual alternative-action credit using leave-one-out empirical baselines.
8. Reversal recovery exploration: after repeated causal error, under-sampled alternatives receive bounded exploration pressure.
9. Verifier readout affects both confidence and action bias.
10. Curriculum pressure affects exploration/verification decisions.
11. 512-dimensional distributed neural plasticity is now causally read out into action selection rather than diagnostics only.
12. Persistence, restart, migration and lesion API.
13. Full and standard `OrganismCore` decision/outcome wiring.

## 4. Executable evidence

### Hidden-task generalization

Standalone 2400-cycle developmental run:

- holdout accuracy: **1.00**
- tasks discovered: **2**
- memories: **45**
- memory recalls: **2801**
- recalled rows: **6006**
- world updates: **2400**
- counterfactual calls: **2801**
- lookahead calls: **135**
- schema consolidations: **5179**
- neural updates: **5201**
- restart equality: **PASS**

### Reversal recovery

- pre-reversal accuracy: **1.00**
- post-reversal recovery accuracy: **0.8091**
- recovery improvement above random baseline: **+30.9 percentage points**
- reversal recovery events recorded: **1362**

This is a project-local synthetic benchmark. It is evidence of a real behavioral improvement in the tested regime, not proof of general intelligence.

### Performance

1200 cycles:

- average: **0.240 ms**
- p95: **0.548 ms**
- p99: **2.242 ms**
- max: **7.229 ms**

### Organism integration

- 14 organism cycles
- 9 outcome updates
- 14 memory recalls
- 28 retrieved memory rows
- 9 world-model updates
- 14 lookahead calls
- 14 counterfactual calls
- 98 verifier evaluations
- 23 neural updates
- restart persistence: **PASS**

## 5. Lesion evidence

Observed causal action-bias deltas in the standalone cognitive test:

- task-inference: ~0.00
- memory-manager: 0.0045
- adaptive-lookahead: 0.0345
- counterfactual: 0.0071
- world-model: 0.0345
- schema-abstraction: 0.0076
- curriculum: 0.0041
- neural-plasticity: 0.00009
- policy: 0.0118
- verifier: ~0.00

Interpretation: the adaptive lookahead/world-model path is currently the strongest direct readout. Neural plasticity is real and persistent but remains a weak immediate action-bias source; this is an explicit next research target, not hidden.

## 6. Architecture / release gates

Typecheck, ownership, architecture, hygiene, syntax, forensics, integrity, contract, release-source, manifest and archive checks are run as separate release gates.

A combined long-running audit command is not treated as a PASS unless it finishes; timeouts are reported separately.

## 7. Claims boundary

B1350 does **not** prove consciousness, subjective experience, biological equivalence, or human-level cognition. The supported claim is narrower: the runtime now contains a more strongly coupled developmental learning fabric with hidden-task generalization, selective memory operations, adaptive model-based foresight, counterfactual credit, reversal recovery and distributed neural plasticity.

## 8. Next bottlenecks

1. Strengthen causal influence of the 512D neural substrate.
2. Make memory abstraction transfer across genuinely novel task factors rather than only nearby contexts.
3. Train the world predictor on nonstationary transitions and test calibration under counterfactual distribution shift.
4. Add long-horizon self-generated curriculum with explicit skill prerequisites.
5. Run 5k/10k/25k developmental campaigns and memory forgetting/rehabilitation experiments.
6. Qualify the exact Android/Termux target device.
7. Bring React/Vite observability into parity with the runtime evidence surface.
