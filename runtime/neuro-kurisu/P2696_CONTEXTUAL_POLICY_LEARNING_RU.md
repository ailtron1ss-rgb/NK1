# P2696 — контекстное policy-learning + исправление глобального cold-start

P2696 продолжает P2695 и закрывает измеренный дефект P2694: adaptive memory policy фактически деградировал к одному глобальному policy, потому что cold-start и cooldown были глобальными, а не контекстными.

## Что реально изменено

### 1. `src/organism/developmental/AdaptiveMemoryPolicy.ts`
- cold-start теперь ведётся **для каждой пары context × policy**;
- политика не может потратить exploration budget в одном контексте и тем самым лишить другой контекст необходимые пробы;
- после появления локальных данных используется bounded contextual-UCB-подобная оценка:
  - локальное значение контекста — основной сигнал;
  - глобальное значение — слабый prior;
  - локальная exploration-бонусная часть;
  - небольшой глобальный exploration;
  - context-aware prior для causal/temporal/hybrid/semantic/balanced;
- cooldown теперь не блокирует переключение на другой контекст; он удерживает только тот же контекст.

Это не ручной выбор policy для каждого сценария: тест обучает controller на последствиях выбранной policy и затем проверяет перенос выбора на те же контексты.

### 2. `tests/p2694-policy-ablation.mjs`
Исправлен сам benchmark: контекстные поля теперь передаются в `AdaptiveMemoryPolicy.choose()` под теми именами, которые реально принимает API (`pressure01`, `goal01`, `causal01`, `temporal01`, `mobile`). Это важно: прежний тест фактически передавал другие имена и мог скрывать/искажать результат.

### 3. `tests/p2696-contextual-policy-learning.mjs`
Добавлен отдельный regression/learning gate:
- 5 независимых контекстов;
- 5 policies;
- 200 online training steps;
- проверка context-local exploration;
- проверка сохранения всех global trial counters;
- проверка cross-context cooldown;
- итоговая selection accuracy.

## Измеренный результат

P2696 contextual gate:
- accuracy: **1.00**;
- contextCount: **5**;
- trials: 40/40/40/40/40 по пяти policy;
- typecheck: PASS.

P2694 ablation после исправления benchmark:
- adaptive reward: **0.87327**;
- adaptive selection accuracy: **1.00**;
- adaptive+causal-credit reward: **0.87340**;
- adaptive+causal-credit selection accuracy: **1.00**;
- causal credit: **0.80031**;
- adaptive+causal-credit vs adaptive: reward **+0.0001295**, delayed **+0.0001380**, retention **+0.0004542**, transfer **+0.0001666**.

Это сильнее предыдущего P2694 результата, но важно: это synthetic holdout. Он доказывает работоспособность контекстного контроллера в данном benchmark, а не универсальное обучение реального мира.

## Regression

P2695 exact OrganismCore policy flow: PASS.
P2693 delayed policy credit: PASS.
P2692 adaptive holdout: PASS.
P2688 long-horizon replay: PASS.
Mobile 30-cycle soak: PASS; текущий измеренный peak RSS **359.2 MB** при `--max-old-space-size=256`. Это пока не считать улучшением мобильной памяти: RSS остаётся главным техническим ограничением и требует отдельного прохода residency/materialization.
