# NK1 WorkPass — cognitive spine protective budget gate (2026-11-01)

## Defect

The scheduler selected `protect` when the budget mode was `sleep` or resource pressure exceeded its threshold, but the per-operation cadence gate could still run work on matching ticks. A high-urgency external event could also force world rollout, shadow simulation and project work during protection. Only research already had a partial protect-mode exception.

## Correction

`protect` is now a hard stop for all four optional secondary operations: research, world rollout, shadow simulation and project work. Their opportunity and skip counters still advance, making deferred work visible to diagnostics.

External events remain available to the core/reflex and governance loops that sit outside this optional secondary-work scheduler. They do not authorize expensive background work to bypass the resource governor.

## Regression coverage

The WorkPass39 suite now tests high-urgency external input under explicit sleep mode on a tick that is divisible by every relevant cadence, and under resource-pressure-derived protect mode. It asserts all operations remain disabled and deferrals are accounted for.

The unified organism runtime workflow now runs `npm run test:big-pass-39` on relevant runtime changes.

## Limits

This validates scheduler policy, not actual battery draw, thermal throttling on Android, or production background execution.

## Дополнительное исправление, найденное расширенным WorkPass39 gate

WorkPass39 обнаружил устаревший reality-boundary тест, который передавал пустые объекты `before`/`after` вместо обязательного `WorldContext`. Ранее runtime успевал обновить ensemble/world-model, а затем падал на чтении `transition.after.objects.length`, оставляя возможность частичного обучения.

Теперь входной переход валидируется целиком до первого изменения модели. Тест использует полноценные контексты и проверяет, что malformed post-state отклоняется с `invalid-world-transition`, не меняя world-learning snapshot.
