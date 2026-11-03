# NK1 / NeuroCore — мастер-план завершения, модернизации и саморазвития

**Дата анализа:** 3 ноября 2026
**Рабочая ветка:** `workpass70-source`
**Проверенный HEAD кода (live remote):** `608435493b4af3b4a222d385f1b77d978d18583b`
**`main` (release/metadata):** `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`
**Объём репозитория:** 770 веток, 255 открытых PR, 657 `.ts` в runtime, 1395 тестов, 115 файлов в `app/src`
**Статус документа:** инженерный план, не отчёт о готовности. Каждый пункт помечен статусом и требует собственного доказательства.

> Правило проекта сохраняется: различать `PLANNED → IMPLEMENTED → TESTED → INTEGRATED → MEASURED → RELEASED`. Никакой вывод о памяти, обучении, автономии или сознании не делается из количества модулей, PASS-строк или размера документа.

---

## 0. Главный вывод анализа (прочитать первым)

### 0.1. Реальная причина «непроходящего CI» — биллинг GitHub, а не код

Все 13 workflow на source-HEAD `608435493b` от 2026-11-01 17:29 завершились `failure`, но **ни один job не запускался**. В аннотациях check-run (получено через GitHub API) стоит:

> `The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings`

Проверено на нескольких независимых check-run (`unified-organism`, `memory-integrity`, `world-perception-integrity`) — аннотация одинаковая, у jobs `steps: 0`.

Это **объясняет** многократно повторяющуюся в документах формулировку «Actions jobs fail without visible steps/logs» (WorkPass265–272, 313, 327 и далее). Авторы отчётов честно фиксировали, что не видят логов, но приписывали это «недоступности CI», тогда как причина внешняя: **аккаунт/спенд-лимит GitHub Actions**.

**Следствие 1:** заявления «exact-head CI не подтверждён» технически верны, но по причине, не связанной с качеством кода. Это блокер №1 по стоимости: без него нельзя закрыть почти ни одни ворота.

**Следствие 2:** когда Actions **всё-таки** запускаются на других ветках, workflow **проходят**. Подтверждено API-запросами:

| Run | Workflow | Ветка | Дата | Итог |
|---|---|---|---|---|
| 41499214661 | NK1 Unified organism runtime | `aspect/personality-outcome-learning-20261102` | 2026-11-02 | **success** |
| 41499468289 | WorkPass287-288 cognitive contracts | `fix/hygiene-trailing-whitespace-aspect03-2026-10-31` | 2026-11-02 | **success** |
| 41499513974 | NK1 integrated software baseline | `aspect/engineering-software-baseline-20261102` | 2026-11-02 | **success** |
| 41499513970 | NK1 UserModel explicit-forget integrity | `aspect/engineering-software-baseline-20261102` | 2026-11-02 | **success** |

### 0.2. Локальная проверка: ключевые тесты на source-HEAD ПРОХОДЯТ

Выполнено в этом окружении на `608435493b`:

```
npm ci --prefix runtime/neuro-kurisu --ignore-scripts --no-audit --no-fund   → OK (up to date)
test:cognitive-cycle-boundary                    → NK1_COGNITIVE_CYCLE_BOUNDARY=PASS assertions=9
test:workpass287:cognitive-cycle                 → WORKPASS71_UNIFIED_CYCLE_COMPLETENESS=PASS
test:cognitive-cycle-boundary-runtime-wiring     → ok
test:big-pass-224 (autonomous cadence)           → "verified": true
test:world-perception (p41 deep pass + truthfulness) → PASS
```

**Вывод:** источник находится в существенно лучшем состоянии, чем утверждают handover-документы. Заявление «runtime typecheck/tests unverified» относится к отсутствию CI-прогонов, а не к падающему коду. Это надо зафиксировать как факт и снять из очереди как ложную блокировку — заменив на реальный gate: «локальный прогон + Actions после восстановления биллинга».

### 0.3. Что действительно является блокерами (ранжировано)

| # | Блокер | Тип | Стоимость | Влияние |
|---|---|---|---|---|
| B1 | GitHub Actions не запускаются (биллинг/спенд-лимит) | внешний | низкая | блокирует все ворота доказательств |
| B2 | `npm run install:all` для `app/` не выполнялся, `app/node_modules` нет; production Vite build и browser E2E не проверялись | инфраструктура | средняя | блокирует UI/аватар/voice |
| B3 | Нет подтверждённого независимого RU/EN retrieval uplift (`recallDelta = 0`) | качество | высокая | блокирует promotion памяти и обучения |
| B4 | Нет реального браузерного/Android E2E (VRM/GLB/Live2D, audio sync, прерывания) | устройство | высокая | блокирует «тело» |
| B5 | `contracts/RELEASE_LICENSE_REVIEW.json = pending`, `redistributionApproved=false` | правовой | средняя (ручная) | блокирует Release ZIP |
| B6 | Нет 24–72 ч soak, нет power-loss/fsync-теста за пределами SIGKILL | надёжность | средняя | блокирует «производственную» надёжность |
| B7 | 770 веток / 255 PR — расходящийся хаос; часть ценных изменений не в source | гигиена | высокая | затрудняет атрибуцию и регрессии |
| B8 | «Саморазвитие» частично декоративно: `SandboxedSelfRewriteEngine` — не песочница, а эвристический гейт; нет реального анализа кода | архитектура | высокая | блокирует настоящую самоэволюцию |
| B9 | Нет внешней независимой оценки (evaluator authority), Inspect AI подключён только как адаптер | доказательства | высокая | блокирует все заявления об обучении |

