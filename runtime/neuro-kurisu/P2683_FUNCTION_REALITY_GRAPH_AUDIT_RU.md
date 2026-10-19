# Neuro-Kurisu P2683 — Function Reality Graph / Большой проход

## 1. Что реально изменено

P2683 не добавляет декоративный слой поверх существующего организма. Он усиливает механизм проверки самого проекта и закрывает два инженерных разрыва, обнаруженных при P2682:

1. Появился `FUNCTION_REALITY_GRAPH.json` и соответствующий отчёт. Он строит консервативный static-call graph и отделяет runtime-достижимость от test-only, referenced-but-not-runtime-reachable и orphaned кода.
2. Появился `FUNCTION_REALITY_GATE.json`. Он автоматически проверяет критический runtime путь Continuous Cognitive Fabric.
3. P2682/B504 test получил корректный lifecycle cleanup: фоновые RuntimeClock timers теперь не оставляют тест зависшим.
4. `ContinuityLedger` переведён с записи каждого кадра на bounded batching по 4 кадра + явный `flush()`. Это уменьшает постоянный disk I/O и устраняет lingering file operations на завершении smoke.
5. Release metadata переведён на `35.6.83 / P2683`, state schema оставлена `192`, так как новый persistent schema field не потребовался.
6. Package scripts теперь имеют отдельные graph/gate/reality release checks.

## 2. До → после

| Метрика | P2682 | P2683 |
|---|---:|---:|
| Runtime reachability model | отсутствовал как отдельный gate | **есть** |
| Critical path gate | частично ручной | **автоматический PASS** |
| Function-like declarations | ~5003 | **5004** |
| Semantic functions | 4799 | **4799** |
| Strict VERIFIED | 58 исторически зафиксированных в P2682 отчёте | **50 актуально hash-bound** |
| Parameterized PASS | 1042 | **1044 / 1098** |
| Parameterized FAIL | 0 | **0** |
| Runtime reachable functions | не измерялось отдельным графом | **113** |
| Test-only | — | **425** |
| Referenced but not runtime reachable | — | **4545** |
| Orphan | — | **328** |
| Mobile smoke | timeout в предыдущих проходах | **PASS, 30 cycles** |
| Continuity ledger writes | 1 запись / cycle | **batch 4 frames** |

Важно: 50 VERIFIED — это не «падение организма» относительно 58. P2682 использовал исторический набор evidence; P2683 пересобирает evidence заново после изменения теста и source hashes. В новой базе засчитывается только то, что снова прошло актуальную hash-bound проверку.

## 3. Что доказано сейчас

Критический путь имеет 11 независимых structural checks:

- `OrganismRuntime.stepInternal → ContinuousCognitiveFabric.step`
- `OrganismRuntime.init → ContinuousCognitiveFabric.restore`
- runtime diagnostics → fabric diagnostics
- fabric → experience integration
- fabric → memory ingest
- fabric → memory consolidation
- fabric → identity absorb/snapshot
- fabric → dream consolidation
- fabric → personality conflict analysis
- fabric → unified cognitive spine

Все **11/11 PASS**.

Это architectural proof, не behavioural proof и тем более не доказательство сознания. Behavioural proof по-прежнему идёт через semantic evidence.

## 4. Function Reality Graph

Всего declarations в graph: **5410**.

- Runtime reachable: **113**
- Test only: **425**
- Referenced but not runtime reachable: **4545**
- Orphan: **328**

Особенно важен показатель `REFERENCED_NOT_RUNTIME_REACHABLE`: он показывает, что огромное количество кода проекта существует и вызывается где-то, но пока не доказано, что он входит в основной runtime closure. Это теперь главный рабочий backlog, а не повод автоматически считать модули мёртвыми.

Graph сознательно не считает exported функцию runtime-root просто потому, что она экспортирована. Это устраняет прежнее завышение reachability.

## 5. Function verification

Semantic coverage:

- total: **4799**
- VERIFIED: **50**
- INTEGRATION_ONLY: **10**
- UNSAFE_TO_AUTO_RUN: **312**
- UNVERIFIED: **4431**

Parameterized execution:

