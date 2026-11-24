# Neuro-Kurisu — текущий статус WorkPass 31

**Дата:** 13 октября 2026 г.  
**Root:** `31.0.0-super-final17` · **Runtime:** `35.54.0` · **Schema:** `224`  
**Статус:** implementation-workpass — **не готов к выпуску**.

## Реальное кодовое изменение

WorkPass31 вводит единый application-level mutation gateway: `MemoryFabric.applyLifecycleCommand`. Запись, статус, коррекция текста, сигналы, контекст и забывание идут через один путь к `MemoryOS2`. Новая параллельная память не создана.

- Команды с `commandId` получают SHA-256 fingerprint; точный повтор ничего не меняет и не создаёт дублирующее lifecycle-событие.
- Изменение payload при повторном использовании ключа завершается `MemoryLifecycleCommandConflictError`.
- Persisted receipt journal ограничен 512 строками, включён в `MemoryFabric.snapshot()` и восстанавливается с bounded validation.
- Обычный `migratePersistedOrganism` теперь сохраняет и санитизирует receipt-журнал; до этого мигратор незаметно отбрасывал новое поле.
- Совместимый импорт MultiTimescale, восстановление, Hexis review и ingestion внешнего research проходят через шлюз; production-вызовы больше не пишут в `MemoryOS2` напрямую. Legacy coordinator methods сохранены для исторических потребителей, пока они не мигрированы.

## Проверенная приёмка изменённого поведения

- `node scripts/typecheck-runtime.mjs` — PASS.
- `memory-lifecycle-command-workpass31.mjs` — PASS, включая штатную миграцию, replay после restore, конфликт ключа, забывание, no-op context update и bounded journal 512.
- `memory-provenance-lineage-workpass30.mjs` — PASS.
- `memory-source-integration-workpass29.mjs` — PASS.

## Ограничения

Этот проход улучшает надёжность записи и восстановления, но **не является доказательством роста retrieval quality**. Независимый temporal holdout против BM25, настоящий pretrained NLI inference, live external-provider run, React/Vite production build, desktop/mobile browser Live2D E2E, clean-room restore/rollback, soak и финальный release sign-off остаются открытыми. Общий release audit следует запускать после упаковки, однако этот пакет не объявляется готовым к выпуску.

**Normalized inventory:** 81 элемент — 60 DONE / 11 PARTIAL / 10 TODO. Weighted roadmap остаётся **72.9%**: этот проход закрывает одну реализационную задачу внутри уже оценённого single-owner workstream и не меняет широкую оценку готовности.
