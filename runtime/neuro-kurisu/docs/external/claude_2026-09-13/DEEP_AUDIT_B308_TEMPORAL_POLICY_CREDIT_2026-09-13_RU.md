# Глубокий аудит B308 — Temporal Policy Credit
Дата: 13.09.2026

## 1. Цель
B307 доказал, что verified outcomes меняют policy bias, но в основном связывал outcome с последним действием. B308 усиливает canonical AdaptivePolicyEngine коротким eligibility trace, чтобы проверенный результат мог частично закреплять или ослаблять непосредственно предшествующее действие.

## 2. Что изменено
- `AdaptiveActionValue` получил `eligibility01`.
- `AdaptivePolicyState` получил `temporalCreditUpdates`, `verifiedTemporalUpdates`, `temporalPriorContextKey`, `temporalPriorAction`.
- обычный policy update помечает текущий action как eligible и постепенно затухает предыдущий trace.
- verified outcome дополнительно кредитует предыдущий action, если trace выше порога.
- добавлены `effectiveScore()` и `topEffectiveActions()` для измеримого policy ranking.
- `StateMigrations` теперь нормализует старые policy rows сразу, а не рассчитывает только на последующий runtime restore.

## 3. Unit evidence
Положительный temporal credit: предыдущий `explore` получил `verifiedUpdates=1`, `verifiedValue 0.500000 -> 0.508163`.
Отрицательный temporal credit: предыдущий `explore` получил `verifiedUpdates=1`, `verifiedValue 0.500000 -> 0.491837`.

После 18 положительных verified outcomes для `explore` и 18 отрицательных для `respond`:
- effective explore score = `0.566617`;
- effective respond score = `0.433383`;
- winner = `explore`;
- baseline effective ranking был нейтральным.

## 4. Live OrganismCore evidence
- 48 operational ticks.
- 24 full cycles.
- 12 verified outcomes.
- `temporalCreditUpdates=24`.
- `verifiedTemporalUpdates=2`.
- 6 temporal policy rows.
- restart сохранён.
- внутри canonical policy object verified ranking смещается к `explore=0.558825`, `respond=0.441175`.

### Критическое ограничение
В этом полном organism smoke-run фактическое выбранное действие осталось `respond 12/12` до и после policy training. Это не считается провалом B308: это показывает, что другие decision sources организма пока сильнее одного AdaptivePolicy branch. Поэтому B308 доказывает изменение policy ranking, но не заявляет, что весь организм уже перестраивает поведение от одного policy learner.

## 5. Persistence / migration
Legacy state без новых B308 fields успешно мигрирует в schema 127 с безопасными defaults. Новые temporal counters сохраняются после restart.

## 6. Настоящая нейронность
B298 regression: 36 learning updates, 5616 synaptic updates, 71 learned transitions, 3 dreams, restore PASS.
B305 regression: 2496 synaptic updates за 16 full cycles.
B306 regression: 12/16 autonomous decisions causally influenced.
B308 не заменяет neural substrate и не создаёт второй learner.

## 7. Что НЕ доказано
Сознание, субъективный опыт, open-ended autonomy, физический Android, P7 independent replication.

## 8. Verdict
B308 = FUNCTIONAL PASS для temporal policy credit; P6/P7 остаются открытыми.
