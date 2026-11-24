# NEURO KURISU — P2840 FINAL AUDIT

Дата: 2026-09-20
Релиз: 35.18.3 / P2840
Core: 100.9.3-reality-boundary-p2840
State schema: 209

## 1. Цель прохода

Главная цель P2840 — перестроить external-first контур так, чтобы симуляционный world transition не мог автоматически подменять фактическое последствие реального действия, а подтверждённое внешнее последствие становилось обучающим сигналом следующего cognitive cycle.

Приоритеты прохода:
1. Отделить predictive shadow world от canonical world state.
2. Ввести evidence-weighted learning gate.
3. Связать neural learning с доказательством источника outcome.
4. Возвращать внешнее consequence как perceptual evidence следующего цикла.
5. Снизить риск ложной identity/memory consolidation из слабых actuator receipts.
6. Сохранить совместимость P2835/P2836 и мобильного контура.
7. Сохранить research evidence внутри архива.

## 2. Реально изменённый код

### Новые runtime-компоненты

- `src/organism/system/RealityLearningGate.ts`
  - оценивает силу обучения по источнику outcome, verification, independence, consequence, prediction error, surprise и resource budget;
  - раздельно масштабирует neural/world-model/memory/identity updates;
  - снижает кросс-реальное усиление от simulation и слабых actuator receipts.

- `src/organism/system/RealityShadowBridge.ts`
  - ведёт shadow prediction отдельно от canonical world;
  - при authoritative external outcome удерживает shadow state и записывает divergence;
  - при отсутствии external evidence допускает единственный simulation commit;
  - поддерживает bounded history для диагностики.

### Изменения runtime

- `WorldEnvironment.simulate()` теперь создаёт pure shadow transition без mutation canonical state.
- `WorldEnvironment.commit()` делает idempotent commit выбранного transition.
- `OrganismRuntime` сначала получает shadow prediction, затем external/device consequence и только потом разрешает commit/shadow hold.
- learning reward/success/surprise получают evidence-gated значения.
- world-model transition отправляется в canonical feedback только при simulation-primary path.
- external outcome записывается как external/device evidence.
- высокая shadow/reality divergence повышает требование к следующему active-perception cycle.

### Perception/world integration

- `PerceptualEvidenceCompiler.recordExternalEvidence()` добавляет consequence внешнего действия в persistent perceptual evidence.
- `OrganismCore.recordExternalPerceptualEvidence()` делает эту запись частью канонического persistence path.
- grounded world state уже интегрируется из актуального perceptual evidence snapshot на следующем perception cycle.

## 3. Новые тесты

- `tests/p2840-shadow-world.mjs`
- `tests/p2840-reality-learning-gate.mjs`
- `tests/p2840-reality-boundary.mjs`

Новые npm scripts:
- `test:p2840:shadow`
- `test:p2840:learning-gate`
- `test:p2840:boundary`
- `test:p2840`

## 4. Ключевые результаты P2840

### Shadow boundary

При authoritative external outcome:
- `commitShadow=false`;
- canonical world tick не изменяется;
- divergence записывается.

При отсутствии authoritative external outcome:
- `commitShadow=true`;
- shadow transition коммитится один раз.

Последний boundary run:
- external world tick stable = `true`;
- simulation committed = `true`;
- mean divergence = `0.24039`;
- mean shadow agreement = `0.59761`.

### Evidence-weighted learning

Контрольный standalone gate:
- simulation learning scale = `0.25449`;
- weak external receipt = `0.40104`;
- strong independently verified external outcome = `0.85004`.

Identity promotion:
- simulation = `0.03261`;
- weak external receipt = `0.09752`;
- strong external = `0.78410`.

Это не означает доказанную causal attribution само по себе; causal attribution подтверждается отдельными ablation/holdout экспериментами.

### Runtime boundary

