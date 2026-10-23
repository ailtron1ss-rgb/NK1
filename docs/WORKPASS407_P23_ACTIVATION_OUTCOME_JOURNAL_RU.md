# WorkPass407 — замкнуть контур решения и реальной активации навыка

Дата: 23 октября 2026 года. Целевая категория: `feature/learning`.

## Проблема в архитектурном стыке

До этого прохода P23 сохранял fitness-решение в `LearningFitnessJournal` до подтверждения shadow receipts и authenticated approval. Это правильно разделяло качество кандидата от права активации, но оставляло незаписанным окончательный результат lifecycle: fitness мог быть принят, а затем binding/approval/store мог отказать или операция могла завершиться неоднозначно.

Из-за этого наблюдаемость не могла отличить:
- кандидата, отклонённого fitness gate;
- проверенного кандидата, которому записали намерение активации;
- реально подтверждённую активацию;
- попытку, у которой запись результата отсутствует либо сам store завершился неоднозначно.

## Что интегрировано

### 1. Отдельный append-only lifecycle journal

Добавлен `runtime/neuro-kurisu/src/organism/learning/LearningLifecycleJournal.ts` с JSONL-событиями:

- `promotion-rejected` — production gate или verified-shadow binding отказал до side effect;
- `activation-intent` — evidence binding уже прошёл, а долговременное намерение записано до вызова активации;
- `activation-confirmed` — store вернул активированную версию, результат которой удалось записать;
- `activation-failed` — зарезервирован для отказа, когда он точно известен;
- `activation-outcome-unknown` — код store выбросил ошибку после входа в операцию, но вызывающая сторона не может безопасно доказать, был ли side effect завершён.

Последний вариант важен: не записываем ложный «неуспех», когда операция могла уже изменить состояние. Если процесс погиб после intent, запись остаётся как pending attempt. Если финальная запись не удалась после подтверждённой активации, ошибка журнала не маскирует успешный результат API, а незавершённый intent сохраняет сигнал для reconciliation.

### 2. Целостность, последовательность и приватность

Журнал использует SHA-256 hash-chain, последовательные sequence и previousDigest, ограничение размера, append lock, `fsync`, точную схему и snapshot через `LearningTrustBoundary`. Проверяются не только хеши, но и допустимость lifecycle-переходов: нельзя подтвердить активацию без intent, записать взаимоисключающие терминальные исходы или превратить отклонённую попытку в активированную. Повтор идентичного события идемпотентен; конфликтующий повтор отвергается.

В журнал не попадают prompts, payload, raw holdout rows или task-level evidence. Diagnostics публикуют только агрегаты, fingerprint не раскрывается наружу.

### 3. Встраивание в единый организм

- `P23LearningEngine` связывает intent/result с точными candidate ID/version и payload/evaluation/plan/environment fingerprints.
- Для fitness и verified-shadow binding rejection создаётся lifecycle-event, но authoritative rejection/error продолжает работать по старому контракту.
- Перед activation запись intent обязательна: ошибка журнала останавливает потенциальный side effect.
- `OrganismRuntime` конфигурирует отдельный sidecar `.learning-lifecycle.jsonl` рядом с state-file, допускает внедрение host sink и выводит ограниченный diagnostics snapshot в `longitudinalSnapshot()` и `persistenceMetrics()`.
- `learningLifecycleJournalPathForStateFile` централизует формирование пути и имеет регрессионные случаи для lowercase/uppercase `.json`, файлов без `.json` и запрещённого NUL. Это предотвращает запись event JSONL поверх основного файла состояния.

### 4. Регрессии и CI

- `tests/workpass407-learning-lifecycle-journal.mjs`: отдельный файл журнала, path isolation, hash-chain, idempotent intent, pending→confirmed reconciliation, explicit unknown outcome, illegal transitions, identity binding, non-invoked getter, tampering, truncated file и competing lock.
- `tests/workpass402-production-promotion-family-gate.mjs`: production fitness rejection теперь дополнительно проверяет lifecycle rejection, привязанный к staged payload и evaluation fingerprint.
- Новый тест зарегистрирован в `test:p23:learning` и отдельным шагом в `.github/workflows/p26-learning-validation.yml`, вместе с path filters для нового source/test.

## Файловое исследование upstream

Я прочитал содержимое файлов напрямую через GitHub, а не только описания репозиториев:

- [Hermes Self-Evolution README](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md), Git blob SHA `c59f9a6a57e36edbc2aae6b76aeee2e4878e63a8` — последовательность execution traces → candidate variants → constraint gates, разделение генерации и допуска к выпуску.
- [Hermes PLAN.md](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md), blob SHA `48f9ef147e5b47d3d24d712d5360f41d31340ce6` — отдельные двигатели оптимизации и unified workflow.
- [Hermes `evolution/skills/evolve_skill.py`](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py), blob SHA `2a79a670aaa632fe720b2fef0fc9ce62ee7d281f` — фактические stage gates: выбор synthetic/golden/sessiondb dataset, constraint validation с запретом deployment при провале, отдельное сохранение не прошедшего кандидата и сравнение baseline/candidate на holdout.

Дополнительное исследовательское основание:
- [SkillLearnBench](https://arxiv.org/abs/2604.20087) разделяет skill quality, trajectory quality и task outcome; отмечает, что внешняя обратная связь и повторные итерации важны, а один лишь self-feedback может вести к рекурсивному drift.
- [RLiable](https://github.com/google-research/rliable) мотивирует отчётность с неопределённостью и разными агрегатами, а не одним средним.

Мы не копировали Hermes Python runtime или GEPA/DSPy зависимости: их слой оптимизации не является совместимым с существующим TS/P23 store и не заменяет авторитет NK1. В NK1 перенесена структурная идея: фиксировать реальный переход lifecycle, сохраняя независимость оценки и promotion.

## Статус и границы доказательности

Код, тест и workflow wiring находятся в `feature/learning`. Полный CI и полный runtime typecheck **не подтверждены**: текущий P26 Actions API возвращал failed job без steps/log URL; скачивание логов отвечало `BlobNotFound`. Не делать из этого ни вывода о причине сбоя, ни заявления о PASS.

Hash-chain обнаруживает случайное повреждение и локальные изменения записи, но не является подписью против злоумышленника, который может пересчитать весь файл. Для этого нужны независимые подписанные checkpoint/remote verifier. Pending intent требует reconciliation с авторитетным store после аварии. Ни этот проход, ни факт активации навыка не доказывают субъективное сознание или устойчивый benchmark gain.

## Следующие 3 прохода

1. Добиться доступного exact-HEAD CI/typecheck; проверить последовательности `activation-intent → activation-confirmed`, `activation-intent → activation-outcome-unknown`, rejection до intent и crash-recovery.
2. Добавить reconciliation pending lifecycle attempts с authoritative versioned-skill store, чтобы сверить факт активной версии по payload fingerprint, не восстанавливая решение по одному лог-файлу.
3. Связать подтверждённую активацию с последующими независимыми task outcomes и rollback/change-impact evidence; не считать сам факт promotion доказательством обучения.

