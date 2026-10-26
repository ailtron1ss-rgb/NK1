# NK1 — текущий инженерный статус WorkPass355

- Дата среза: 2026-10-26
- Ветка: `work/nk1-release-metadata-freshness-workpass355-r1`
- Базовый code SHA: `1e6a9f6581fc97401e6fdcc1458e4dd262ad0af9`
- Проверка новых изменений: **PENDING exact-head CI**.
- Этот документ отражает implementation checkpoint; это не заявление о готовности релиза.

## Изменения в текущем проходе

1. Добавлен fail-closed release metadata gate: manifest WorkPass не может отставать от первого актуального WorkPass-заголовка в CHANGELOG.
2. Добавлен gate даты: дата выпуска не может быть раньше даты текущего заголовка CHANGELOG.
3. Добавлены регрессии на stale WorkPass, stale date и допустимый более старый опубликованный baseline.
4. Синхронизированы root package и SUPER_VERSION с implementation checkpoint WorkPass355.
5. Обновлены README, CHANGELOG и верхний статус списка задач; исторический WorkPass70 backlog сохранён как история.
6. Добавлен канонический root command `npm run audit:workpass355`.

## Открытые блокеры

- Тесты metadata freshness и полный exact-head release gate должны пройти на одном текущем SHA.
- Интегрировать WorkPass369 operational-cycle atomicity и P26 learning/holdout contract в корректном порядке зависимостей.
- Провести независимую RU/EN оценку memory-to-action и learning transfer.
- Выполнить реальные browser/Live2D/Android voice-avatar E2E и длительный soak.
- Проверить чистую установку, лицензии/provenance, собрать ZIP из exact tested SHA, проверить SHA-256 и заново протестировать распакованный архив.

## Контроль доказательств

`implemented`, `integrated`, `tested-pass`, `field-validated` и `released` — разные состояния. Ни один PASS со старого SHA не переносится на новый автоматически.