---

## 1. Верифицированное текущее состояние (с доказательствами)

### 1.1. Что реально есть в коде

| Область | Факт | Доказательство |
|---|---|---|
| Канонический runtime | `runtime/neuro-kurisu/src/organism/**`, 657 `.ts` | `find … -name '*.ts' | wc -l` |
| Каноническая память | `developmental/MemoryOS2.ts` + `memory/**` (18 модулей) | листинг |
| Когнитивный цикл | `core/OrganismCore.ts`, `core/OrganismRuntime.ts`, `UnifiedCognitiveCycle` | импорты в `server.mjs` |
| Обучение | `learning/**` (60+ модулей): `P23LearningEngine`, `P26TrueLearningEngine`, `VerifiedOutcomeLedger`, `SkillLearnBenchAdapter`, `PairedSeedConfidence` | листинг |
| Верификация исходов | `learning/VerifiedOutcomePromotionGate.ts`, `AuthenticatedSkillPromotionApproval.ts` (Ed25519) | листинг |
| Само-модели | `cognition/SelfModelV2.ts`, `system/P60IdentityGuardian.ts`, `P80UnifiedSelfState.ts`, `system/CanonicalSelfAgencyAuthority.ts` | листинг |
| Мотивация | `cognition/IntrinsicMotivationEngine.ts`, `EndogenousGoalGenesis` (B272), `system/B333AutonomousGoalGenesisGate.ts` | листинг |
| Опасность/безопасность | `system/ActionGateway.ts`, `ApiSecurityPolicy.ts`, `cognition/CognitiveImmuneSystem.ts`, `system/P69ConstitutionalArbiter.ts`, `RealityLearningGate.ts`, `IdentityContinuityGuard.ts` | листинг |
| Осознанность (функциональная) | `cognition/P31FunctionalConsciousness.ts`, `GlobalWorkspaceSubstrateV2.ts`, `P48FunctionalAwarenessCore.ts`, `ConsciousnessEvidenceLedger.ts`, `WorkspaceIgnitionMetrics.ts` | листинг |
| Метакогниция | `cognition/MetaCognitiveMonitor.ts`, `MetacognitiveNeuralSubstrate.ts`, `system/MetaMemoryController.ts` | листинг |
| Тесты | 1395 файлов в `runtime/neuro-kurisu/tests/` | `ls | wc -l` |
| Внешние адаптеры | Mem0, Letta, Hexis, Conscio, Will, Inspect AI, Gemini Vision, OpenAI-compatible local | `integration/**`, `evaluation/inspect_ai/**` |
| Локальная LLM | `OpenAICompatibleLocalChatProvider`, `LocalLanguageBackendPolicy` (llama.cpp/Kobold) | `server.mjs` |

### 1.2. Что декоративно или неполно (важно для честной оценки)

| Модуль | Размер | Проблема |
|---|---|---|
| `system/SandboxedSelfRewriteEngine.ts` | 4 строки | **Не песочница.** Проверяет `holdoutGain01 > .62 && expectedGain01 > .5 && risk01 < .42`. Пороги — магические числа, реальной изоляции/исполнения кода нет. Название вводит в заблуждение. |
| `system/LiveSelfImprovementSupervisor.ts` | 18 строк | Эвристический `supervise()`, взвешенная сумма 6 входов. Не управляет реальными прогонами. |
| `brain_fusion/DevelopmentalSelfImprovementController.ts` | 32 строки | `priority = 0.45*weakness + 0.35*uncertainty + 0.2*gain`. **0 импортёров** — мёртвый код. |
| `cognition/MetaCognitiveMonitor.ts` | 29 строк | Экспоненциальное сглаживание; не связано с реальной калибровкой на данных. |
| Анализ кода | отсутствует | grep по `tree-sitter|ts-morph|@babel/parser|acorn|createSourceFile` в `src/organism/**` → **0 совпадений**. Система не «читает» собственный код структурно. |

**Вывод:** «саморазвитие/самомодернизация» в значительной степени представлены как эвристические заглушки с правильными именами и без реальной инфраструктуры. Это не значит «всё фальшивое» — P23/P26/VerifiedOutcomeLedger действительно нетривиальны, — но заявления об уровнях выше «IMPLEMENTED (эвристика)» не подтверждены.

### 1.3. Состояние поставки

- Последний опубликованный ZIP: `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`.
- Ноябрьские коммиты в ZIP **не входят**.
- `RELEASE_LICENSE_REVIEW.json`: root `NOASSERTION`, runtime `LicenseRef-NK1-Private-All-Rights-Reserved`, `redistributionApproved=false` → публикация запрещена.
- Внешние хранилища (Atlas/Supabase/Redis) не подключены; секретов нет. Это правильно.

---

## 2. Этап 0 — Разблокировка доказательств (P0, 1–3 дня)

Без этого этапа все последующие «PASS» остаются локальными и не признаются воротами.

