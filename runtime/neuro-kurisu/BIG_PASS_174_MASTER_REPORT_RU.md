# NEURO-KURISU 35.6.1 — BIG PASS 174 MASTER REPORT

## Цель

BIG PASS 174 направлен на закрытие разрыва между наличием функций в исходниках и доказанной работоспособностью. Второй основной фокус — сделать prediction lifecycle World Model частью сохраняемого состояния, чтобы prediction→outcome оставался причинно корректным после restart и при одинаковых действиях.

## Основные изменения

1. `WorldModelEnsembleController` теперь хранит prediction tickets в canonical state: уникальный `predictionId`, действие, время создания и полный набор candidate predictions.
2. Tickets имеют bounded lifecycle: TTL 120 секунд и максимум 256 pending tickets.
3. Добавлено точное разрешение outcome по ticket/action без повторного prediction после получения результата.
4. `WorldSubsystemRuntime.observeActionOutcome()` больше не создаёт post-outcome prediction для calibration; outcome сопоставляется с prediction, созданным до результата.
5. `ContextualWorldModel` получает реальные transitions и участвует в ensemble, когда доступен полный organism state.
6. Parameterized function probe усилен реальными builders входов: теперь синтез входа не мешает считать функции проверенными.
7. Semantic audit и function-reality audit переведены на единый строгий принцип: код, экспорт или упоминание в тесте сами по себе не являются доказательством.
8. `audit-function-liveness` оптимизирован через один индекс идентификаторов вместо повторного rescanning каждого файла для каждой декларации.
9. Release/hygiene gates исключают только конкретные генерируемые telemetry JSON, не ослабляя проверки исходников.
10. Добавлены regression-доказательства BIG PASS 174 и обновлены roadmap/progress/first-analysis recheck.

## Реальные доказательства

### Function surface

- Semantic inventory: **2477** function-like contracts.
- `VERIFIED`: **18**.
- `INTEGRATION_ONLY`: **594**.
- `UNSAFE_TO_AUTO_RUN`: **214**.
- `UNVERIFIED`: **1651**.
- Strict VERIFIED rate: **0.73%**.
- Evidence coverage: **6.72%**.

### Parameterized verification

- Source files: **269/269 imported**.
- Attempts: **509**.
- PASS: **497**.
- FAIL: **0**.
- Input synthesis needed: **0**.
- Lifecycle-needed: **12**.
- Skipped: **30**.

Это означает 497/509 безопасно параметризованных вызовов прошли без runtime failure; 12 требуют живого lifecycle контекста и поэтому не маскируются как PASS.

### Static liveness

Текущий broader inventory (`src/tests/research/scripts`) содержит **2549** function-like declarations; это другой scope, чем semantic contract inventory 2477, и цифры намеренно не смешиваются.

- with body: **2520**
- exported: **105**
- zero static references: **158**
- one-or-less references: **482**

Zero-reference не означает автоматически broken: accessor/private lifecycle/generated hooks могут иметь динамическое использование. Но такие функции остаются приоритетным аудитом.

### World model tickets

BIG PASS 174 доказывает:

- два одинаковых action predictions получают разные IDs;
- outcome разрешает самый старый соответствующий ticket;
- второй ticket остаётся pending до своего outcome;
- pending state переживает restart;
- WorldModel2 сохраняет несколько одинаковых action hypotheses;
- runtime использует pre-outcome prediction, а не переобучение из уже известного reward.

## Регрессия

После текущих изменений отдельно прошли BIG PASS 174, 173, 172, 171, 170, 169, 168, 166 и ключевые P26/P28/P29/P30/P31/P32/P33/P34/P35/P37/P41, а также smoke/restart/memory/concurrency и release gates.

Длинный 250-cycle benchmark функционально проходит. При этом отдельный scaling profile выявил предупреждение: средняя latency первых ~50 циклов около 50 ms, последних около 145 ms, ratio ~2.88; heap вырос примерно с 44.3 MB до 127.6 MB. Это не объявляется PASS производительности и должно быть закрыто дальнейшим hardening.

Полный aggregate orchestrator `audit:big-pass-174` не считается PASS только на основании constituent tests, поскольку длительный запуск превышает sandbox execution limit. Это ограничение выполнения, а не функциональный PASS.

## Первый анализ — текущая проверка

- Cognitive Event Fabric — **DONE** в текущем функциональном scope.
- Unified Cognitive Cycle — **DONE** в текущем функциональном scope.
- Memory Economy — **DONE** в текущем функциональном scope.
- Reality vs Simulation — **DONE** в текущем функциональном scope.
- Semantic Coverage — **PARTIAL**.
- Emotion / Feeling — **PARTIAL**.
- World Model — **PARTIAL**, но causal prediction lifecycle значительно усилен.
- Self / Identity — **PARTIAL**.
- Agency / Autonomous Projects — **PARTIAL**.
- Learning — **PARTIAL**.
- Social Mind — **PARTIAL**.
- Perception — **PARTIAL**.
- Embodiment — **PARTIAL**.
- Consciousness research battery — **PARTIAL / research-only**.
- Long-horizon life — **PARTIAL**.
- Adversarial organism testing — **PARTIAL**.
- Android production runtime — **NOT DONE**.

Macro maturity по старому принципу `DONE=1 / PARTIAL=0.5 / NOT DONE=0`: **58.8%**. Это зрелость архитектурных направлений, а не процент сознания.

## Что считать реализованным

Функция получает `VERIFIED` только после наблюдаемого поведения с подходящим direct/integration/regression и persistence/replay evidence. Stateful/external/destructive операции не считаются безопасно автозапускаемыми только по сигнатуре.

## Следующий крупный цикл

### BIG PASS 175 — Autonomous Life Projects

Закрыть реальный цикл: project selection → decomposition → bounded execution → evidence → learning → recovery → resource budget → completion/abandonment. Особый акцент — причинная связь проекта с памятью, ценностями, identity, personality и world model.

После него:

176 — настоящая 7/30/90-day longitudinal life;
177 — Android sensorimotor reality;
178 — adversarial compound battery;
179 — consciousness research battery;
180 — release/research freeze.

