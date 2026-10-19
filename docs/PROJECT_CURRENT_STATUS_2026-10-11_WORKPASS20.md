# Neuro-Kurisu — текущее состояние WorkPass 20

**Дата:** 11 октября 2026 года  
**Root version:** `20.0.0-super-final6`  
**Canonical runtime:** `Neuro-Kurisu 35.42.0 / schema 223`  
**Статус выпуска:** implementation workpass; проект не объявлен release-ready.

## Текущее состояние

- Нормализованный backlog: **65 уникальных задач** — **46 DONE**, **10 PARTIAL**, **9 TODO**.
- Взвешенный внутренний прогресс roadmap: **70.75%**; эта оценка не является ни процентом качества модели, ни готовностью к выпуску.
- Подтверждённая production-сборка интерфейса отсутствует: окружение не содержит Vite и `vite/client`; браузерный E2E и Live2D-проверка остаются открытыми.

## Главное в WorkPass 20

1. Починен стык `ActionGateway → project executor`: external research сохраняет publisher key, host, время получения и explicit claim.
2. Введены ограниченные claim evidence records с точной цитатой, offsets, URL/document/content hash и publisher provenance; отдельные claims не смешиваются в одной research-сессии.
3. Смешанные прямые support/refute anchors переводят связанные гипотезы canonical MemoryOS2 в карантин. Все такие записи остаются гипотезами; exact-text matching не объявляется семантическим доказательством.
4. Исполнитель проектов защищён от повторных/устаревших результатов через bounded persisted outcome-ID ledger и корреляцию `executionId`/`stepId`.

## Следующие блокеры

- Настоящая семантическая проверка entailment/contradiction, извлечение атомарных claims и обработка syndicated sources.
- Независимый temporal holdout, показывающий реальное улучшение памяти относительно BM25/текущего MemoryOS2.
- Полная цепочка внешнего действия и независимого подтверждения, clean-room restore/rollback, длительный soak.
- Установка frontend-зависимостей, production Vite build, реальные браузерные desktop/mobile E2E и интерактивный Live2D.
- Финальные SBOM/license/provenance и release-candidate sign-off.

Подробные изменения: `docs/WORKPASS20_IMPLEMENTATION_REPORT_2026-10-11.md`. Статусы всех задач: `docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_WorkPass20_2026-10-11.md`.