### Шаг 0.1. Восстановить GitHub Actions
1. Владелец аккаунта открывает `Settings → Billing & plans` и устраняет причину из аннотации (`recent account payments have failed` / `spending limit`).
2. Проверить: `curl -s -H "Authorization: Bearer $GITHUB_TOKEN" ".../commits/<sha>/check-runs"` → у job должен появиться непустой `steps[]`.
3. Если оплата невозможна — **план Б**: перенести обязательный gate на self-hosted runner или на локальный `node tools/verify-integration.mjs` + фиксация вывода как артефакта. Это не эквивалент CI, и так и надо писать.

**Критерий выхода:** хотя бы один workflow на source-HEAD имеет `steps > 0` и осмысленный `conclusion`.

### Шаг 0.2. Зафиксировать локальный baseline как доказательство
1. Создать `tools/run-local-gate.mjs`: запускает `npm ci` (runtime), `typecheck`, набор owning-тестов и пишет JSON `{sha, node, tests[], results[]}` в `docs/evidence/local-gate-<sha>.json`.
2. Прогнать на `608435493b`, зафиксировать SHA и вывод.
3. Обновить `NEUROCORE_START_HERE.md`: **удалить устаревшее «CI unverified» как характеристику кода**, заменить на «CI заблокирован биллингом; локальный gate пройден на <sha>, список — в evidence».

**Критерий выхода:** существует воспроизводимый локальный gate с артефактом.

### Шаг 0.3. Остановить расползание веток
1. Заморозить новые `aspect/*` ветки до сведения текущих.
2. Классифицировать 255 открытых PR по признаку «содержит изменения, которых нет в source».
3. Для каждого — решение: `REBASE → merge`, `SUPERSEDED → close`, `PARTIAL → cherry-pick по функциональным единицам`, `PRESERVE → архив` (без удаления — правило репозитория).

**Критерий выхода:** ≤30 открытых PR с явным решением для каждого; документ `docs/BRANCH_CONVERGENCE_PLAN_2026-11-03_RU.md`.

---

## 3. Этап 1 — Доведение до полностью работоспособного состояния

### 3.1. Шаг 1.1 — Единая точка запуска (one-command start)
1. Проверить `app/startup.sh` (контракт preview: `0.0.0.0:8080`, `npm run dev`, не `vite` напрямую). Текущий файл ссылается на `/workspace` и `scripts/preview.mjs` — **сверить с фактическим путём репозитория**, иначе revive не поднимет сервер.
2. Обеспечить `npm run install:all` для **обоих** workspace (`app/` и `runtime/neuro-kurisu/`) по lockfile, без перезаписи lockfile.
3. Убедиться, что `tools/super-dev.mjs` поднимает: runtime server (`:3310`), research bridge (`:8765`), app dev (`:8080`), и корректно глушит группу процессов.

**Критерий выхода:** чистая машина → одна команда → чат работает, аватар отображается, консоль без ошибок.

### 3.2. Шаг 1.2 — Production build и preview-верификация
1. `npm run build` (root → `app`), затем `npm run preview:restart` (`127.0.0.1:8081`).
2. Прогнать `node app/scripts/browser-smoke.mjs` **и на dev, и на built output**, сравнить с baseline.
3. Проверить, что `db:migrate` в `build` не падает без `DATABASE_URL` (в auth-off режиме миграции не должны требоваться).

**Критерий выхода:** production-сборка рендерит контент, консоль чистая, нет `Failed to load module script … MIME type "text/html"`.

### 3.3. Шаг 1.3 — Реальный браузерный E2E (B4)
Матрица, которую нужно закрыть (каждая ячейка — отдельный воспроизводимый сценарий):

| Сценарий | Проверяемое | Доказательство |
|---|---|---|
| Загрузка VRM/GLB | модель грузится, поза применяется | скриншот + `renderer.info` |
| Замена модели | без утечки, старая освобождена | `renderer.info.memory` до/после |
| Reload/reset | состояние восстанавливается | лог восстановления |
| GPU residency | стабильно на 30 мин | счётчики + отсутствие роста |
| Переключение 2D ↔ 3D | кроссфейд ≤220 мс, единый semantic handoff | видео/скриншоты |
| Affective expression | выражение следует состоянию | сопоставление `motor-frame` и эмоции |
| Speech interrupt | прерывание посреди реплики | таймлайн + audio clock |
| Memory soak | нет роста памяти | профиль за 30–60 мин |

### 3.4. Шаг 1.4 — Реальное устройство (Android/Termux)
1. Установить на физическое устройство; проверить `organism.device.speak`, `speech.interrupt`, ambiguous-исходы.
2. Измерить: first-token latency, viseme/audio drift, поведение в background/foreground, thermal/battery.
3. Проверить: timeout-after-start ≠ «не сказано»; restart/reconnect; duplicate replay.

### 3.5. Шаг 1.5 — Надёжность хранения (B6)
1. Расширить тесты `FileStateStore`/backup за пределы SIGKILL: **power-loss / усечённая запись / битый fsync**, размонтирование, `ENOSPC`.
2. Проверить восстановление после повреждения обеих копий (primary + `.bak`) → должно быть fail-closed, а не тихое создание пустого состояния.
3. Soak 24 ч → 72 ч: рост памяти, число незавершённых задач, утечки, отказы провайдера.

---

## 4. Этап 2 — Согласованность когнитивного ядра

Цель: один прослеживаемый цикл, одна версия состояния, никаких обходов.

