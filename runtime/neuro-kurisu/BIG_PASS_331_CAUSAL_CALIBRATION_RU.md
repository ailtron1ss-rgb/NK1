# BIG PASS 331 — Causal Calibration & Recheck B330
Дата: 2026-09-14

## 1. Цель

B331 не добавляет ещё один параллельный learning-store. Цель — перепроверить B330 и закрыть конкретный разрыв в causal evidence: `selectedExpected01` должен быть прогнозом до действия, а не значением уже полученного reward.

После этого введена калибровка matched evidence, привязанная к паре `contextKey + action`.

## 2. Что было найдено при перепроверке B330

### Критический дефект
В `OrganismRuntime` прежний код записывал:

`selectedExpected01 = actual transition.reward`

Это делало selected-vs-alternative margin постфактум зависимым от результата и могло искусственно усиливать causal support.

Исправлено:

`selectedExpected01 <- plan.steps[0].predictedReward`

`actualSelectedReward01 <- transition.reward`

Таким образом теперь разделены prediction и realized outcome.

### Семантическое ограничение
`alternativeExpected01` по-прежнему является matched simulation projection из того же `pre-state`. Это не независимое физическое ON/OFF intervention и не должно называться таким доказательством.

## 3. B331 implementation

Добавлено в canonical `AdaptivePolicyEngine`:

- `observeMatchedCounterfactualCalibration()`;
- per-`context + action` calibration ledger;
- trial count;
- MAE calibration;
- signed prediction bias;
- calibration score;
- persistence/restore;
- recovery strategy schema `version=4`;
- promotion gate требует:
  - non-model counterfactual source;
  - `matchedTrials >= 3`;
  - минимум 3 calibration trials для той же `context + action`;
  - calibration score `>= 0.70`;
  - causal confidence `>= 0.65`;
  - counterfactual support `>= 0.60`;
  - independent evidence.

Калибровка одного поведения не переносится автоматически на другую action/context пару.

## 4. Проверка B331

### Good calibration
4 calibration trials:
- score = `0.9775`;
- 3 independent recovery boots;
- matchedTrials=3;
- promotion = `1`.

### Bad calibration
3 intentionally poor trials:
- score = `0.45`;
- 3 independent recovery boots;
- promotion = `0`.

### Unrelated action
Калибровка `verify` не открыла promotion для `rest`:
- unrelated promotions = `0`.

### Persistence
После restore:
- recovery strategy version = `4`;
- promotion сохранён;
- 4 calibration trials сохранены.

## 5. Regression

PASS:
- B326 recovery causal influence;
- B327 long-term recovery learning;
- B327 Core multi-boot safety gate;
- B328 reversal/holdout;
- B329 causal promotion gate;
- B330 matched-counterfactual gate;
- `npm run typecheck`;
- release integrity;
- source syntax;
- release contract;
- release-source verification.

## 6. Реальный Core — честный результат

После серии restart runtime продолжает создавать `matched-simulated` evidence, но на каждом recovery boot сейчас наблюдалось только `matchedTrials=1`.

Следствие:
- causal promotion = `0`;
- слабая реальная causal evidence блокируется;
- система не получает promotion только потому, что механизм симуляции существует.

Это ограничение не исправлялось снижением порогов.

## 7. Интерпретация

B331 улучшает качество causal-learning pipeline, но не доказывает физическую причинность и не является доказательством сознания.

Реально достигнутый контур:

`prediction -> action -> realized outcome -> matched projection -> calibration -> evidence gate -> promotion / block`

Главный оставшийся разрыв: накоплять несколько независимых matched intervention trials внутри живого recovery episode, а не по одному trial на boot.

## 8. Консервативный прогресс

Оценку проекта целесообразно сохранять около **73%**. B331 не даёт права прибавлять процент только за новые классы; прогресс выражен в усилении causal learning, calibration и verification discipline.

Следующий крупный этап: repeated matched intervention trials внутри runtime и causal calibration/holdout уже на живом контуре.
