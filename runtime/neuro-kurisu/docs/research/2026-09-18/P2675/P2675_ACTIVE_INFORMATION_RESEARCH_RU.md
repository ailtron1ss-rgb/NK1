# P2675 — исследование и архитектурное решение

Дата: 2026-09-18

## Что изменилось в исследовательской базе

### 1. Active inference / information gain
Nature Communications, 08.09.2026: *Active inference and artificial reasoning*.
https://www.nature.com/articles/s41467-026-77209-5

Ключевая идея для Neuro Kurisu: действие может оцениваться не только по немедленной полезности, но и по тому, насколько его наблюдаемый результат уменьшает неопределённость о структуре модели мира. В работе information gain связан с KL-дивергенцией между предсказательными распределениями до/после действия; также обсуждается Bayesian Model Reduction.

В проекте внедрён мобильный приближённый вариант: competing hypotheses + uncertainty + expected utility + risk/device gate. Это не заявляется как полная Bayesian inference.

### 2. World models: controllable/actionable orientation
*World Models for Embodied Intelligence: From Plausible to Controllable to Actionable*, arXiv:2609.16697, 15.09.2026.
https://arxiv.org/abs/2609.16697

Практический вывод: ценность world model следует оценивать через улучшение closed-loop поведения, intervention effects, planning, verification, recovery и data selection, а не только через правдоподобие генерации.

### 3. Physical AI world-model survey
Kirchner, Purschke, Knoll, 2026, *A survey of world models for physical AI with uncertainty representation and control*, опубликовано 03.09.2026.
https://link.springer.com/article/10.1007/s44163-026-02122-1

Для проекта особенно релевантны шесть совместимых измерений: state abstraction, temporal dynamics, uncertainty, structural prior, observation modality и decision coupling. Отдельно подчёркиваются partial observability, asynchronous/noisy sensors, compounding error и calibration.

### 4. Test-time adaptive world-model routing
Jang et al., ICLR 2026, *Test-Time Mixture of World Models for Embodied Agents in Dynamic Environments*.
https://arxiv.org/abs/2601.22647
https://github.com/doldam0/tmow

Идея: не фиксировать routing навсегда, а адаптировать выбор/смесь world-model компонентов на test time. В текущем P2675 реализован не полный TMoW, а более дешёвая ступень: hypothesis/action evidence routing. Следующий этап — прототипный routing между реальными world-model hypotheses.

### 5. Continual memory
Dorovatas et al., 2026, *Modular Memory is the Key to Continual Learning Agents*.
https://arxiv.org/abs/2603.01761

Для Neuro Kurisu это поддерживает разделение быстрых адаптивных контекстов и более стабильной долговременной памяти. Уже существующая autobiographical memory поэтому не заменяется, а связывается с evidence ledger и causal credit.

### 6. Active embodied evidence
CVPR 2026, *Align While Search: Belief-Guided Exploratory Inference for World-Grounded Embodied Agents*.
https://openaccess.thecvf.com/content/CVPR2026/html/Bae_Align_While_Search_Belief-Guided_Exploratory_Inference_for_World-Grounded_Embodied_Agents_CVPR_2026_paper.html

Релевантная идея: поддерживать внешнее структурированное belief state, обновлять его action-conditioned observations и выбирать действия по predicted information gain.

## Архитектурное решение P2675

Новая closed-loop цепочка:

`external sensors -> grounding -> competing hypotheses -> information-gain action selection -> action -> observed outcome -> evidence ledger -> causal credit -> autobiographical memory / skills / developmental learning -> updated hypotheses`

Добавлены:
- `ActiveInformationGainController.ts`
- `ClosedLoopEvidenceLedger.ts`
- интеграция обоих слоёв в `NeuralExperienceBranch`
- persistence/restore
- diagnostics/metrics
- regression test `tests/p2675-active-information-gain-closed-loop.mjs`

## Почему это важно

Раньше external grounding в основном отвечал на вопрос «насколько данным сенсорам можно доверять». Теперь появляется второй вопрос: «какое следующее действие даст максимальную полезную информацию при допустимом риске и compute budget?». Результат действия затем записывается как отдельный evidence episode и становится материалом для causal/developmental/memory контуров.

## Ограничение

Это lightweight инженерная аппроксимация, а не доказанная реализация биологического active inference и не доказательство сознания. Реальный Android closed loop с камерой/микрофоном/датчиками пока требует проверки непосредственно на целевом устройстве.