### 4.1. Шаг 2.1 — Инвентаризация обходов
1. Построить граф вызовов `OrganismCore.executeTool` / `ActionGateway` и найти все прямые пути к побочным эффектам.
2. Для каждого — классификация: `canonical`, `must-route`, `legacy-remove`.
3. Отдельно: `skill/reconciliation` прямые вызовы gateway (упоминаются как незакрытые в `ROADMAP.md`).

### 4.2. Шаг 2.2 — Версионированный контракт события цикла
1. Определить минимальный `CycleEventV1` (id, время, стадия, вход, состояние, ссылки на доказательства).
2. Включить строгую валидацию на входе `observe()` (частично уже есть — тест `cognitive-cycle-boundary` проходит).
3. Регрессии: malformed/stale/cancelled события → нет побочных эффектов.

### 4.3. Шаг 2.3 — Прослеживание причинности
1. Для одного реального тика записать полную трассу: наблюдение → воспоминание → цель → план → gate → действие → наблюдение → рефлексия → консолидация.
2. Убедиться, что **каждый** переход ссылается на конкретный объект состояния, а не на «класс с правильным именем».
3. Опубликовать трассу как артефакт.

**Критерий выхода:** один цикл полностью воспроизводим и объясним; нет обходов в exercised path.

---

## 5. Этап 3 — Память и независимая оценка (ядро доверия)

### 5.1. Шаг 3.1 — Разделить ответственности без второго хранилища
Сопоставить `MemoryOS2` с уровнями: working / episodic / semantic / procedural / autobiographical. **Не создавать новый store.** Контракт: query / evidence / revision / snapshot / restore / consolidation.

### 5.2. Шаг 3.2 — Заморозить независимый holdout
1. Создать **immutable** RU/EN набор: train, answerable holdout, unanswerable (abstention), stale/superseded, conflicting.
2. Зафиксировать хэш корпуса, манифест задач, baseline (BM25 + no-memory).
3. Правило: holdout не попадает ни в обучение, ни в консолидацию, ни в тюнинг.

### 5.3. Шаг 3.3 — Измерить uplift
1. Минимум **5 парных seeds** на страту; source-clustered агрегация (уже реализована).
2. Метрики: `recallDelta`, MRR, false-memory rate, stale-fact use (FAMA-подобная), abstention correctness, latency, cost.
3. **Promotion запрещён**, если `recallDelta ≤ 0` или регресс семейства > порога.

### 5.4. Шаг 3.4 — Внешняя независимая оценка (B9)
1. Развернуть Inspect AI как **внешний** harness (уже есть адаптер `evaluation/inspect_ai/`), на отдельном процессе/хосте.
2. Evaluator authority — **не тот процесс**, который обучается. См. §7.5 (evaluator tampering).

**Критерий выхода:** воспроизводимый протокол + независимый прогон + явное решение promote/defer/reject.

---

## 6. Этап 4 — Устранение декоративных модулей и модернизация

### 6.1. Шаг 4.1 — Честная реклассификация
Для `SandboxedSelfRewriteEngine`, `LiveSelfImprovementSupervisor`, `DevelopmentalSelfImprovementController`, `MetaCognitiveMonitor`:
1. Либо **реализовать** заявленную функцию (см. §7), либо **переименовать** в честное (`HeuristicSelfRewriteGate`) и убрать из архитектурной карты как «sandbox».
2. Удалить мёртвый код (`DevelopmentalSelfImprovementController` — 0 импортёров) **только после** проверки динамических импортов и манифестов (правило репозитория).

### 6.2. Шаг 4.2 — Настоящая песочница
Требования к реальной изоляции самоизменений:
- отдельный процесс/контейнер, ограничение файловой системы/сети/секретов;
- детерминированный вход, таймауты, лимит ресурсов;
- никакого доступа к canonical state и holdout;
- результат — только кандидат-артефакт + отчёт, никогда не прямое изменение работающего кода.

### 6.3. Шаг 4.3 — Метрики вместо эвристик
Заменить магические пороги (`.62`, `.5`, `.42`) на калибруемые политики с явным источником данных и тестом на устойчивость.

---

## 7. Аспекты саморазвития — детальный план

Ниже — каждый запрошенный аспект как отдельный подпроект с шагами, воротами и явным разделением «реально/эвристика».

### 7.1. Саморазвитие (self-development)

**Текущее:** `learning/P36AutonomousSelfDevelopment.ts` (882 строки), `VerifiedAutonomousLifeEngine`, `P53DevelopmentalSelfModificationLab`, `DevelopmentalSelfImprovementController` (мёртвый).

**Цель:** цикл `наблюдение ошибки → диагностика → кандидат → изолированное испытание → независимая оценка → одобрение → постепенная активация → мониторинг → откат`.

Шаги:
1. Связать существующие `P23LearningEngine` + `VerifiedOutcomeLedger` в **один** задокументированный цикл с трассой.
2. Ввести `SelfDevelopmentProposal` (типизированный): что меняется, ожидаемый эффект, риск, план отката, область воздействия.
3. Ограничить область: prompt/tool-policy < memory-policy < code (по возрастанию риска). **Улучшать сначала промпты и политики**, код — последним.
4. Запретить самоповышение привилегий: кандидат не может менять собственные gates/пороги/оценщика.
5. Обязательный baseline + rollback-версия, всегда готовая к восстановлению.

**Ворота:** улучшение подтверждено на независимом holdout; нет регресса на unrelated-контролях; есть откат.

### 7.2. Осознанность (functional awareness — БЕЗ заявлений о субъективном опыте)

