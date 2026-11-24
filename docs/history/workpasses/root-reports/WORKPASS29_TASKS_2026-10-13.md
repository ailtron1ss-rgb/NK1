# WorkPass 29 — список дел (13.10.2026)

## Выполнено

- [x] Исправить порядок-зависимый выбор канонической записи в MemoryOS2 после восстановления архива.
- [x] Сделать явные ревизии lineage-scoped и безопасными при возврате к прежней формулировке.
- [x] Сделать no-op correction идемпотентной: не закрывать current item и не создавать self-link.
- [x] Сохранять историческую запись и validity boundary при новом наблюдении expired content.
- [x] Добавить read-only `MemoryOS2.temporalAt()` и `temporalDiff()`.
- [x] Подключить Hexis temporal lookup/diff к канонической MemoryOS2 timeline; оставлять Hexis history только для audit/export.
- [x] Исправить default Hexis review: до 12 последних current, non-dormant и non-quarantined элементов.
- [x] Исправить выборку Memory Index и порядок ограниченной синхронизации temporal projection.
- [x] При capacity eviction/forgetting перестраивать dedup-index для оставшихся строк, не стирать ссылку на более новую запись с тем же содержимым.
- [x] Добавить Core-level regression на snapshot/restore, temporal revisions, Hexis bridge и recent review.

## Осталось

- [ ] Независимый человечески размеченный temporal holdout на длинных диалогах; сравнить Recall@k, MRR, latency и false recall с BM25.
- [ ] Провести group-level provenance merge для claims без слияния независимых контекстов и без потери source independence.
- [ ] Выполнить React/Vite production build и реальный browser/Live2D E2E после восстановления frontend dependencies.
- [ ] Реальный pinned NLI inference, live provider evidence, clean-room restore/rollback, soak и release sign-off.

## Приёмка WorkPass29

Runtime typecheck, temporal inspector, candidate coverage, numeric retrieval, R15/R16 behavior и расширенная `memory-source-integration-workpass29` проходят, включая capacity eviction на корпусе в 1600 строк. Root metadata 34/34, release contract 6/6, browser-smoke tests 51/51, atomic report tests 4/4, server import, UI/API linkage и assets audit проходят отдельно. Единая длинная цепочка превысила лимит 300 секунд после `SERVER_SMOKE=PASS`; aggregate exit code не подтверждён, release readiness не заявляется.
