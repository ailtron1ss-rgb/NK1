# P18 — Long-Horizon Autonomous Organism

## Цель
P18 собирает P15.5, P16 и P17 в единый долгосрочный жизненный контур: опыт накапливается, outcome фиксируется в traces, сон запускает replay/consolidation, world-model и calibration измеряются, а runtime ведёт longitudinal health/milestone ledger.

## Что внедрено
- State schema `20 -> 21`.
- `LongitudinalOrganismEngine`: циклы, completed outcomes, sleep consolidations, replay updates, causal evidence, calibration, resilience, behavioural entropy, continuity, recovery/anomaly counters и milestones.
- Decision traces получили структурированный `outcome`, поэтому опыт можно повторно проигрывать во время сна.
- Sleep consolidation теперь не ограничивается символическим dream trace: запускается bounded replay ранее завершённых traces и обновляется learned policy.
- Memory consolidation анализирует повторяемость entity/semantic evidence и фиксирует measurable promotions без слепого превращения гипотез в факты.
- Longitudinal health строится из измеряемых runtime/model signals.
- Новый endpoint `/api/organism/longitudinal`.
- Новый accelerated P18 research lab и regression test.

## Научная граница
P18 не объявляет consciousness или selfhood доказанными. `causalEvidence01`, `resilience01`, `continuity01` и другие числа являются инженерно-исследовательскими индикаторами.

## Телефонный бюджет
P18 не добавляет обязательную тяжёлую neural model. Replay ограничен последними traces, state structures bounded, а основной расчёт остаётся CPU/RAM-friendly. Физический Android endurance всё ещё требует прогона на POCO M7 Pro 5G.

## Следующий шаг
После P18 следующая версия должна сначала провести physical `24h -> 72h -> 168h` Device Gate и только после его прохождения рассматривать более тяжёлый learned vision/latent world model.

## Performance finding
В ускоренном stress-прогоне 64 cycles выполняются примерно за 8 секунд в in-memory режиме. Попытка 256 cycles превысила 180 секунд и была остановлена. Это не скрытая ошибка теста: результат указывает на дальнейший рост стоимости полного state snapshot/глубоких clone-операций при длительной истории. P18 поэтому фиксирует этот предел как реальный performance debt; следующий физический Device Gate должен измерить его на POCO, прежде чем расширять историю до месяцев.
