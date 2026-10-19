# Neuro-Kurisu — CROSS-SYSTEM PASS R10

Дата: 2026-09-25
База: R9 `35.26.0 / core 100.19.0-contextual-action-policy-p2855 / schema 219`

## Цель прохода

Не добавлять декоративные модули, а укрепить реальные границы организма между симуляцией, внешним миром, обучением, world-model, памятью и self/identity; одновременно проверить, что после R8/R9 архитектурная декомпозиция не скрывает новые обходные пути.

## Выполненная работа

### 1. Reality provenance как канонический learning contract

Добавлен `LearningProvenance` и его передача из `OrganismRuntime` через normal `OrganismCore.feedback()` в память, world-model, P31/P32/P33/P34, central brain, global workspace и predictive self-agency.

Источник результата теперь влияет не только на diagnostic score, но и на величину фактического обновления.

Критически важное ограничение: simulation остаётся пригодной для predictive learning, но не может самостоятельно стать сильным источником долгосрочной identity/memory promotion.

Жёсткие caps для `source=simulation`:

- memory promotion <= 0.40
- identity update <= 0.08

Это отдельный invariant, покрытый P290 regression.

### 2. WorldEnvironment hot path

`simulate()` и `project()` переведены с создания временного `WorldEnvironment` + копирования history на чистый `computeTransition()`.

Канонический state/history теперь не мутируется pure prediction-путём.

Benchmark на одинаковом сценарии: 500 элементов history, 1000 пар `simulate/project`:

- R9 reference: ~34.03 s
- R10: ~0.12 s
- ускорение: ~283x

При этом history остаётся ровно 500, canonical tick/state не меняются.

### 3. Устранено дублирование world projection

В `OrganismRuntime` один action projection теперь вычисляется один раз и переиспользуется вместо повторного simulation для matched candidates.

### 4. Реальные типовые границы

Убраны `as any` на world transition / observation bridge в этом пути; добавлены нормализующие helpers с явными `WorldContext` / `WorldTransitionForOrganism`.

### 5. Persistence / continuity bug сохранён исправленным

R8/B285 restart equality остаётся зелёным; текущий B285:

- steps 48
- learningUpdates 48
- consolidation 3
- futureConsistency 0.6050
- autobiographicalCompression 0.6229
- identityStability 0.9870
- ablationDrop 0.1005
- restart = true

### 6. P2724 operational robustness

Сохранено исправление неполного persisted action-model/context/latent-model: canonical owner восстанавливает допустимую action model вместо падения длительного operational path.

## Verification

### Архитектура

- core ownership: PASS, directConstructors = 5
- architecture: PASS, cycles = 0, missing = 0, legacy leakage = 0
- hygiene: PASS, errors = 0, warnings = 0
- syntax: PASS, JS 1167 / SH 6 / JSON 240
- integrity: PASS, files 3710
- release contract: PASS
- release source: PASS
- function reality critical path: PASS

### Реальные поведенческие тесты

- P2840 learning gate: PASS
- P2840 reality boundary: PASS
- P2855 contextual: PASS — holdout 1.0, retention 1.0, 1200 updates
- P2855 integration: PASS — 84/84 policy updates, persistence true
- P2855 ablation: PASS — +0.10 absolute accuracy gain
- P290 reality provenance: PASS
- P290 world hotpath: PASS
- B285 continuity/restart: PASS
- organism smoke: PASS
- server smoke: PASS

## Reality-boundary результат

Для P2840 verified external outcome:

- learning scale ~= 0.841
- identity scale ~= 0.778

Для receipt-only external action:

- learning scale ~= 0.403
- identity scale ~= 0.100

Для simulated outcome в boundary integration:

- identity scale ~= 0.005

Следовательно, simulation больше не является эквивалентным источником ground truth для долгосрочной self/identity adaptation.

## Function reality / semantic evidence

Текущий строгий аудит:

- runtime-reachable functions: 507
- test-only: 466
- referenced but not runtime-reachable: 4644
- orphan: 346
- total functions with body: 5485
- VERIFIED: 34 / 5268 semantic contracts
- INTEGRATION_ONLY: 9
- UNVERIFIED: 4909
- semantic verified rate ~= 0.65%
- evidence coverage ~= 0.69%
- parameterized-safe: 1206 attempts / 1143 pass / 0 failure

Снижение VERIFIED относительно предыдущего аудита не принимается как улучшение. Оно ожидаемо после изменения методов: старые explicit evidence привязаны к exact source hashes и перестают считаться доказательством после модификации. Следующий проход должен не подменять эту метрику, а восстановить evidence для реально изменённых критических функций через новые direct/integration/restart tests.

## Forensics

`audit:forensics` пока FAIL из-за existing very-long-line debt: README, B2523 и ряд длинных строк `OrganismCore`. Это не используется как основание для отката текущего runtime-прохода; это отдельный технический долг для следующего прохода.

## Научно-инженерное направление

При проектировании прохода использованы два актуальных направления:

1. Современная predictive-processing work рассматривает internal world models как recurrent/predictive dynamics, что поддерживает отделение predictive simulation от external evidence и learning promotion.
2. Современные биоподобные learning approaches усиливают роль локальных обновлений, управляемых глобальным mismatch/error signal; это поддерживает дальнейшее разделение signal generation и update magnitude.

Open-source reference inspection:

- Norse — stateful/event-driven SNN primitives and learning infrastructure.
- DreamerV3 — явное разделение encoder/dynamics/decoder/reward/policy/value, replay context и imagination/world-model learning.

Это использовано как архитектурные ориентиры, а не как повод механически переносить чужой код.

## Что сознательно НЕ сделано

- Не добавлялись новые декоративные neural/personality modules.
- Не делался массовый косметический refactor сотен файлов.
- Не засчитывался internal metric growth как proof of consciousness.
- Не выпускался нестабильный `spineOnly` provenance patch после обнаруженной runtime-незрелости; он откатирован точечно.
- Не объявлялся 1000-cycle endurance solved: длительный tail/GC pressure остаётся открытым.

## Следующий проход R11

1. Восстановить строгую behavioural evidence для изменённых критических функций.
2. Закрыть remaining raw-reward learning paths в developmental/neural cluster единым provenance contract.
3. Перейти от R9/R10 structural runtime к canonical learned world-model interface.
4. Параллельно профилировать retained heap/GC pressure на 250/500/1000 cycles.
5. Начать real continual-learning evaluation: experience -> update -> future holdout improvement.

Именно R11 должен мерить не количество работающих модулей, а количество критических функций, которые реально доказано меняют будущее поведение организма.
