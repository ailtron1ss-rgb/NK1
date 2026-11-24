# WorkPass74 — доверенный manifest независимого memory holdout

## Обнаруженная проблема

WorkPass73 проверяет структуру RU/EN paired holdout, fingerprints, качество ранжирования и заявленные provenance-поля. Но поля `datasetId`, `datasetVersion`, `sourceRef`, `labelingProtocol`, `licenseId` и `contentHashValid` поступают от того же producer, который экспортирует отчёт. Совпадение `contentSha256` с переданным fingerprint подтверждает внутреннюю согласованность, но не доказывает независимость источника или факт человеческой разметки.

Структурно корректная запись с выдуманным URL и самодекларированной разметкой не должна получать promotion eligibility только потому, что её поля согласованы между собой.

## Реализованный trust gate

- Добавлен `evaluation/inspect_ai/trusted_memory_holdouts.json`. Начальный список пуст: ни один внешний датасет автоматически не одобрен.
- Добавлен `nk1_memory_trust.py`: проверяет точный fingerprint + provenance, timestamped review receipt и SHA-256 manifest-файла.
- Требуется внеполосный Actions Variable `NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256`; отсутствие или неправильный pin блокирует promotion.
- Manifest ограничен 1 MiB, должен быть обычным файлом, symlink запрещён, запись читается без следования symlink где платформа поддерживает `O_NOFOLLOW`.
- Review timestamp с будущей датой, пустой reviewer, non-HTTPS approval reference или URL с userinfo не принимаются.
- Trust gate добавлен поверх текущего schema-v2 scorer. Существующие source-group overlap checks, distinct-group thresholds и cluster-bootstrap остаются нетронутыми.
- Inspect task продолжает читать тот же scorer; workflow передаёт Actions Variable только в процессе оценки. Секрет или manifest не включаются в runtime/Release.

## Одобрение реального набора

1. Независимо проверить происхождение, неизменяемую версию, лицензию, labeling protocol, source-group независимость и отсутствие train/holdout overlap.
2. Добавить точную запись в `trusted_memory_holdouts.json` отдельным reviewable PR.
3. Для записи указать dataset fingerprint, provenance-поля и review receipt (`reviewedAt`, `reviewedBy`, `approvalRef`).
4. После review вычислить `sha256sum evaluation/inspect_ai/trusted_memory_holdouts.json`.
5. Установить digest в Settings → Secrets and variables → Actions → Variables как `NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256`.

Пока manifest пуст и Actions Variable не задана, ни один внешний набор не может получить promotion eligibility. Unit-тест с временным manifest проверяет только корректность кода и не одобряет реальные данные.

## Границы

Manifest pin делает approval явным и воспроизводимым, но не заменяет независимую человеческую проверку аннотаций, юридическую проверку лицензии или аудит реальной независимости источников. HMAC group digest тоже не доказывает, что два source действительно независимы.

Нет изменений retrieval ranking, MemoryOS2 state, UserModel, пользовательских данных, зависимостей или Release ZIP. Автоматического promotion нет.
