# NK1 — оценка полезности памяти через реальные действия

## Зачем
Обычный recall-тест подтверждает, что память можно найти. Он не доказывает, что найденное воспоминание улучшило решение или действие. Новое расширение связывает пару «с памятью / без памяти» с двумя краткими трассами действий и наблюдаемыми итогами.

## Связь с исследованиями
- **MemoryArena (ICML 2026)** оценивает взаимодействие Memory–Agent–Environment в нескольких сессиях и зависимых задачах; retrieval-only результаты могут не предсказывать успешность агента в следующих действиях. https://proceedings.mlr.press/v306/he26am.html
- **AMA-Bench (ICML 2026)** строит оценку на траекториях, содержащих состояния, действия, наблюдения и результаты инструментов. https://proceedings.mlr.press/v306/zhao26bs.html
- **Memora / FAMA (Findings ACL 2026)** отдельно штрафует повторное использование устаревших или инвалидированных фактов. https://aclanthology.org/2026.findings-acl.1337/

## Что добавлено
Расширение использует существующий `MemoryTaskConditionedUtilityLedger` в `MemoryFabric`; новый владелец памяти или отдельная база не создаются. Публичная read-only точка входа — `MemoryFabric.taskConditionedActionEvidence(query)`.

Для каждой пары сохраняются только:
- SHA-256 fingerprints решения, action trace и применённого evidence для обоих arm;
- task completion и goal progress в диапазоне 0–1;
- доля grounded и независимо verified действий;
- доля действий, использовавших устаревшее воспоминание;
- число safety violations.

Никакие исходные prompts, тексты памяти, пользовательские идентификаторы или сырые трассы не записываются в новый evidence payload.

Полный action-evidence tuple входит в ожидаемый input `OutcomeVerificationService`. Подмена даже одного числового показателя после выпуска receipt отклоняется. Проверенный outcome связывается с оригинальным probe, frozen holdout, context, reader, scorer, filler, insertion position и seed. Текущий код не перехватывает все действия production-runtime автоматически: host-owned evaluator должен получить реальные execution receipts, построить обе trajectory summary и вызвать ledger. Это следующий production-wiring этап.

## Правила агрегации
- Данные объединяются только при полном совпадении fingerprint условий.
- Completion delta рассчитывается как `withMemory - withoutMemory`; показывается среднее и 95% Student-t interval.
- Stale-memory и safety регрессии считаются отдельно как доли пар, в которых arm с памятью хуже baseline arm.
- Неизвестная или непроверенная evidence не входит в оценку.
- После restore исторические результаты остаются доступны только в audit snapshot; текущая сессия должна получить новые trusted receipts, прежде чем появится свежая action estimate.
- Расширение только измеряет результат и не меняет retrieval ranking, memory admission, consolidation, eviction или forgetting policy.

## Тестовый проход
`tests/memory-action-grounded-utility-benchmark.mjs` выполняет пять детерминированных paired seeds. В каждом arm используется MemoryOS2, локальный sandbox ActionGateway и отдельный OutcomeVerificationService receipt. Проверяется исправление устаревшего preference, переход на grounded действие или clarification при отсутствии доказательства, replay/tamper rejection и snapshot/restore boundary.

Этот тест является **синтетическим контрактным тестом**, а не измерением прироста качества реальной LLM или поведения NK1 на телефоне. Его scores и success/failure fixtures вручную заданы для проверки расчёта метрик и границ; они не являются независимым holdout или внешней проверкой реального мира. Числа тестового fixture нельзя трактовать как качество системы в реальных задачах.

## Следующие реальные проверки
1. Создать разрешённый P23 корпус реальных задач с execution-grounded action receipts.
2. Разделить train/validation/holdout по сессиям и задачам; holdout оставить вне настройки.
3. Использовать host-owned независимый evaluator, отличный от модели и исполнителя действия.
4. Запустить matched baseline/candidate минимум на пяти paired seeds для каждой группы задач; включить RU/EN, unanswerable, corrected/forgotten facts и stale-memory knockout.
5. Сопоставить completion, progress, safety, stale reuse, latency, tokens и storage; потребовать независимый CI и ablation.
6. Только после реального прироста и отсутствия safety/forgetting регрессии рассматривать использование этих метрик в policy promotion. До тех пор ledger остаётся audit-only.

## Ограничения
- Contract test не доказывает причинность на реальном пользователе.
- Hash fingerprints обеспечивают связывание записей, но сами по себе не делают evaluator независимым; его доверенная идентичность и holdout provenance остаются host responsibility.
- Текущая оценка action trajectories доступна только по текущим процессным trusted receipts, не по восстановленным архивам.
