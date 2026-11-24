# Neuro-Kurisu 35.27.0 — R15 Final Report / Temporal Memory

Дата: 25.09.2026

## Цель прохода

Укрепить реальную непрерывность канонической памяти Neuro-Kurisu без создания второго memory store: временная валидность, версии утверждений, revision lineage, устаревание/forgetting, целостность индексов и независимое поведенческое доказательство retrieval.

## Основные изменения

### 1. Bi-temporal-style memory validity

`MemoryItem2` получил совместимые optional-поля `validFromAt`, `validUntilAt`, `observedAt`. Старые snapshots автоматически получают безопасные значения при restore, поэтому schema остаётся 219 и старые данные не требуют разрушительной миграции.

Retrieval теперь поддерживает `current`, `at`, `all` и point-in-time `asOfAt`. По умолчанию используется current-представление, поэтому исторически недействующие факты не конкурируют с актуальными.

### 2. Реальная revision lineage

Добавлены `supersedesId`, `supersededById`, `revisionGroupId`, `revisionSequence` и `reviseContent()`. Старое утверждение не уничтожается: оно получает `validUntilAt`, а новая версия связывается с ним. Retrieval расширяет кандидатов по revision-group index до temporal-фильтра, поэтому изменение формулировки не делает новую версию недостижимой.

### 3. Contradiction / temporal links

Новые contradiction links становятся симметричными. Temporal links больше не являются просто списком свежих элементов: при построении учитываются временные окна и semantic/entity overlap.

### 4. Forgetting и index integrity

Исправлен реальный defect: `forgetById()` и pressure maintenance могли оставлять stale references в `itemIndex`/link/index structures. Теперь удаление централизованно очищает item index, exact/content indexes, BM25 DF/token indexes и ссылки на удалённый memory id. Добавлен `indexDiagnostics()` с проверкой stale/missing references и document-frequency consistency.

### 5. Runtime/API

`MemoryFabric`, `OrganismCore` и существующий read-only server memory inspector получили temporal retrieval path. Это расширение существующей canonical authority, а не новая база памяти.

## Доказательства

R15 behavioral holdout: `Recall@3 = 1.0` на независимом наборе идентификаторов. Revision test подтверждает chain depth 2, recovery старой версии по point-in-time запросу и переход на новую версию после границы valid time.

Index audit: stale item-index = 0, missing item-index = 0, stale exact/content entries = 0, BM25 document-frequency mismatch = 0.

## Регрессия / производительность

R13/R14 memory regression tests — PASS. P2855 contextual policy, integration и ablation — PASS. P2854 hierarchical/core integration — PASS.

256-MB mobile benchmark повторён после оптимизации revision-group index. Получено два стабильных финальных запуска: p50 400.4–492.2 ms, p95 676.3–773.4 ms, max heap 129.0–132.4 MB, max RSS 293.6–306.4 MB. Для сравнения, R14 один зафиксированный запуск давал p50 458.9 ms, p95 574.4 ms, max heap 139.3 MB, max RSS 320.8 MB. Поэтому R15 даёт заметное снижение памяти, но p95 пока хуже R14 и остаётся зоной дальнейшей оптимизации; разброс между запусками показывает существенную runtime-шумность.

## Release validation

- Typecheck: PASS
- Core ownership: PASS, directConstructors=5
- Architecture: PASS, sourceFiles=1700, canonicalFiles=541, missing=0, cycles=0, legacyLeakage=0
- Hygiene: PASS, warnings=0
- Forensics: PASS, duplicateContent=0, duplicateNames=0, empty=0
- Full project audit: PASS, errors=0, warnings=0
- Release contract/source/integrity: PASS
- Archive manifest: PASS, 3975 manifest files, no missing/hash mismatch/extra

## Состояние после R15

Оценка аспектов: Core architecture 85/100; Memory 86/100; Persistence/continuity 86/100; Continual learning 63/100; World model 60/100; Neural substrate 49/100; Autonomy 63/100; Self/identity 66/100; Behavioral evidence 22/100. Engineering maturity оценивается примерно в 62/100, а готовность к целевой автономной искусственной личности — примерно 47/100. Эти числа не являются доказательством сознания; крупнейшее оставшееся ограничение — качество независимого semantic/behavioral evidence на длинном горизонте.

## Следующий приоритет

1. Actual MCP transport adapter поверх уже готового canonical memory boundary, без второй memory store.
2. Более сильная temporal contradiction resolution: автоматическое закрытие obsolete facts с проверкой provenance.
3. Retrieval benchmark на сотнях holdout queries с temporal/semantic/BM25 ablation и latency budget для среднего телефона.
4. Связать retrieval evidence с реальным downstream action selection на независимых holdout-сценариях, чтобы измерять не только Recall@k, но и полезное изменение поведения.
