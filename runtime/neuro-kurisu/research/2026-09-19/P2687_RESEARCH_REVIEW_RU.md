# P2687 — исследовательская записка: адаптивная многомасштабная память

Дата: 19.09.2026
Статус: инженерная интеграция + исследовательский эксперимент

## Что проверено по внешним исследованиям

### 1. Titans — surprise-driven long-term memory
Google Research / arXiv: «Titans: Learning to Memorize at Test Time» (2025).
Основная идея: долгосрочная память может получать отдельный механизм накопления истории, а неожиданность использоваться как сигнал для того, что стоит запоминать.

Для Neuro-Kurisu принято: `prediction impact / surprise` стал одним из входов adaptive replay score.
Не принято: переносить тяжёлую нейронную память Titans целиком — текущая цель требует работы на среднем телефоне.

### 2. Nested Learning / Continuum Memory System
Google Research, NeurIPS 2025.
Работа рассматривает обучение как несколько вложенных оптимизационных контуров с разными частотами обновления и вводит идею continuum memory.

Для Neuro-Kurisu принято: три bounded replay-lane — fast / medium / slow, с разными периодами и half-life.
Не принято: неограниченное self-modification параметров ядра. В текущем runtime это слишком рискованно для стабильности и восстановления.

### 3. Replay может ухудшать forgetting
Lifelong Learning Agents / PMLR, 2026: «Replay can provably increase forgetting».
Вывод, важный именно для нашего проекта: replay не является автоматически полезным; выбор replay-сэмплов и отношения между задачами могут ухудшать результат.

Для Neuro-Kurisu принято: interference guard, cooldown, redundancy penalty и отдельная independent validation. Replay не считается доказательством реальности и не повышает evidence-grade сам по себе.

### 4. FOREVER — forgetting-curve-inspired replay
ACL 2026: «FOREVER: Forgetting Curve-Inspired Memory Replay for Language Model Continual Learning».
Основная идея: частота replay должна учитывать предполагаемую кривую забывания, а не только фиксированное число шагов.

Для Neuro-Kurisu принято: decayNeed через экспоненциальную forgetting curve с lane-specific half-life.

### 5. Long-term + multiple short-term memory networks
Neural Networks, August 2026.
Работа рассматривает сочетание нескольких short-term memory сетей с long-term memory для баланса plasticity/stability.

Для Neuro-Kurisu принято: логическое разделение fast/medium/slow replay и разные режимы давления/энергии.

### 6. ALMA / meta-learning memory design
ICLR 2026 Workshop: «Learning to Continually Learn via Meta-Learning Agentic Memory Designs».
Идея: вместо полностью ручного устройства memory design можно адаптировать сам memory controller.

Для Neuro-Kurisu принято в безопасной форме: bounded online update весов replay policy по independently verified retention/transfer/interference feedback.

### 7. V-JEPA 2 / 2.1
Meta AI Research, V-JEPA 2 (2025), V-JEPA 2.1 (2026).
Сильное направление для будущего perception/world-model слоя: self-supervised world model с temporal consistency, prediction и planning.

Сейчас НЕ интегрировано в mobile runtime: текущая архитектура не является visual foundation model и разворачивание полноразмерного V-JEPA-подобного backbone на среднем телефоне было бы неоправданным bottleneck.
Вместо этого исследовательский принцип принят концептуально: prediction should operate in latent state space and be trained/checked on consequences, а не только на текстовых labels.


### 8. Дополнительные публикации 2026 года, добавленные после первого черновика

**Replay can provably increase forgetting** (PMLR / Lifelong Learning Agents, 2026) подчёркивает, что сам факт replay не гарантирует уменьшения forgetting: эффект зависит от выбора samples и их отношения к текущим задачам. Это усиливает наш принцип: selection должен быть adaptive и иметь interference/harm gate.
Источник: https://proceedings.mlr.press/v330/mahdaviyeh26a.html

**Provable Effects of Data Replay in Continual Learning: A Feature Learning Perspective** (AISTATS/PMLR 2026) связывает эффект replay с signal-to-noise и порядком задач, что поддерживает idea order-aware / signal-aware replay вместо равномерного просмотра памяти.
Источник: https://proceedings.mlr.press/v300/ding26b.html

**AgentOdyssey** (2026) предлагает evaluation setting для long-horizon test-time continual learning agents с отдельными метриками world knowledge, episodic memory, exploration, action diversity и model cost. Для Neuro-Kurisu это полезнее самого benchmark score: следующие holdouts должны измерять memory retention вместе с cost и long-horizon behavior.
Источник: https://arxiv.org/abs/2606.24893