Интеграционный P2840 boundary:
- external world tick stable = `true`;
- simulation fallback commit = `true`;
- verified learning scale = `0.84098`;
- receipt-only learning scale = `0.40260`;
- verified identity update scale = `0.77850`;
- receipt-only identity update scale = `0.10011`.

## 5. Regression / validation

PASS:
- TypeScript typecheck.
- P2835 hotpath.
- P2835 persistence/restart.
- P2835 synergy.
- P2835 interaction factorial.
- P2836 reality-first.
- P2836 neural ablation fast.
- P2840 shadow boundary.
- P2840 learning gate.
- P2840 runtime boundary.
- Server smoke.
- Mobile 256 MB capped smoke (V8 heap cap; OS RSS был выше 256 MB, поэтому это НЕ сертификат 256 MB физического RSS).
- Forensics.
- Syntax audit.
- Full audit.
- Architecture audit.
- Hygiene audit.
- Release contract.
- Integrity.
- Release-source verification.
- Canonical manifests.
- Archive manifest.
- Archive integrity.

Не считается PASS:
- `test:big-pass-365:core-causality` — исторически тяжёлый runner не уложился в 300 секунд. Это отдельный verification debt, не доказательство поломки P2840.

## 6. Структурные метрики

Текущее рабочее дерево после финального обновления: 3836 файлов.
Финальный archive manifest: 3836 файлов; missing=[]; hashMismatches=[]; extra=[].

Финальный structural audit:
- activeFiles = 3575;
- duplicateContent = 0;
- duplicateNames = 0;
- pathMarkers = 0;
- staleMarkers = 0;
- canonicalFiles = 520;
- legacySnapshotEntries = 0;
- architecture missing = 0;
- cycles = 0;
- legacyLeakage = 0;
- syntax errors = 0;
- hygiene errors/warnings = 0.

## 7. Code-first объём прохода

Относительно P2836:
- добавлено файлов: 13;
- изменено файлов: 11;
- удалено/переименовано: 1 исторический README-путь после forensics cleanup;
- production source: 7 файлов, 319 changed lines;
- tests: 3 файлов, 103 changed lines;
- code/config area: 442 changed lines;
- общая зафиксированная строковая дельта отслеживаемых изменений: около 543 строк net diff.

Линейная оценка code/config/test доли прохода: ~81% diff.
Это измерение по строкам, а не по человеко-часам.

## 8. Оценка зрелости относительно конечной цели

Это инженерная maturity-оценка, а не процент сознания.

- Runtime / integration: 86/100
- Neural substrate: 72/100
- Reality grounding: 70/100
- Continuity / persistence: 84/100
- Memory: 82/100
- World model: 70/100
- Autonomous agency / goals: 69/100
- Identity / personality: 67/100
- Lifelong external learning: 46/100
- Social organism: 55/100
- Mobile readiness: 67/100
- Causal verification: 62/100
- Consciousness research readiness: 20/100

Обобщённая текущая инженерная готовность архитектуры: ~66/100.

## 9. Что стало лучше

До P2840 основной риск был в том, что внешнее действие и внутренний simulator могли сосуществовать, но simulator transition оставался слишком близок к canonical mutation.

После P2840:
- prediction и fact разделены;
- external evidence имеет больший learning authority;
- слабые actuator receipts не должны быстро переписывать identity;
- external outcome возвращается в perceptual evidence;
- shadow/reality divergence становится сигналом для active perception;
- persistent state включает reality learning/shadow diagnostics.

## 10. Что ещё неполно

1. Physical Android hardware certification не выполнялась на пользовательском телефоне в этом окружении.
2. Некоторые Termux API optional commands отсутствуют в контейнере.
3. Mobile smoke не является доказательством физического RSS <=256 MB.
4. Большая causal matrix P365 требует отдельного оптимизированного запуска.
5. External evidence пока не является полной универсальной postcondition system для каждого actuator class.
6. Vision acquisition и semantic vision по-прежнему различены; acquisition не равен semantic understanding.
7. Lifelong learning на реальном длительном interaction stream ещё требует extended device experiments.

