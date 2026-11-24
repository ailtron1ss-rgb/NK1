# Полный forensic audit B2501 — 17.09.2026

## 1. Главный вывод

Проект уже содержит крупный гибридный artificial-organism runtime. Главный найденный потолок — не отсутствие cognitive функций, а слабая относительная причинность neural substrate: многие верхние подсистемы имеют собственные action-bias/readout каналы. B2501 предназначен для усиления именно neural branch.

## 2. Что B2501 делает

`B2501DeepNeuralCausalBranch` принимает:

- B365 latent/confidence/prediction error;
- goal/self/body/world context;
- uncertainty/novelty/motivation/energy/cognitive load;

и формирует:

- neural action utilities;
- bounded action bias;
- neural action gate;
- confidence/precision;
- adaptive compute depth;
- causal load;
- compositional retrieval gain.

Внутри работают delayed recurrent synapses, spike-like activity, timing traces, eligibility, neuromodulated learning, action readout, primitive replay/composition и world/body/self prediction state.

## 3. Causal chain

```text
perception/body/world/self
        ↓
B365 neural state
        ↓
B2501 delayed recurrent dynamics
        ↓
precision + neural action utilities
        ↓
action gate / bounded bias
        ↓
existing executive policy
        ↓
real outcome
        ↓
prediction error + verification
        ↓
three-factor timing plasticity
        ↓
delays + synapses + primitives
        ↓
future decisions
```

## 4. Почему это лучше прежнего

Раньше neural path мог существовать, но policy arbitration всё ещё имел много обходных каналов. B2501 не удаляет старую cognition, потому что это было бы рискованным большим регрессом; вместо этого он вводит измеримый neural gate и новый deep causal branch. Следующий этап должен постепенно повышать долю neural bottleneck, используя matched ablation.

## 5. Научные направления, которые были использованы

### Temporal plasticity

Текущий B2501 использует упрощённый timing-dependent eligibility, а не утверждает биологически точную STDP. Следующий эксперимент: отдельные pre/post timing kernels, short-term plasticity и отдельные excitatory/inhibitory populations.

### Replay and consolidation

Исследования 2025 года продолжают поддерживать важность replay, временной консолидации и постепенной реорганизации памяти. Для проекта это означает, что replay должен стать не только повторным обновлением readout, но механизмом формирования новых compositional state spaces.

### Compositional memory

Исследование 2025 года по hippocampal state-space composition показывает полезную для проекта идею: новые ситуации могут строиться из уже освоенных building blocks, а replay может укреплять такие композиции.

### Embodied world models

Работы 2025–2026 годов подчёркивают, что полезность world model нужно оценивать не по визуальной правдоподобности, а по тому, улучшает ли она closed-loop behaviour, intervention prediction, recovery и verification.

## 6. Следующие экспериментальные ветви

### B2502 — temporal synaptic laboratory

Сравнить:

- fixed eligibility;
- exponential eligibility;
- asymmetric STDP;
- neuromodulated STDP;
- short-term facilitation/depression.

### B2503 — excitatory/inhibitory ecology

Разделить populations и ввести inhibitory balance, sparsity target и homeostatic firing-rate controller.

### B2504 — three-world prediction

Одновременный prediction:

`world'`, `body'`, `self'`.

### B2505 — compositional replay

Примитивы должны не только храниться, а объединяться в новые latent trajectories с holdout evaluation.

### B2506 — neural bottleneck escalation

Постепенно уменьшать bypass coefficient верхних action channels и проверять, улучшается ли causal lesion без потери robustness.

### B2507 — sleep/offline laboratory

Separate awake learning, brief-rest replay and deep consolidation.

### B2508 — phone adaptive scheduler

Выбирать neural depth/precision/replay cadence по thermal, battery, uncertainty и prediction error.

## 7. Критерий настоящего прогресса

Новый релиз нельзя считать улучшением только по числу файлов. Требуются одновременно:

1. causal lesion effect ↑;
2. holdout generalization ↑;
3. prediction error ↓;
4. verified outcome learning ↑;
5. restart drift ≈ 0;
6. mobile p95 не выходит за заданный budget;
7. identity/personality continuity не деградирует;
8. не появляется новый policy bypass без явной причины.

## 8. Честный статус

B2501 — существенный функциональный апгрейд neural branch. Он не доказывает сознание, не доказывает human-level cognition и не делает систему биологическим мозгом. Он создаёт более сильную экспериментальную основу, на которой эти гипотезы можно проверять причинно.
