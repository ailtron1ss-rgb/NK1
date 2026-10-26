# WorkPass368 — атомарное восстановление ledger исполнения ActionGateway

**Дата:** 2026-10-26  
**Ветка:** \`workpass368-action-ledger-restore-atomic\`  
**База:** \`workpass367-receipt-lineage-verification\`  
**Статус:** реализация и регрессионный тест добавлены; exact-head CI ожидает завершения.

## Проблема

Старый \`restoreExecutionLedger()\` напрямую читал поля снимка, использовал \`String()/Number()\` для identity/counters и выполнял \`structuredClone(response)\`. Getter из повреждённого in-process снимка мог исполниться. Более серьёзно: live execution ledger очищался до того, как полностью обрабатывался approval-state. Если проверка или клонирование approval-поля бросала ошибку, runtime мог остаться с пустым ledger. Пропуск строки с malformed key/request hash также создавал риск забыть idempotency key для операции, внешний side effect которой уже мог произойти.

## Изменения

- Проверяется plain-record shape, schema version (если указана), тип контейнера \`records\`, плотность/размер массивов и собственные data descriptors. Accessor-backed root/receipt/permission fields отклоняются без вызова getter.
- Повреждённые key hash, request hash, status или recordedAt теперь отклоняют весь снимок до изменения живого состояния. Дубли одного ключа с различными содержимыми также остаются конфликтом.
- Данные completed response клонируются ограниченным обходом: предел глубины 32, максимум 16 384 узлов и 4096 элементов массива; отвергаются циклы, accessors, неподдерживаемые прототипы, sparse/extended arrays и не-JSON значения. Неопределённые object-поля пропускаются.
- Нечитаемая/небезопасная response не удаляет запись операции: completed запись сохраняется как tombstone с \`responseOmitted: true\`, чтобы обычный replay не запускал executor повторно.
- Approval records строятся через allow-list, а не через spread произвольного snapshot object. Счётчики должны быть неотрицательными safe integers; expiration применяется к staged state.
- Execution ledger и approval-state заменяются только после успешной сборки обеих коллекций. Любая schema/error-валидация до commit оставляет прежний state нетронутым.
- Добавлен \`npm run test:workpass368:restore-boundary\`; unified WorkPass331 workflow теперь запускает его с receipt-integrity и archived-reconciliation регрессиями.

## Проверяемые свойства

1. Legacy snapshot без \`version\`/approval section остаётся читаемым.
2. Unknown version, неверный тип records, accessor на root/row/permissions и дробный approval counter завершаются ошибкой без изменения прежнего состояния.
3. Root-, identity-row- и permission-getter не вызываются.
4. Nested getter в completed response превращает его в безопасный tombstone без чтения getter.
5. Повтор с тем же idempotency key после opaque/tombstoned receipt возвращает \`idempotency-recovery-required\`; tool executor не вызывается второй раз.
6. Явный \`responseOmitted: true\` остаётся терминальным даже при наличии устаревшего response body.

## Границы

Это укрепляет восстановление локальной очереди исполнения и гарантию «не выполнять повторно без reconciliation». Оно не доказывает, что все внешние adapters имеют авторитетные provider receipts, и не превращает неизвестный результат side effect в успешное выполнение. Никакой merge в \`main\` и обновление Release ZIP не выполнялись.