## 11. Следующие большие этапы

### P2841 — External Postcondition Verification

Для каждого action class определить независимую postcondition signature.
Пример:
`requested action -> expected observable effect -> before evidence -> after evidence -> verification result`.

### P2842 — Grounded World Commit

Сделать external evidence источником canonical grounded-world state transition, а не только perceptual evidence. Simulation остаётся prediction branch.

### P2843 — Active Perception on Uncertainty

Развить divergence-triggered perception до action-specific active sensing: выбирать самый дешёвый сенсорный запрос, уменьшающий неопределённость world model.

### P2844 — Long-Horizon Causal Holdout

Запустить matched interventions, holdout outcomes, counterfactual comparison и repeated evidence accumulation.

### P2845 — Android Hardware Runtime

Провести длительный 1h/6h/24h stress cycle на реальном medium phone: battery, thermal, memory, event latency, crash recovery.

### P2846 — Lifelong Reality Learning

A/B/ablation: shadow-only, external-only, hybrid-gated, hybrid+active-perception; фиксировать forgetting, transfer, identity drift, reward calibration и resource use.

### P2847 — Personality Developmental Loop

Подключить verified life events к autobiographical identity revision с bounded plasticity и counter-evidence.

## 12. Research implications

P2840 ориентируется на современные направления:
- actionable embodied world models;
- efficient planning/control abstractions;
- continual test-time memory;
- asynchronous sensing/action/knowledge loops;
- long-horizon verification and recovery.

Исследовательские источники и выбранные для проекта алгоритмические кандидаты сохранены в:
`research/2026-09-20/P2840/`

Главный принцип: новые методы не добавляются ради количества. Каждый метод должен пройти ablation и доказать влияние на organism-level metrics.

## 13. Экспериментальная матрица следующего шага

Минимальная factorial matrix:
A. Reality Shadow Isolation: ON/OFF
B. Evidence Learning Gate: ON/OFF
C. External Evidence Feedback: ON/OFF
D. Divergence-triggered Active Perception: ON/OFF

Итого 16 конфигураций × несколько random seeds.

Основные метрики:
- world-model calibration;
- consequence prediction error;
- neural ablation delta;
- external verification precision;
- memory promotion precision;
- identity drift;
- forgetting;
- transfer;
- latency;
- CPU/RAM;
- battery impact на реальном устройстве.

Нельзя объявлять архитектурный компонент полезным только по наличию PASS; требуется улучшение organism-level metrics при контролируемой ablation.

## 14. Итог

P2840 не пытается доказать наличие сознания. Он закрывает более конкретную инженерную дыру: разделяет предсказание и фактическое последствие, делает силу обучения зависимой от evidence quality и возвращает внешнее consequence в следующий perceptual cycle.

Следующая фундаментальная граница — External Postcondition Verification + Grounded World Commit + Active Perception, после чего возможен полноценный длительный lifelong-learning эксперимент на реальном Android устройстве.

## 15. Финальный runtime-контроль 2026-09-20

После добавления этого отчёта повторно выполнены отдельными процессами:
- `test:smoke:mobile256` = PASS; wall 19.21 s; peak RSS 388372 kB; это V8 heap cap 256 MB, не физическая RSS-сертификация.
- `test:server-smoke` = PASS.
- `test:p2836:reality-first` = PASS.
- `test:p2836:neural-ablation-fast` = PASS, scoreL1=0.042866.
- `test:p2835:current-synergy` = PASS.
- `test:p2835:interaction-factorial` = PASS.
- `test:p2840:shadow` = PASS.
- `test:p2840:learning-gate` = PASS.
- `test:p2840:boundary` = PASS.

Цепной `npm run test:p2840` при запуске вместе с другими тяжёлыми процессами ранее упирался в timeout; отдельные gates PASS, поэтому timeout не принят за functional failure.
