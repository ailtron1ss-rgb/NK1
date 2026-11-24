# B328 — Recovery Strategy Reversal & Holdout Learning
Дата: 2026-09-14
Проект: Neuro-Kurisu 35.6.1

## Цель
B327 доказал консолидацию стратегии после независимых recovery-эпизодов. B328 проверяет, что эта долговременная стратегия не является необратимой привычкой: при устойчивом противоположном verified evidence организм должен ослабить/развернуть ранее выученное направление, сохранить новое состояние после restore и не разнести изменение на несвязанный контекст.

## Изменение канонического кода
Изменён `src/organism/learning/AdaptivePolicyEngine.ts`.

`RecoveryStrategyPromotion` теперь хранит:
- `status`: active / reversed / uncertain;
- `reversalCount`;
- `contradictionCount`.

При новом evidence для уже существующей promotion старый эффект не заменяется напрямую: используется сглаженное обновление. При переходе знака фиксируется reversal; при противоположном знаке evidence увеличивается contradictionCount. Новое состояние сериализуется тем же `AdaptivePolicyState`, поэтому отдельное хранилище стратегии не создаётся.

Диагностика `recoveryStrategyDiagnostics()` теперь явно показывает status/reversalCount/contradictionCount.

## Gate B328
Тест: `tests/big-pass-328-recovery-reversal-holdout.mjs`

Положительная фаза:
- 3 независимых boot-а;
- rewards 0.92 / 0.88 / 0.90;
- исходный learned bias: **+0.0540000000**.

Противоположная фаза:
- 6 новых независимых boot-ов;
- rewards 0.08 / 0.12 / 0.10 / 0.14 / 0.09 / 0.11;
- итоговый effect01: **-0.2436498432**;
- runtime bias после reversal: **-0.02436498432**;
- related holdout transfer: **-0.014618990592**;
- unrelated context: **0**;
- `reversalCount`: **1**;
- `contradictionCount`: **3**;
- всего episodes: **9**;
- promotions: **1**.

## Persistence
После `snapshot()` → `restore()` знак эффекта, reversalCount и bias совпадают с состоянием до restore. Стратегия не создаёт второй policy store.

## Регрессии
- B327 direct recovery long-term learning: **PASS**.
- B327 OrganismCore multi-boot integration: **PASS**.
- B326 recovery causal influence: **PASS**.
- Runtime TypeScript typecheck (`tsc` mode): **PASS**.

## Что доказано
Доказан замкнутый контур:
`verified recovery outcome → long-term promotion → future bias → contradictory evidence → reversal → persistence → bounded transfer`.

Это уже не простая запись опыта: будущее поведение меняется, а затем может систематически измениться обратно при появлении противоположной доказательной базы.

## Что пока НЕ доказано
B328 не доказывает общую автономность или сознание организма. Не доказано также, что reversal на этом этапе полностью управляется естественным пользовательским/реальным внешним миром на Android — текущий holdout является контролируемым инженерным gate. Реальный device evidence остаётся отдельной задачей.

## Следующий критический участок
B329 — counterfactual/causal strategy evaluation: перед promotion организм должен уметь отделять корреляцию от альтернативного объяснения, сравнивать ожидаемый результат выбранного действия с ближайшими альтернативами и отклонять promotion при высокой causal ambiguity. Это должно усилить качество learning, не создавая ещё один параллельный policy subsystem.
