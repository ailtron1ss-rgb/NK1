# WorkPass31 — список задач

- [x] Единый mutation gateway для encode/status/content/signals/context/forget в MemoryFabric.
- [x] Ограниченный persisted receipt journal (512 записей), payload fingerprint и конфликт на переиспользование ID с другим payload.
- [x] Детерминированные idempotency IDs для compatibility ingest/restore.
- [x] Перевести production Hexis write path и external-research ingestion на canonical gateway.
- [x] Исправить `StateMigrations`: сохранить и санитизировать журнал команд при обычной нормализации persisted state.
- [x] Добавить focused regression, который гоняет snapshot через штатный `migratePersistedOrganism`.
- [x] Runtime typecheck, provenance lineage regression и source/Hexis canonical integration regression.
- [ ] Мигрировать/удалить оставшиеся legacy write-helper контракты после переноса исторических потребителей.
- [ ] Независимая temporal retrieval выборка против BM25; не подменять качество synthetic fixture.
- [ ] Dependency-complete React/Vite build и реальный браузерный Live2D E2E.
- [ ] Real pretrained NLI/provider run, clean-room recovery/rollback, soak и release sign-off.
