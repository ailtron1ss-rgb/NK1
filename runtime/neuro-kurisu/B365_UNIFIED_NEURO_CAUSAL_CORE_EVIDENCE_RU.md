# B365 — Unified Neural Core Evidence

## Цель
Проверить, что новый 96-neuron recurrent core — рабочая каузальная нейронная система, а не telemetry facade.

## Архитектура
B365 имеет четыре популяции по 24 нейрона: interoception, exteroception, association, selfAction. Ключевые state variables: membrane, threshold, adaptation, spikes, neuromodulation, eligibility. Graph: 1,188 исходных sparse synapses; structural plasticity расширяет граф при novelty и достаточной neuromodulation.

## Learning rule
Outcome update использует advantage от разницы reward и собственного reward prediction, prediction error, verified/external evidence и neuromodulation. Eligibility traces связывают предшествующую активность с более поздним outcome.

## Core causal test
6 независимых seed: 144 cycles outcome training → unseen probe → 50% structural lesion → matched probe → restore.
Критерий: lesion L1 > 0.006 и > 1.5× matched SHAM, restart drift < 1e-10. PASS.

## History transfer
6 seed: одинаковое initial state → одна ветка получает положительную outcome history для `rest`, другая — отрицательную. Unseen probe показывает минимум L1 ≈ 0.229788. Это означает, что собственная история outcome меняет будущую policy distribution.

## Interoception + structural plasticity
6 seed: 96-cycle development + nominal/stressed unseen frames. Minimum policy L1 ≈ 0.009961. Structural graph updates = 40 на seed, active synapses 1,228 после growth. PASS.

## Full Core integration
5 seed `OrganismCore` в `spineOnly`: 72 training cycles → matched saved state → B365 synaptic lesion → unseen observation. Minimum candidate-score L1 ≈ 0.007009. 1/5 seed changed final selected action. PASS означает causal influence on real Core score field, not guaranteed policy ownership.

## Important limitation
B365 currently enters the final score as one governed neural contribution; constitutional arbitration and B299/world model remain higher-level owners. This is intentional until stronger unseen-context causal dominance is demonstrated.