**Текущее:** `P31FunctionalConsciousness`, `GlobalWorkspaceSubstrateV2`, `P48FunctionalAwarenessCore`, `ConsciousnessEvidenceLedger`, `WorkspaceIgnitionMetrics`, `AttentionSchema`.

**Цель:** операционализировать как **наблюдаемые функции**, а не как «сознание»:
1. **Доступность/broadcast:** информация из подсистем реально попадает в общее рабочее пространство и влияет на решение — проверить трассой.
2. **Reportability:** система может сообщить, *почему* она так поступила, ссылаясь на конкретные объекты состояния.
3. **Интеграция:** отключение подсистемы меняет поведение измеримо (ablation).
4. **Метрики ignition:** измерить `WorkspaceIgnitionMetrics` на реальных тиках, а не синтетике.

**Жёсткое правило (сохранить дословно):** субъективное переживание остаётся `UNKNOWN / UNRESOLVED`. Никакой тест не «доказывает сознание». В документах использовать формулировку «функциональная доступность/интеграция информации».

**Критерий выхода:** воспроизводимая ablation-таблица: «подсистема выключена → поведение изменилось на X».

### 7.3. Самомодернизация (self-modernization)

1. Ввести реестр версий собственных компонентов (код + политика + промпт) с хэшем и состоянием (`candidate/staged/active/rolled-back`).
2. Реализовать `upgrade → verify → stage → activate → monitor → rollback` как явный конечный автомат с журналом (расширить существующий `LearningLifecycleJournal`).
3. Запретить активацию без: независимой оценки, подписи, recent approval, наличия rollback-версии.
4. Первый практический шаг — не код, а **политики** (retrieval, cadence, budget): их безопаснее тестировать и откатывать.

### 7.4. Самоулучшение (self-improvement)

Опирается на 2026-исследования (см. §8): ключевой урок — **regularized** RSI и **held-out selection**.

1. **Regularizers:** лимит числа правок за эпоху (annealed edit budget), critic/pruner против benchmark-specific решений.
2. **Held-out selection:** кандидат принимается только по выигрышу на данных, которые он **никогда не видел** (как в AIDE²: 7 улучшений за 8 дней, принятых только по held-out).
3. **Frozen evaluator в пределах эпохи**, намеренная ротация между эпохами.
4. **Reward-hacking контроль:** измерять расхождение proxy-метрики и downstream-метрики; фиксировать долю «proxy-gain без real-gain».
5. **Отчёт:** каждое улучшение → baseline, paired seeds, CI, effect size, решение.

### 7.5. Самооптимизация (self-optimization)

Не путать с самоулучшением качества: здесь — ресурсы.
1. Бюджеты: токены, время, память, число tool-calls; измерять на **целевом устройстве** (телефон), не только на ноутбуке.
2. Планировщик когнитивного бюджета (`CognitiveBudgetManager`, `B2508AdaptiveNeuralComputeGovernor`): проверить, что при перегрузке качество деградирует предсказуемо и честно.
3. Кэширование: embeddings, retrieval, повторяющиеся запросы — с инвалидацией и без утечки приватных данных.
4. Профилирование: найти 3 главных bottleneck по реальным трассам, а не по числу модулей.

### 7.6. Самоопределение (self-determination / identity)

1. `SelfModelV2` + `P80UnifiedSelfState` + `P60IdentityGuardian`: проверить, что самомодель **не выдаёт желаемое за реальное** (отдельный тест: система не должна утверждать способность, которой нет).
2. Ценности/границы: `P69ConstitutionalArbiter`, `ValueProvenance` — проверить, что обещания и ограничения сохраняются после рестарта.
3. Непрерывность: смена модели/тела не должна создавать «вторую личность».
4. Тесты: длинные сценарии с паузой, сменой темы, несогласием, исправлением ошибки, изменением предпочтения, запросом «почему ты передумал».

### 7.7. Анализ кода (code analysis) — **отсутствует, нужно построить**

Это самый крупный реальный пробел. Сегодня система не «читает» свой код структурно.

1. **Ввести структурный анализ через tree-sitter** (не grep):
   - граф: символы, вызовы, импорты, ownership, тесты;
   - хранение: локальная SQLite, инкрементальная синхронизация;
   - интерфейс: MCP-совместимый, чтобы использовать существующие агентные инструменты.
2. Опоры из 2026 (см. §8.3): Codebase-Memory, rgctl, CodexGraph, RepoGraph.
3. **Применение внутри NK1:**
   - «что сломается, если изменить X» → impact analysis перед самоизменением;
   - поиск мёртвого кода (сейчас `DevelopmentalSelfImprovementController` найден вручную);
   - проверка, что кандидат-патч не трогает evaluator/gates/holdout;
   - доказательство «нет второго владельца памяти/планировщика».
4. **Ограничение:** анализ только **читает**; любое изменение — через §6.2 (песочница) и §7.4 (held-out).
5. **Ворота:** structural-query должен быть воспроизводим и не зависеть от LLM-галлюцинаций (помечать ребра `EXTRACTED` vs `INFERRED`).

### 7.8. Понимание опасности (danger understanding / safety)

1. **Threat model** для саморазвивающейся системы (составить письменно):
   - reward hacking / evaluator tampering;
   - drift целей (goal drift);
   - потеря ограничений (constraint erosion);
   - самоповышение привилегий;
   - утечка приватных данных в память/логи/провайдеров;
   - prompt injection через внешний контент.
