# WorkPass 44 — задачи и приоритеты следующего прохода

Дата: 15.10.2026 · База: WorkPass43 · Runtime 35.65.0 · State schema 225.

## Закрыто в WorkPass44 — 8/8 пунктов
- [x] **WP44-01 — Action identity:** детерминированный `executionId` и hash-derived provider-facing idempotency context передаются исполнителю; pending/uncertain receipts требуют reconciliation, а не blind retry.
- [x] **WP44-02 — Семантика неизвестного:** отсутствие подтверждения не становится `contradicted` и не порождает негативное обучение.
- [x] **WP44-03 — Внешние доказательства в CEF:** `OrganismCore` связывает external observation с точным `tool-outcome` отдельным `external-evidence` узлом; payload санитизирован/hashes only.
- [x] **WP44-04 — Валидация snapshot:** `CognitiveEventFabric.restore` принимает external evidence refs только при совпадении executionId, observationId, projection hash и реального outcome parent.
- [x] **WP44-05 — Temporal credit:** повторный outcome ID не назначает второй reward/credit и конфликт идентичности отклоняется, включая restore.
- [x] **WP44-06 — Trust/observer:** повторная оценка не повышает второй раз counters/source reliability/corroboration; evidenceId reuse conflict fails closed.
- [x] **WP44-07 — Autobiographical continuity:** P84 ingestion и learning плюс P83 belief continuity не повторно обновляют состояние на replay одного observation ID.
- [x] **WP44-08 — Memory receipt eviction:** Bloom tombstones сохраняют память о старых ключах, вытесненных из точного 512-entry журнала; возможный повтор уходит в reconciliation-required.

## Частично закрыто — 2 пункта
- [~] **WP44-09 — Provider idempotency:** токен теперь доступен адаптеру, но реальный внешний провайдер/device ещё не доказал, что принимает его, хранит и выдаёт authoritative receipt.
- [~] **WP44-10 — Real delayed evidence → reafference:** внутренние интеграционные и рестарт-сценарии проходят, но путь позднего реального provider/device наблюдения после обрыва и reconnect не прогнан целиком на внешнем хосте.

## Следующие открытые пункты — 3 крупных направления
- [ ] **WP44-11 — Provider/device reconciliation E2E (P0):** провести сценарий provider accepted → соединение оборвалось → процесс перезапустился → receipt lookup → external evidence → causal learning без повторного side effect. Включить crash injection до side effect, сразу после него, перед локальным commit и после рестарта.
- [ ] **WP44-12 — Browser + Live2D/Legacy E2E (P1):** в среде с установленными app dependencies выполнить production Vite build, поднять браузер, проверить загрузку модели, переключение Legacy/Live2D, сообщения доверенного iframe, отказ неверного origin/source/schema и восстановление после перезапуска.
- [ ] **WP44-13 — Release gates (P1):** реальное target-host inference и ресурсные измерения, независимый labelled temporal retrieval holdout, clean-room install/upgrade/fault-injected rollback, ручная проверка лицензий всех вложенных источников и soak. У retrieval сейчас `recallDelta=0`: кандидат не продвигать.

## Результаты, подтверждённые по отдельности
- Runtime typecheck — PASS.
- `test:tool-receipt-causal-workpass43` — 9/9 PASS.
- `test:workpass44:evidence-replay` — PASS.
- `test:workpass44:action-crash` — PASS.
- ActionGateway idempotency — 13/13 PASS.
- Action ledger archive — 4/4 PASS.
- Memory lifecycle — PASS; canonical owner `MemoryOS2`, journal 512, replay event delta 0.
- Reafference integration — 1/1 PASS.
- Release metadata — 34/34 PASS; contract tests — 6/6 PASS.
- App script tests — 218/218 PASS; browser smoke contract — 51/51 PASS (это не browser E2E).
- Server imports — 11 checked / none missing; UI/API 125 routes / 49 surfaces / zero missing seams; assets 0 errors.
- Compact source archives — 8,512/8,512; historical snapshot — 10,427/10,427 entries and 18,935 content source references; path restore 4/4; SBOM/provenance 464 locked npm components and 8 source archives.
- Retrieval benchmark — PASS, corpus 18, train 4, holdout 8, 400 bootstrap samples; recall uplift 0 and promotion declined.

## Общий прогресс
- Единый список проекта: **120 задач — 94 DONE / 14 PARTIAL / 12 TODO**.
- Реализация текущего WorkPass44: **90%** (pass-specific; это не релизная оценка).
- Официальная взвешенная roadmap оценка: **78.0%**, изменение 0.0 п.п.; не повышать до закрытия реальных provider, browser, target-host, holdout, rollback, license и soak gates.

## Запуск
- Полный gate alias: `npm run audit:workpass44`. Он включает все перечисленные test/audit команды, но один последовательный запуск в текущей среде не завершился: typecheck завис после предыдущих тестов и инструментальный запуск был прерван. Не считать этот конкретный агрегированный запуск PASS.
- Проверенный сфокусированный chain: `npm run audit:workpass44:focused` — PASS. Runtime typecheck и остальные gates дополнительно запускались отдельно.

**Главное правило следующего прохода:** не создавать новый runtime, память или gateway. Реализовать провайдерский receipt lookup/idempotency в существующих адаптерах и замкнуть доказательство внешнего действия до reafference/temporal credit.
