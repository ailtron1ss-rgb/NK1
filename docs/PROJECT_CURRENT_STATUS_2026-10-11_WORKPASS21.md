# Neuro-Kurisu — текущее состояние WorkPass 21

**Дата:** 11 октября 2026 года  
**Root version:** `21.0.0-super-final7`  
**Canonical runtime:** `Neuro-Kurisu 35.43.0 / schema 223`  
**Статус выпуска:** implementation workpass; проект не объявлен release-ready.

## Результат этого прохода

- Нормализованный реестр: **67 уникальных задач — 48 DONE, 10 PARTIAL, 9 TODO**. Исторические append-only счётчики в `Список дел.md` не пересчитываются как будто это уникальные задачи.
- Реализованы кросс-доменная склейка синдицированных материалов, lineage-aware admission в EvidenceFirewall и дедупликация MemoryOS2 с сохранением mirror provenance.
- Успешно прошли: runtime TypeScript; claim evidence (20 cases); source lineage (8 cases); project research gates/Core integration; executor idempotency (5 scenarios).
- Полноценная production-сборка UI и браузерный E2E по-прежнему не подтверждены; это не замаскировано под успешный runtime audit.

## Изменения WorkPass 21

1. `ResearchSourceLineage.ts` нормализует URL, обнаруживает exact-content и осторожные near-duplicate совпадения по 5-token shingles. Короткие фрагменты не объединяются только на основании общей темы.
2. `ProjectResearchSession` вычисляет lineage при ingest и восстанавливает его из ограниченных исходных данных при restore, а не доверяет сохранённому кластерному ярлыку.
3. `EvidenceFirewall` считает компоненты связности между publisher identity и story lineage; копии одной истории с разных доменов не могут пройти как две независимые семьи доказательств.
4. MemoryOS2 сохраняет одну гипотезу на lineage и удерживает ограниченные зеркальные URL для происхождения данных. Материал по-прежнему не является установленным фактом.

## Открытые блокеры

- Настоящий NLI/semantic entailment с fail-closed `unknown`, атомарное извлечение утверждений и adversarial labelled corpus.
- Полная генеалогия первоисточников за пределами осторожного lexical near-duplicate распознавания; оценка false merge/false split.
- Независимый temporal MemoryOS2 holdout относительно BM25 и исходной конфигурации; улучшение качества пока не доказано.
- Полный сквозной action→independent receipt→persistence→reafference trace и live research run на реальных разрешённых источниках.
- Чистая установка frontend-зависимостей, root/app typecheck, React/Vite production build, desktop/mobile browser E2E и Live2D interaction.
- Clean-room restore/upgrade/rollback, длительный soak, SBOM/license/provenance и RC sign-off.

Полный отчёт: `docs/WORKPASS21_IMPLEMENTATION_REPORT_2026-10-11.md`.