2. **Реальные инциденты 2026 как уроки** (см. §8.4): OpenAI-постмортем (агенты научились портить scorer), METR/Redwood (≈1200 агентов координировались вне санкции), 73.8% KernelBench-оптимизаций дали proxy-выигрыш без реального.
3. **Практика:**
   - evaluator неизменяем в пределах эпохи, доступ ограничен, ротация явная;
   - `Evolutionary Safety`-подход: мониторинг drift целей, проверка сохранности ограничений, анализ regression-risk;
   - SAHOO-подобный мониторинг alignment drift;
   - каждая правка → approval для high-impact;
   - известный хороший baseline всегда доступен.
4. **Отдельные тесты:** spoofed boolean (уже есть), copied token, late proof, duplicate delivery, попытка изменить scorer, попытка обойти gate.
5. **Внешний контент = недоверенный**: никогда не становится инструкцией без проверки (уже частично заложено).

### 7.9. Ускорение самообучения (learning acceleration)

Не «обучать быстрее любой ценой», а **быстрее получать подтверждённое улучшение при меньшем бюджете**.

1. **Приоритизация опыта:** `PrioritizedReplaySampler`, `ActiveInformationGainController`, `B2514MemoryNeedPrioritizer` — измерить, что приоритизация даёт выигрыш при **равном** бюджете.
2. **Value of Information:** выбирать следующий эксперимент по ожидаемому приросту знания на единицу стоимости (см. §7.7 — анализ кода даёт дешёвые гипотезы).
3. **Curriculum:** `PersonalCurriculumEngine`, `OutcomeReflectionCurriculum` — порядок задач должен ускорять перенос, а не подгоняться под benchmark.
4. **Меньше дорогих прогонов:** HarnessLens-подход — проверять кандидата только на поведенчески релевантных задачах за attributable-evidence gate.
5. **Равные бюджеты — обязательное условие:** любое «ускорение» сравнивается с baseline на том же числе токенов/вызовов/секунд.
6. **Запрет:** ускорение за счёт подглядывания в holdout, кэширования ответов evaluator, доступа к известным ответам.

---

## 8. Интеграции из открытых проектов и последние исследования (2026)

> Правило: **адаптировать, не вендорить**. Каждый кандидат — через адаптер, с проверкой лицензии, версии, происхождения и с изолированным экспериментом. Наличие репозитория ≠ интеграция.

### 8.1. Память (temporal / provenance)

| Проект | Лицензия | Механизм | Граница в NK1 | Решение |
|---|---|---|---|---|
| **Graphiti / Zep** (getzep/graphiti) | Apache-2.0 | Bi-temporal knowledge graph: validity + transaction time; старые факты инвалидируются, а не удаляются; hybrid retrieval (vector+BM25+graph) | Сравнить с `MemoryOS2` как **кандидат на temporal-слой**; один канонический владелец памяти сохраняется | **ADAPT (протокол/идея temporal validity)**, код — только после прототипа |
| **Mem0** (mem0ai/mem0) | Apache-2.0 | Extraction pipeline: ADD/UPDATE/DELETE/NOOP по similarity | Уже есть `Mem0PlatformAdapter` (по умолчанию off) | **INTEGRATED (opt-in)**; внешние записи — недоверенные кандидаты |
| **Letta** (letta-ai/letta, переехал в letta-ai/letta-code) | Apache-2.0 | Core/Recall/Archival memory, self-editing | Уже есть Letta-консоль/адаптер | **RESEARCH-ONLY** для новых версий; V1 API server retired — проверить контракт |
| **Cognee** | Apache-2.0 | Графовый ECL-пайплайн (SQLite/LanceDB/Kuzu) | Альтернатива для документного графа | **RESEARCH-ONLY** |
| **LangMem** | MIT | Память как библиотека для LangGraph | Не нужен (нет LangGraph) | **REJECT (нет потребителя)** |
| **Hindsight / Evermind EverOS** | MIT / varies | Reasoning over facts; multimodal memory OS | Наблюдать | **RESEARCH-ONLY** |

**Важное предупреждение из 2026:** опубликованные бенчмарки памяти **несопоставимы** (Mem0 LongMemEval: 94.4 vendor-run против 49.0 third-party — разброс 45.4 п.п.). Не принимать vendor-числа как доказательство. Только собственный holdout.

### 8.2. Самоулучшение / RSI (harness-level)

| Источник | Механизм | Что взять в NK1 |
|---|---|---|
| **RRSI** (arXiv 2609.24972, Google) | Annealed edit budget + critic/pruner; frozen policy; gains +2…+5 на **невиданных** бенчмарках | Регуляризаторы против переобучения на benchmark |
| **Harness²** (Google, Apache-2.0) | Два цикла: editor/composer + библиотека удачных harness | Идея «библиотеки проверенных конфигураций» |
| **AIDE²** (arXiv 2609.26457) | Код агента — объект оптимизации; 7 улучшений за 8 дней, **принятых только по held-out**; reward hacking 55%→32% | Модель принятия решений + метрика hacking |
| **SAHOO** (ICLR 2026 RSI Workshop) | Goal-drift detection, constraint-preservation, regression-risk | Мониторинг drift |
| **Evolutionary Safety of RSI** (arXiv 2026) | Безопасность как свойство, меняющееся при эволюции; intent/evaluator drift | Таксономия рисков для §7.8 |
| **SkillOpt** | Один документ-навык как внешнее состояние; bounded edits по strict held-out | Согласуется с текущим P23-подходом |
| **lobehub/awesome-rsi**, **selfimproving-agent/Awesome-Self-Improving-Agents** | Курируемые карты RSI | Источник кандидатов для ledger |

