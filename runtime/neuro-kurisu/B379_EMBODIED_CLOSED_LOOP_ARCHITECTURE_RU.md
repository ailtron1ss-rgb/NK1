# B379 — Embodied Closed-Loop Recovery & Long-Horizon Reliability

## Назначение
B379 закрывает следующий разрыв после B378: физическое действие теперь имеет не только evidence gate, но и устойчивый жизненный контур отказов, восстановления, повторной проверки и persistence.

## Принцип ownership
B365 остаётся единственным каноническим нейронным decision owner. B379 не выбирает цели и не создаёт второй policy. Он является исполнительным reliability/safety контуром вокруг уже выбранного действия.

## Контур
1. B365 выбирает действие.
2. RecoveryController оценивает эксплуатационное состояние конкретного device action.
3. Если действие допустимо — оно исполняется обычным EmbodiedActionExecutor.
4. Если circuit breaker открыт — физическое действие не повторяется вслепую; исполняется безопасный `wait` как operational fallback.
5. Post-action evidence проходит B378 Physical Action Consequence Gate.
6. Verified independent evidence разрешает physical neural learning; receipt-only/derived evidence не разрешает его.
7. RecoveryController обновляет надёжность действия, failure streak, cooldown/backoff и эпизод.
8. Snapshot сохраняется в `facets.embodiment.embodiedRecovery`.
9. После restart ledger восстанавливается точно.

## Состояния
`normal -> probe -> degraded -> blocked`.

- `normal`: стандартное выполнение.
- `probe`: после единичного отказа разрешён ограниченный повторный проход.
- `degraded`: после серии отказов остаётся один безопасный retry budget.
- `blocked`: после 5 последовательных отказов конкретный physical action circuit breaker закрывается.

## Evidence tiers
- `unverified` — host/derived или недостаточное физическое доказательство.
- `actuation-receipt` — команда устройству принята, но внешний эффект не доказан.
- `artifact-verified` — создан проверяемый физический артефакт.
- `independently-observed` — независимое свежее физическое наблюдение после действия.

Только последний класс совместно с `android-termux` допускает B365 physical consequence learning.

## Почему это не декоративный модуль
Контроллер непосредственно меняет траекторию исполнения при отказах, ограничивает бесконечные повторения, сохраняет состояние между restart и формирует измеримую causal difference ON/OFF.
