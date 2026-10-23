# WorkPass405 — журнал решений об оценке навыков

## Назначение

WorkPass400–404 усилили production fitness gate, но на каждом отказе/успехе не было общего долговременного, агрегированного аудита: нельзя было последовательно восстановить, какая версия кандидата и какой fingerprint эксперимента дали решение, сколько matched trials участвовало и были ли confidence/seed coverage failures.

## Что добавлено

`LearningFitnessJournal.ts` предоставляет:

- `LearningFitnessJournalSink` — небольшую внедряемую границу для P23, без прямой зависимости `P23LearningEngine` от файловой системы.
- `JsonlLearningFitnessJournal` — hash-chained JSONL writer с номером последовательности, SHA-256 дайджестом записи и ссылкой на предыдущую запись.
- `readAll()` — проверку схемы, последовательности, цепочки hash, конечной новой строки, размера, symlink/file type и отсутствия пустых строк.
- эксклюзивный lock-файл на время синхронной записи и `fsync`; при занятом lock запись завершается fail-closed. Процесс, не завладевший lock, не имеет права удалять его.
- жёсткую схему с точным набором допустимых полей и data boundary через `snapshotPlainData`. Лишние поля на верхнем или вложенном уровне не сохраняются и не принимаются при восстановлении.

## Содержимое и приватность

В запись входят только идентификатор кандидата, fingerprints payload/evaluation/plan/environment, decision (`fitness-accepted` либо `fitness-rejected`), allowlist-совместимые reason codes, число matched trials, конфигурация gate и агрегированные счётчики/границы validation и holdout.

Не записываются prompt-ы, task IDs, имена семейств, исходные holdout-примеры и per-task score. Confidence-метрики — агрегированные: число семейств с достаточным coverage, средняя family delta, минимальная нижняя и максимальная верхняя граница интервала, количество ошибок покрытия/доверительного интервала.

Это помогает отслеживать качество и возможное забывание без превращения журнала в копию закрытых benchmark-данных.

## Интеграция в единый цикл

`P23LearningEngine.configureLearningFitnessJournal(...)` принимает внедрённый sink; `configureLearningFitnessJournalIfAbsent(...)` позволяет runtime добавить значение по умолчанию, не заменяя уже настроенный host sink. Если `OrganismRuntime` сконфигурирован с `compoundRepairRevision.engine`, он по умолчанию создаёт sibling-файл `<stateFile stem>.learning-fitness.jsonl`, либо использует явно переданный `RuntimeConfig.learningFitnessJournal`. Реальный `approveIndependentlyEvaluatedSkillCandidate` записывает решение fitness gate до проверки подписанных shadow receipts и до атомарной активации. И успешная fitness-оценка, и отказ из-за семейного покрытия/seed/confidence отражаются в журнале. Если настроенный журнал не может безопасно записать событие, исключение не даёт пройти к promotion.

Журнал фиксирует именно **fitness decision**, а не утверждает, что навык активирован: успешный fitness gate ещё должен пройти проверку подписанных свидетельств, authenticated approval и хранилище версий.

## Проверки

`tests/workpass405-learning-fitness-journal.mjs` покрывает добавление и чтение двух записей, последовательность/hash-chain, privacy fields, caller accessors, lock contention, изменённый digest, extra fields и truncation. `workpass402-production-promotion-family-gate.mjs` проверяет, что фактический P23 production path передаёт reject решения в настроенный sink и всё равно не активирует неподходящий candidate.

P26 workflow path-filters новый модуль и тест и запускает его на Node.js 24.

## Ограничения

- SHA-256 цепочка обнаруживает случайное повреждение и локальные изменения, но не является криптографической подписью: обладатель возможности переписать весь файл может пересчитать всю цепь. Для аудита от активного атакующего нужна внешняя подпись/периодический checkpoint в независимое хранилище.
- Упавший процесс может оставить lock-файл; безопасное поведение — отказ записи до ручной проверки/recovery, а не автоматическое удаление потенциально живого lock.
- `fsync` и эксклюзивный lock рассчитаны на доступную локальную файловую систему; сетевые/несовместимые файловые системы требуют отдельной проверки.
- Тесты закоммичены, но фактическое выполнение и typecheck пока не подтверждены: GitHub Actions возвращает failure без доступных step logs.