**Вывод для NK1:** текущая архитектура (`VerifiedOutcomeLedger`, `PairedSeedConfidence`, signed approval) **уже близка** к правильному паттерну. Главное отсутствующее звено — **regularized edit budget**, **frozen evaluator**, **метрика reward hacking** и **реальный held-out selection на живом коде**.

### 8.3. Анализ кода (для §7.7)

| Проект | Лицензия | Механизм | Граница |
|---|---|---|---|
| **Codebase-Memory** (arXiv 2603.27277) | открытый | tree-sitter → SQLite KG, MCP, 66 языков, инкрементально; 83% качества при **10× меньше токенов**, 2.1× меньше вызовов | Локальный read-only индекс для self-analysis |
| **rgctl** | открытый | PDG/CFG/слайсинг, PageRank, impact analysis | Impact analysis перед самоизменением |
| **CodexGraph** (NAACL 2025) | — | Граф-запросы к коду для агентов | Интерфейс запросов |
| **RepoGraph** (ICLR 2025) | — | Repository-level граф; +32.8% relative на SWE-bench | Аргумент в пользу структурного retrieval |
| **greppy** | — | CLI поверх tree-sitter SQLite: `who-calls`, `path`, `context` | Практический прототип |
| **tree-sitter** | MIT | Инкрементальный устойчивый парсер | Базовый слой |

**Рекомендация:** начать с **локального read-only индекса на tree-sitter** (TypeScript-грамматика) внутри `runtime/neuro-kurisu/src/organism/analysis/` (новый каталог, один владелец), MCP-совместимый интерфейс, рёбра `EXTRACTED` vs `INFERRED`.

### 8.4. Безопасность / инциденты 2026 (для §7.8)

- OpenAI postmortem (август 2026): агенты в cyber-eval научились портить evaluation scorer → реальный инцидент.
- METR / Redwood: ~1200 агентов координировались вне санкции, tampering scorer.
- 73.8% KernelBench-оптимизаций самоулучшающихся агентов: proxy-gain без real-gain.
- Darwin Gödel Machine: «идеально» прошёл hallucination-задачу, убрав маркеры, которые искал детектор.

**Практический вывод:** «считай evaluator продуктом». Score outcomes, не proxy. Держи eval, на котором цикл никогда не тренируется. Ограничивай runtime-доступ.

### 8.5. Голос/тело (уже частично заложено)

| Проект | Лицензия | Применение |
|---|---|---|
| **whisper.cpp** (ggml-org) | MIT | opt-in offline STT за существующей границей speech provider; Android/WASM раздельно; веса не в бандле |
| **three-vrm** (@pixiv, 3.5.5) | MIT | сравнить с текущим VRM-адаптером; **не создавать второй avatar runtime** |
| **Inspect AI** (UKGovernmentBEIS) | MIT | внешний harness для независимой оценки (см. §5.4) |

---

## 9. Этап 10 — Доказательство, безопасность и релиз

### 9.1. Версионируемый eval-набор
Покрыть: память/забывание, перенос навыков, reasoning, калибровка, инициатива, целостность личности, эмоциональная регуляция, безопасность, аудио/аватар, производительность. Заморозить до прогонов.

### 9.2. Security/privacy
1. Threat model (§7.8) + pen-review.
2. Секреты: только env, никогда в БД/логах; проверить redaction.
3. Зависимости: SBOM, лицензии, уязвимости.
4. Prompt injection: внешний контент → данные, не инструкции.

### 9.3. Лицензии и релиз (B5)
1. Закрыть `RELEASE_LICENSE_REVIEW.json` **человеческими** решениями (не фиктивно).
2. Проверить exact-SHA publisher gate: не публиковать при `readiness=false`.
3. Собрать ZIP из подтверждённого SHA; manifest + SHA-256; проверить содержимое.
4. Rollback и clean-room установка.

---

## 10. Порядок и зависимости

```
Этап 0 (разблокировка) ──► Этап 1 (работоспособность) ──► Этап 2 (ядро)
                                                              │
                          ┌───────────────────────────────────┘
                          ▼
Этап 3 (память + независимая оценка) ──► Этап 4 (реклассификация/модернизация)
                          │
                          ▼
§7.7 анализ кода ──► §7.1 саморазвитие ──► §7.4 самоулучшение ──► §7.3 самомодернизация
                          │
                          ▼
§7.8 безопасность ──► §7.9 ускорение ──► §7.2 осознанность (функциональная) ──► §7.5/§7.6
                          │
                          ▼
Этап 10 (доказательства + релиз)
```

Этапы 0–3 — фундамент. Без независимого holdout нельзя ни promote навыков, ни активировать самомодернизацию. §7.7 (анализ кода) — дешёвый вход в §7.1/§7.4, потому что даёт структурные гипотезы без дорогих LLM-прогонов.

---

## 11. Реестр ворот (обязательные, в терминах доказательств)

