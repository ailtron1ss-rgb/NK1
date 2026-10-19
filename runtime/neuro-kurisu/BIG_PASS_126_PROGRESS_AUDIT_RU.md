# BIG PASS 126 — Интегрированная жизненная траектория / Predictive Agency / Long-Horizon Learning

## Цель
Один сквозной апдейт, объединяющий уже существующие сигналы self/world/social/goals/memory/learning/future/counterfactual/agency в производный контур выбора и обучения. Новый слой не создаёт отдельную память и не заявляет наличие субъективного сознания.

## Внедрено
- `IntegratedLifeTrajectoryEngine`: четырёхгоризонтная проекция `immediate / near / long / identity`.
- Синтез personal worldline, autobiographical continuity, relational continuity, goal continuity, portfolio/curriculum, FutureSelf, prediction error, counterfactual gap, regret, resources и evidence quality.
- Оценка всех семи базовых действий и измеримый bounded bias в action selection.
- Post-outcome calibration: prediction error, counterfactual gap, future alignment и trajectory coherence обновляются только по наблюдаемому результату.
- Persistent state + backward-compatible default/migration path.
- Runtime API: `/api/organism/life-trajectory`.
- Standalone, Core/persistence и server smoke tests.

## Результаты
- Standalone: `BIG_PASS_126=PASS`, 6 cycles, coherence 0.712, agency 0.734, trajectory prediction error 0.290.
- Core: `BIG_PASS_126_CORE=PASS`, 8 cycles, 56 forecasts, coherence 0.718, persistence verified.

## Важное ограничение
Это инженерный predictive/control layer. Его работа не является доказательством феноменального сознания, субъективных переживаний или sentience.
