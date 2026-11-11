# WorkPass74 — доверенный manifest независимого memory holdout

## Обнаруженная проблема

WorkPass73 проверяет структуру RU/EN paired holdout, fingerprints, качество ранжирования и заявленные provenance-поля. Но поля \`datasetId\`, \`datasetVersion\`, \`sourceRef\`, \`labelingProtocol\`, \`licenseId\` и \`contentHashValid\` поступают от того же producer, который экспортирует отчёт. Совпадение \`contentSha256\` с переданным fingerprint подтверждает внутреннюю согласованность, но не доказывает независимость источника или факт человеческой разметки.

Текущий unit fixture с \`https://datasets.example.org/...\` демонстрировал это: непустые, но придуманные поля могли пройти quality gates. Такой результат нельзя считать подтверждённым независимым holdout.

## Изменение

- Добавлен \`evaluation/inspect_ai/trusted_memory_holdouts.json\`. Начальный список пуст: ни один внешний датасет автоматически не одобрен.
- Добавлен \`nk1_memory_trust.py\`: точное совпадение dataset fingerprint и provenance с allowlist, проверка review receipt и SHA-256 всего manifest-файла.
- Для promotion требуется внеполосный pin \`NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256\`.
- Inspect task использует тот же scorer, но теперь \`promotionEligible\` остаётся false, если manifest отсутствует, изменён или не содержит точной записи.
- В CI pin читается из repository Actions variable \`NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256\`; пустое значение означает fail-closed.
- Добавлены положительный тест с временным manifest, отказ при tampering и отказ для неразрешённого fingerprint.

## Одобрение реального набора

1. Независимо проверить происхождение, неизменяемую версию, лицензию, labeling protocol, source-group независимость и отсутствие train/holdout overlap.
2. Добавить точную запись в \`trusted_memory_holdouts.json\` отдельным reviewable PR.
3. Для записи указать dataset fingerprint, все provenance-поля и review receipt (\`reviewedAt\`, \`reviewedBy\`, \`approvalRef\`).
4. После review вычислить \`sha256sum evaluation/inspect_ai/trusted_memory_holdouts.json\`.
5. Установить полученный digest в Settings → Secrets and variables → Actions → Variables как \`NK1_TRUSTED_HOLDOUT_MANIFEST_SHA256\`.

Если manifest изменяется, Actions variable нужно обновить. Без совпадающего pin scorer не выдаёт promotion eligibility.

## Границы

Manifest pin защищает от случайного или самодекларируемого provenance и делает одобрение явным и воспроизводимым. Он не заменяет аудит самого датасета, независимую человеческую проверку аннотаций или source-group holdout. HMAC group digest также не доказывает реальную независимость источников. Для этого остаётся отдельная работа PR #770.

Никакой retrieval ranking, MemoryOS2 state, UserModel, пользовательские данные или Release ZIP этим проходом не меняются. Автоматического promotion нет.