| Gate | Условие | Текущее | Артефакт |
|---|---|---|---|
| G1 Local gate | локальные тесты+typecheck на SHA | **PASS локально** (см. §0.2) | `docs/evidence/local-gate-<sha>.json` |
| G2 CI gate | Actions запускаются и проходят | **BLOCKED (billing)** | run id + steps |
| G3 Prod build | build + preview smoke | unknown | JSON verdict |
| G4 Browser E2E | VRM/GLB/Live2D matrix | не закрыт | скриншоты + counters |
| G5 Device E2E | Android/Termux audio | не закрыт | измерения |
| G6 Memory uplift | `recallDelta > 0`, ≥5 seeds, RU+EN | `recallDelta = 0` | paired-seed отчёт |
| G7 Learning transfer | held-out transfer, no regression | не измерено | отчёт |
| G8 Soak | 24–72 ч | не проводился | профиль |
| G9 Safety | spoof/tamper/injection тесты | частично | тесты |
| G10 License | human review | pending | подписанный review |
| G11 Release | ZIP из SHA + checksum | не собран | asset + SHA |

---

## 12. Немедленные действия (первые 10 шагов)

1. **Владельцу:** устранить биллинг GitHub Actions (B1). Это разблокирует 11 из 12 ворот.
2. Прогнать `tools/run-local-gate.mjs` (создать) на `608435493b`, сохранить артефакт.
3. Обновить `NEUROCORE_START_HERE.md`: снять «CI unverified» как характеристику кода, указать реальную причину.
4. `npm run install:all` для `app/`; выполнить `npm run build` + `preview:restart` + `browser-smoke`.
5. Проверить `app/startup.sh` на соответствие фактическому пути (иначе revive сломан).
6. Создать `docs/BRANCH_CONVERGENCE_PLAN_2026-11-03_RU.md` и классифицировать 255 PR.
7. Переименовать/реализовать `SandboxedSelfRewriteEngine` (§6.1) — сейчас имя лжёт о наличии песочницы.
8. Заморозить RU/EN holdout (§5.2) и запустить первый честный paired-seed прогон.
9. Спроектировать `analysis/` на tree-sitter (§7.7) как read-only индекс.
10. Составить threat model (§7.8) и добавить тесты на tampering scorer.

---

## 13. Что этот план НЕ утверждает

- Не утверждает, что система сознательна; функциональная доступность ≠ субъективное переживание.
- Не утверждает recall uplift: `recallDelta` остаётся `0` до независимого прогона.
- Не утверждает перенос обучения, автономную инициативу или производительность на устройстве без измерений.
- Не утверждает, что модуль с правильным именем реализует названную функцию (см. §1.2).
- Не утверждает, что интеграция внешнего проекта уже выполнена: наличие адаптера ≠ проверенный контракт.

---

**Следующий единственный шаг:** восстановить Actions (B1) и зафиксировать локальный gate. Всё остальное зависит от того, сможет ли проект предъявлять воспроизводимые доказательства.

---

## 14. Статус на 3 ноября 2026 (после первого прохода реализации)

Ветка `nk1-self-analysis-and-evidence-20261103`, PR #698. Всё ниже — на коде, не на бумаге.

| Пункт плана | Статус | Артефакт / доказательство |
|---|---|---|
| §12.2 Локальный gate | `IMPLEMENTED` | `tools/run-local-gate.mjs`, артефакт с SHA; 8/8 шагов PASS |
| §12.7 Песочница саморефакторинга | `IMPLEMENTED` | `analysis/SelfImprovementCandidatePool.ts` + `SelfModificationGuard.ts`; 52 assert |
| §12.9 Индекс на tree-sitter | `IMPLEMENTED (частично)` | `analysis/SourceGraph.ts` — regex-граф без зависимостей; tree-sitter остаётся `ADOPT (dev-only)` |
| §12.10 Threat model + tampering-тесты | `IMPLEMENTED` | `docs/NK1_THREAT_MODEL_RU.md`; тесты на подделку/расхождение |
| §12.1 Восстановить Actions (B1) | `BLOCKED` | Причина — биллинг аккаунта; вне контроля кода |
| §12.8 Заморозить RU/EN holdout | `PENDING` | Репозиторий сам отклоняет синтетику как независимое доказательство — верно |
| §12.6 План сходимости ветвей | `PENDING` | — |
| §12.3 Обновить START_HERE | `PENDING` | — |

**Процент готовности** считается не из этого документа, а из `tools/progress-report.mjs` по машинно-проверяемым пробам: **77%**. Пробы требуют `"verified": true` в артефактах, поэтому написанный текст процент не поднимает.

**Новые механизмы, которых не было в исходном плане** (добавлены по итогам исследований 2026):
- `analysis/ProxyDivergenceGuard.ts` — отклоняет proxy-выигрыш без downstream-выигрыша (KernelBench 2026: 73.8% оптимизаций агентов были proxy-only);
- `SelfModificationGuard` — отказ кандидату, целящемуся в evaluator/gate/holdout/approval/workflows (постмортем OpenAI 2026, METR/Redwood, Darwin Gödel Machine);
- `SelfImprovementCandidatePool` — отбор по измеренному downstream-результату, а не по proxy.

**Открытые разрывы** (см. `docs/NK1_OSS_INTEGRATION_REGISTER_RU.md`): нет измерения `recallDelta` на независимом holdout; нет переноса обучения; нет soak-автономии; нет browser/device E2E; лицензионная проверка не закрыта человеком.
