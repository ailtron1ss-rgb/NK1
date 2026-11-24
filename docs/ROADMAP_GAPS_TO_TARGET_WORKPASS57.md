# Актуальная карта пробелов — WorkPass57 (17.10.2026)

**База:** `Neuro_Kurisu_WORKPASS56_2026-10-17.zip` → **результат:** `Neuro_Kurisu_WORKPASS57_2026-10-17.zip`  
**Runtime:** `35.77.0` · **persisted schema:** `225`  
**Официальная взвешенная готовность:** **78.0%** — WorkPass57 не меняет её без доказательств релизных gates.

Предыдущая широкая карта остаётся доступной в `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS56.md`; данный файл фиксирует дельту после кодового прохода.

## Закрыто или усилено в WorkPass57

- [x] `ActionGateway` возвращает `executed-contradicted`, если внешний postcondition точно противоречит ожидаемому состоянию.
- [x] `tool-contract` ACK не повышается до независимого внешнего observation в verifier или causal projection.
- [x] Durable idempotency определяется не только opt-in флагом старой регистрации, но и side-effect/risk/capability профилем.
- [x] Внешние observations переносят source identity, source class, independence key и категорию assessment.
- [x] Unknown/ambiguous results не превращаются в отрицательное обучение.
- [x] Один источник противоречия создаёт evidence/prediction-error trace, но не отрицательный learning credit; для отрицательного назначения требуется две независимые линии с достаточной уверенностью.
- [x] Положительное обучение также требует идентифицированного независимого источника с достаточной уверенностью.
- [x] Bounded execution projection index и causal outcome index переживают recent-ring eviction, snapshot restore и migration; replay дедуплицирован.
- [x] Release/source/hygiene/integrity/syntax and architecture audits synchronised against actual WorkPass57 source baseline.

## Остающиеся P0/P1 — следующие проходы

### P0 — исчерпывающая матрица побочных действий

- [ ] Перечислить все исполняемые call sites: normal cycle, autonomous planner, project executor, compound/reusable skills, device/camera, voice, browser/research bridge, outbound и HTTP API.
- [ ] На каждом маршруте подтвердить одно decision ID, execution ID, стабильный idempotency key, durable pending receipt, единственный finalizer, typed final outcome и idempotent causal projection.
- [ ] Проверить, что approval привязан к точному инструменту/входу и guardrails выполняются непосредственно перед side effect.
- [ ] Проверить DNS/redirect/private/link-local/metadata IP ограничения всех outbound requests на фактическом resolved endpoint.

### P1 — реальная обратная связь и восстановление

- [ ] Живой provider/device end-to-end с read-after-write внешним наблюдателем.
- [ ] Точка отказа между external side effect и completed receipt; restart; reconciliation без blind retry.
- [ ] Подтвердить, что внешние source IDs и independence keys поставляются host/adapter кодом, не заполняются model-guess.
- [ ] End-to-end Reafference: exact decision → execution → independent observation → temporal credit → memory/skill update, с replay и threshold control.

### P1 — приложение и воплощение

- [ ] Установить app dependencies через canonical lockfile; production Vite build.
- [ ] Browser E2E для approval continuation, отказа/истечения/перезагрузки/осиротевшего ticket, Live2D fallback, cancel/reconnect.
- [ ] Прямо проверить UI состояния `pending`, `executed-unverified`, `verified`, `executed-contradicted`, `ambiguous` и `reconciliation-required`.
- [ ] Настоящая audio-buffer/phoneme/viseme временная шкала, а не только state-linked gestures.

### P1/P2 — память и локальные модели

- [ ] Замороженный независимый holdout по factual/temporal/contradiction/abstention/multimodal/forget: текущий широкий benchmark `recallDelta=0`; ничего не promoted.
- [ ] BM25/hybrid/vector сравнение на одном labeled set с false-recall, temporal accuracy, latency and storage cost.
- [ ] Целевой GTX 1650 4GB/local provider benchmark: конкретная модель, quantization, context, concurrency, peak VRAM/RAM, latency/throughput and quality; не заявлять производительность по чужим бенчмаркам.

### P2 — эксплуатационная готовность и интеграция источников

- [ ] Clean-room install/upgrade/rollback и проверка восстановления snapshots/indexes/approval ledger.
- [ ] Полная ручная license/provenance review nested source archives; интегрировать источник только с реальной функциональной дельтой.
- [ ] Multi-hour soak/restart/reconnect/backpressure, включая рост causal indexes, pending receipts и privacy-sensitive logs.
- [ ] Финальное согласование версии, manifest и release gates после реальной проверки приложения.

## Как считать прогресс

Класс/тест/документация не закрывает пользовательский сценарий автоматически. DONE требует согласованного владельца состояния, реального runtime-пути, сохранения, корректного failure/replay behavior и воспроизводимого результата. Пока вышеуказанные live gates открыты, release status остаётся implementation-workpass.