**ALMA** (2026) показывает направление автоматического поиска memory designs. В проекте пока принят только bounded feedback контроллера; open-ended code self-modification намеренно не включается в runtime.
Источник: https://arxiv.org/abs/2602.07755

## Реально внедрено в P2687

1. Adaptive Replay Governor.
2. Multi-timescale fast/medium/slow scheduling.
3. Forgetting-curve decay pressure.
4. Surprise/novelty/identity/goal/transfer/stability scoring.
5. Replay cooldown.
6. Interference guard.
7. Diversity/redundancy selection.
8. Mobile budget cap.
9. Verified feedback → bounded policy-weight adaptation.
10. Persistent controller state + restart restoration.
11. Replay remains explicitly ungrounded evidence.
12. Research/evidence trail сохраняется в архиве.

## Что намеренно НЕ внедрено

- полноценная gradient-based test-time training на основном организме;
- тяжёлый Titans/HOPE/Transformer backbone;
- полный visual JEPA world model;
- unconstrained self-modifying weights;
- автоматическое удаление воспоминаний по одному replay score.

Причина: эти варианты сейчас либо слишком дороги для mobile execution, либо могут ухудшать stability/identity continuity без независимой верификации.

## Экспериментальные гипотезы P2687

| Гипотеза | Ожидаемый эффект | Риск |
|---|---|---|
| Surprise + forgetting curve лучше фиксированного replay | +5–20% retention efficiency | средний |
| Interference guard уменьшит вредный replay | -10–30% бесполезных replay операций | низкий |
| Adaptive policy feedback улучшит выбор памяти | +3–12% selection quality | средний |
| 3 timescales лучше одной частоты | +5–15% balance stability/plasticity | средний |
| Mobile cap сохранит качество при меньшем compute | -10–25% memory/replay cost | низкий |

Это инженерные гипотезы, а не гарантированные научные результаты. Их нельзя считать доказанными без controlled experiments.

## Следующий научный этап

P2688+ должен сравнивать минимум:

`fixed replay` vs `surprise replay` vs `forgetting replay` vs `adaptive replay`

в matched holdout с independent verification, отдельно измеряя:
- retention;
- transfer;
- interference;
- identity drift;
- energy/runtime cost;
- RSS;
- recovery after restart.


## Реальные результаты controlled ablation P2687

Ablation на одинаковом наборе из 96 synthetic experience candidates и 320 controller ticks сравнила четыре политики: balanced, surprise-heavy, forgetting-heavy и adaptive-feedback. Это **proxy benchmark выбора replay**, а не доказательство реального retention.

- balanced: quality proxy 0.79546; interference 0.33512; 342 selections; 6 unique memories.
- surprise-heavy: quality proxy 0.79713; interference 0.30286; 342 selections; 6 unique memories.
- forgetting-heavy: quality proxy 0.78095; interference 0.32357; 342 selections; 7 unique memories.
- adaptive: quality proxy 0.79513; interference 0.32852; 342 selections; 8 unique memories; 241 verified-feedback updates.

Вывод: в текущем proxy holdout adaptive controller **не доказал превосходство** над surprise-heavy вариантом. При этом он дал больше уникальных selected memories и сохранил bounded policy adaptation. Это важный отрицательный результат: P2687 не будет объявляться улучшением retention без следующего independent holdout.

Отдельный snapshot benchmark на 320 nodes / 40 iterations показал ~2.762 ms на deep-clone snapshot против ~0.0069 ms на shared-state snapshot, то есть около **99.75% снижения стоимости именно операции clone** в этом локальном benchmark. Это не следует переносить напрямую на весь runtime throughput; подтверждением hot-path служат отдельные regression tests.

## Исправления, найденные собственными проверками P2687

1. Migration 194→195 ранее продолжала выставлять Experience Continuum version=6; исправлено на version=7 с восстановлением adaptiveReplayGovernor.
2. Replay events, создаваемые consolidation loop, сохраняли tick=0; теперь сохраняется фактический scheduler tick.
3. Cooldown использовал `Date.now()` внутри scoring, что делало replay policy менее детерминированным; scoring переведён на timestamp текущего планирования.
4. Redundancy guard стал реально учитывать повтор одного cluster, а не только почти одинаковый kind.
5. Added contextual weights: высокий surprise/novelty, memory pressure, pressure и low energy теперь меняют только bounded effective weights; persistent learned weights остаются отдельным состоянием.
6. Identity/stability floors не позволяют feedback-controller почти обнулить protective features.
7. Public clone semantics сохранены, а internal checkpoint hot-path получил `snapshot({clone:false})`; durable boundary по-прежнему сериализуется checkpoint-слоем.
