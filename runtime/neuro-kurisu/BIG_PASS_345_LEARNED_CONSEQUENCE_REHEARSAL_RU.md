# BIG PASS 345 — Learned Consequence Rehearsal / Использование собственной истории до действия
Дата: 2026-09-14

## Цель

После B344 выяснилось, что accumulated personality уже может дойти до final candidate field, но решение всё ещё в основном опирается на текущие pressures и множество upstream signals. Следующий функциональный шаг — использовать собственную историю организма как модель ожидаемого последствия действия **до совершения нового действия**.

Это не новый отдельный personality store и не фиксированный action bonus.

## Реальное изменение

### B299 — outcome prediction API

В `B299CausalPersonalityDevelopmentLoop` добавлен `predictOutcome(action, context)`.
Он объединяет:
- накопленную `value01` истории действия;
- fast preference;
- slow/consolidated preference;
- context-conditioned preference;
- evidence и causal confidence.

Результат содержит:
- `expectedReward01`;
- `confidence01`;
- `samples`;
- `verifiedSamples`.

### DecisionActionPipeline

`DecisionActionPipeline.rank()` теперь принимает learned outcome estimates.
Rehearsal применяется только когда одновременно:
- кандидат находится близко к текущему лидеру (не более `0.055` по score);
- есть минимум `3` samples;
- confidence >= `0.58`.

Таким образом слабая/непроверенная история не получает права переопределять organism decision.

Коррекция bounded: максимум `±0.032` по candidate score.

Пайплайн также сохраняет последний rehearsal trace для диагностики.

## Controlled evidence

После 18 повторных verified outcomes для `explore`:
- `expectedReward01 = 0.6272104`;
- `confidence01 = 0.8067245`;
- `samples = 18`;
- `verifiedSamples = 18`.

Для необученного `verify`:
- `expectedReward01 = 0.5`;
- `confidence01 = 0.285`;
- `samples = 0`.

При близком baseline ranking:
- `explore` получил rehearsal adjustment `+0.0065679`;
- `explore` стал верхним кандидатом.

Отдельный unit:
- `verify` expected reward `0.46`, confidence `0.90` → `-0.002304`;
- `explore` expected reward `0.72`, confidence `0.90` → `+0.012672`;
- top action changed to `explore`.

## Live OrganismRuntime evidence

Настоящий `OrganismCore`:
- 14 cognitive runtime ticks;
- 14 explicit feedback outcomes;
- `learningUpdates = 14`;
- `totalSamples = 14`;
- dominant learned action = `explore`, `samples = 13`;
- `value01 = 0.5622389`;
- `preference11 = 0.0932485`;
- `evidence01 = 0.4387494`;
- `personalityInfluence01 = 0.0080303`;
- `causalIntegrity01 = 0.505982`.

Этот runtime эксперимент доказывает, что новый prediction substrate достигает реального organism feedback loop и сохраняется в B299 state. Он **не доказывает** полный endogenous action switch в live Core на unseen context.

## Regressions

PASS:
- B338 unit
- B339 unit
- B340 unit
- B341 fast/slow unit
- B343 executive personality plasticity
- B344 personality decision carryover
- B345 learned consequence rehearsal unit
- B345 live Core runtime
- typecheck
- architecture: `1225 source files / 399 canonical / 0 cycles / legacyLeakage=0`
- integrity: `2629 files / schema=127`
- release contract
- executable syntax: `845 JS / 5 SH / 203 JSON / failures=0`

OPEN / not PASS:
- long B341 Core developmental reproduction can exceed local execution budget;
- B342 live unseen-context Core holdout still has `0` naturally produced endogenous `verify` observations in the existing 120-observation harness;
- full long-horizon 80–120+ tick individual-development closure is not yet demonstrated;
- Android/Termux device reality remains unproven.

## Why this is a deeper organism improvement

Previous chain:

`experience -> personality -> decision influence`

B345 extends it to:

`experience -> learned outcome model -> pre-action rehearsal -> candidate re-ranking -> action selection`

This is the first pass in this sequence where the organism explicitly uses its own past action consequences as a **predictive value estimate before acting again**, instead of only changing a static personality preference after the fact.

## Next high-value target

Do not add another isolated learning subsystem.

Use this learned consequence model in a real developmental holdout:

`baseline -> endogenous training -> feedback -> learned outcome model -> restart -> new context -> final candidate distribution -> outcome -> ablation/replay comparison`

The decisive metric is future behavioral divergence attributable to the organism's own learned outcome history, not the existence of another state field.
