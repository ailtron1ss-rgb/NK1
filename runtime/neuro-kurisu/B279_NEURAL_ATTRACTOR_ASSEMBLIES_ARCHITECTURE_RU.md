# B279 — Neural Attractor Assemblies
## Архитектура и методологическая проверка

Дата: 2026-09-12
Версия проекта: 35.6.1

## 1. Задача

B279 переводит нейронную ветвь от «обучаемого primitive/оператора» к устойчивой внутренней динамике памяти. Цель — чтобы опыт частично кодировался в рекуррентных связях и мог восстанавливаться по неполному/зашумлённому сигналу без внешней sequence/pattern таблицы.

## 2. Что реально реализовано

- 24 упрощённых recurrent units;
- sparse k-winner-take-most assembly (4 активных узла из 24 по умолчанию);
- recurrent weights 24×24;
- input weights 24×16;
- action readout weights 7×24;
- recurrent settling over several internal iterations;
- adaptation/homeostatic thresholds;
- Hebbian-like recurrent consolidation;
- reward/error third-factor plasticity;
- Oja-like input-synapse plasticity;
- synaptic scaling/homeostatic competition;
- replay of recent assemblies;
- cue-based noisy recall;
- lesion of recurrent neurons/connections;
- causal action-bias readout;
- persistence and migration.

## 3. Что считается настоящим нейронным элементом, а что нет

B279 является алгоритмическим нейронно-подобным attractor substrate. Он действительно содержит изменяемые synaptic weights, recurrent dynamics, sparse competition, activity-dependent plasticity, homeostatic pressure и causal lesion.

Однако B279 НЕ является биофизическим симулятором коры. В нём нет Hodgkin–Huxley/AdEx-мембран, ионных каналов, дендритных компартментов или биофизически реалистичных синаптических токов. Event-driven spike substrate находится в B269. B279 — более медленный recurrent attractor layer над ним.

## 4. Главное доказательство

На скрытых cue после обучения:

- mean train recall ≈ 0.9824;
- mean hidden recall ≈ 0.8865;
- hidden baseline = 0.5000;
- hidden recall gain ≈ +0.3865.

При удалении recurrent weights:

- ablated recall ≈ 0.6104;
- recurrent causal contribution ≈ +0.3896.

Это существенно сильнее, чем простая copy-table: recall сохраняет память при изменении cue, а обнуление recurrence реально ухудшает результат.

## 5. Почему это важно для единого организма

B279 получает:

B278 primitive latent → self latent + world latent + goal context → recurrent assembly.

На feedback:

reward/prediction error → recurrent plasticity + input plasticity → consolidation/replay.

Action selection получает bias от последней assembly. Поэтому слой может влиять на поведение, хотя независимая внешняя поведенческая superiority пока не доказана.

## 6. Ограничения

1. 24 units — маленькая сеть.
2. Attractor memory пока в основном associative reconstruction.
3. B279 action readout ещё не доказал устойчивого внешнего behavioural advantage на независимой среде.
4. Personality evidence пока проходит через окружающий organism loop, а не напрямую из нейронов.
5. Self/world latent остаются компактными инженерными представлениями.
6. Биофизической правдоподобности в смысле настоящих нейронных мембран здесь нет.

## 7. Следующий правильный уровень

Следующий крупный переход — в сторону разделения excitation/inhibition, более реалистичного short-term synaptic state, dendritic contextual gating и устойчивых multi-area assemblies. После этого должна быть проведена causal test matrix: lesion → recovery → transfer → delayed recall → behavioural effect.