- attempted: **1098**
- passed: **1044**
- failed: **0**
- skipped as unsafe: **40**
- lifecycle-needed: **9**

Следовательно, проект не должен продолжать увеличивать процент «готовности» простым написанием новых классов. Главный backlog теперь — переход от `UNVERIFIED/INTEGRATION_ONLY` к независимому behavioural evidence.

## 6. Mobile / Termux

30-cycle smoke под:

`node --max-old-space-size=256`

прошёл. Последний измеренный запуск: **~34.1 s**, RSS пик около **372 MB**.

Это показывает две вещи одновременно:

1. Runtime способен завершить 30 циклов и корректно остановиться.
2. Для среднего телефона архитектура всё ещё слишком прожорлива для долгой непрерывной работы. RSS выше V8 old-space означает, что `256 MB` нельзя трактовать как полный процессный лимит.

Следующий performance backlog: уменьшить resident state и стоимость history/event/evidence structures, а не просто снижать частоту циклов.

## 7. Что было исправлено в lifecycle

P2682 smoke мог выполнять весь тест и не завершать Node process из-за оставшихся runtime/file operations. Это теперь воспроизводится и контролируется: RuntimeClock уже использовал unref timers, а ContinuityLedger дополнительно стал buffered.

Теперь `OrganismRuntime.stop()` останавливает clocks и инициирует ledger flush. `OrganismRuntime.flush()` явно flush-ит и core state, и continuity ledger.

## 8. Release gates

Подтверждены отдельно:

- TypeScript: **PASS**
- B504 Continuous Cognitive Fabric: **PASS**
- Function Reality Graph critical path: **PASS**
- Function Reality Gate: **PASS**
- P2679 learned latent transition: **PASS**
- P2681 hierarchical policy: **PASS**
- Mobile organism smoke: **PASS**
- Architecture: **PASS**
- Integrity: **PASS**
- Source hygiene: **PASS**
- Release contract: **PASS**
- Release source: **PASS**
- Forensics: **PASS**
- Executable syntax: **PASS**
- Archive manifest: **PASS**

## 9. Что всё ещё не сделано

### A. Главная задача

Сертифицировать runtime-critical functions, которые сейчас находятся в `REFERENCED_NOT_RUNTIME_REACHABLE` и `UNVERIFIED`. Здесь нельзя механически подключить всё: сначала нужно разделить код на actual runtime, optional subsystem, research-only, benchmark-only и legacy-compatible surface.

### B. OrganismCore

Большие файлы всё ещё являются архитектурным bottleneck. Следующий safe refactor должен выделить domain services вокруг core без изменения state contract.

### C. Mobile memory

RSS ~372 MB на 30 cycles остаётся высоким для среднего телефона. Нужен следующий слой bounded retention: event fabric, evidence bus, autobiographical traces, model histories и large diagnostic snapshots.

### D. Human-like cognition

Проект всё ещё не демонстрирует человеческое сознание. Он имеет вычислительные механизмы continuity, self-state, memory, prediction, planning, identity, active learning и evidence gating, но это функциональные компоненты, не доказательство субъективного опыта.

## 10. Следующий большой проход

**P2684 — Runtime Closure + Critical Cognitive Surface.**

Порядок:

1. Извлечь все runtime-reachable функции из graph.
2. Разделить 4545 referenced-not-runtime-reachable по доменам.
3. Найти среди них скрытые dynamic dispatch / registry / dependency injection пути.
4. Добавить allowlisted dynamic edges там, где они доказаны.
5. Удалять только функции без architectural owner, test owner и runtime purpose.
6. Для critical cognitive functions построить lifecycle tests: construct → update → snapshot → restore → replay → behavioural invariant.
7. Разделить mobile memory into hot/warm/cold tiers.
8. Провести новый end-to-end runtime holdout.

## 11. Принцип P2683

**Код не считается частью организма только потому, что он существует.
Функция не считается внедрённой только потому, что тест её импортирует.
Runtime reachability не равна behavioural correctness.
Behavioural correctness не равна сознанию.**

Именно эта лестница доказательств теперь становится постоянным правилом проекта.
