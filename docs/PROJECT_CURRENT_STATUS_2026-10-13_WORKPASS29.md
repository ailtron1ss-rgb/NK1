# Neuro-Kurisu — текущий статус WorkPass 29

**Дата:** 13 октября 2026 г.  
**Root:** `29.0.0-super-final15` · **Runtime:** `35.52.0` · **Schema:** `224`  
**Статус:** implementation-workpass — **не готов к выпуску**.

## Что реально объединено

- **Memo → MemoryOS2:** канонический dedup/index после restore теперь выбирает актуальную ревизию по validity и revision sequence, а не по порядку строк сериализованного массива. Возврат к старой формулировке не даёт исторической копии перехватить активный `contentIndex`.
- **Явная коррекция → temporal lineage:** `reviseContent` использует lineage-scoped revision identity; текстовая no-op-коррекция не создаёт новую ревизию и не закрывает запись сама на себя. Коррекция, начатая с historical ID, направляется на активный tip той же цепочки.
- **Expired observation → сохранность истории:** если тот же текст появляется после истечения прежней записи, новая наблюдаемая запись получает отдельный ID; старая validity boundary не переписывается.
- **Hexis → единая временная истина:** `hexisTemporalAt` и `hexisTemporalDiff` теперь читают canonical `MemoryOS2.temporalAt`, а не собственную теневую temporal-таблицу. Hexis temporal assertions оставлены как bounded audit/export projection.
- **Hexis review UX:** Memory Index отдаёт текущие актуальные строки; default review отбирает до 12 последних действующих воспоминаний. Исправлена ошибка `slice(-12)` по массиву newest-first, из-за которой рассматривался его самый старый хвост. Explicit IDs по-прежнему позволяют ревью исторической записи.

## Проверки изменений

- Runtime TypeScript compiler — PASS.
- `memory-temporal-inspector-closure` — PASS.
- `memory-retrieval-candidate-coverage` — PASS.
- `memory-retrieval-numeric-terms` — PASS.
- R15 temporal-memory behavior — PASS.
- R16 memory behavior — PASS.
- Новая `memory-source-integration-workpass29` — PASS: snapshot/restore, три версии с возвратом формулировки, no-op correction, preserved expiry boundary, индексная целостность после eviction исторического дубля, Hexis canonical temporal delegation и выбор последних 12 активных записей.

## Реальный статус качества

Эта работа устраняет дефекты целостности истории и интеграции адаптера. Она **не доказывает прирост retrieval Recall/MRR**. На прошлом малом синтетическом fixture MemoryOS2 находится на parity с BM25; независимый размеченный temporal holdout всё ещё нужен.

| Контур | Статус |
|---|---|
| Изменённый runtime TypeScript | PASS |
| Temporal history / restore / no-op revision | PASS |
| Canonical MemoryOS2 ↔ Hexis temporal API | PASS в Core regression |
| Новый review selection | PASS |
| Полный корневой release audit | Constituent gates PASS; единая команда превысила лимит 300 секунд после `SERVER_SMOKE=PASS`, aggregate exit code не подтверждён |
| React/Vite production build, браузерный Live2D E2E | Не подтверждены |

## Дальше

Остаётся в этой же ветке: расширить безопасное объединение provenance/revision для внешних гипотез, создать независимый labelled temporal holdout против BM25 и проверить долгие диалоги с конфликтами/исправлениями. Production browser E2E, реальный NLI inference, provider run, clean-room rollback, soak и release sign-off остаются открытыми.

**Normalized inventory:** 79 элементов — 58 DONE / 11 PARTIAL / 10 TODO. Weighted implementation roadmap: **72.75%** (рост отражает интеграционную работу, не release readiness).
