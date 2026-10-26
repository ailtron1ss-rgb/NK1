# WorkPass347 — защита целостности причинного журнала

**Дата:** 2026-10-26  
**Репозиторий:** https://github.com/ailtron1ss-rgb/NK1  
**Ветка:** `workpass347-cognitive-event-envelope-current-base-2026-10-26`  
**База:** `work/nk1-final-release-gate-2026-10-26-r3`  
**SHA базы:** `489fe7d735c5bb00af484f40415f1769b313c479`  
**Статус:** исправление и регрессии добавлены; exact-head CI для новой интеграционной ветки ожидает завершения.

## Исправленные дефекты

1. Повторный ID события принимался при совпадении только tick/stage/source. Теперь сравнивается стабильный fingerprint полного конверта: tick, timestamp, stage, source, упорядоченные parent IDs, external, confidence и payload.
2. Payload глубоко отделяется от caller-owned объектов. Циклические, неподдерживаемые и чрезмерно большие данные отклоняются до изменения event ledger; getters для объектов и индексов массивов не выполняются.
3. Нормализуется Date без вызова методов, переопределённых вызывающим кодом.
4. Небезопасные tick и недопустимый явно заданный timestamp отклоняются до мутации.
5. Нечисловая конфигурация capacity переводится на bounded default, а не отключает ограничение размера журнала.
6. Невалидные `source`, элементы `parentIds` и payload верхнего уровня отклоняются без `String(...)` coercion; `toString` вызывающего кода не запускается. Отсутствующий/null payload остаётся допустимым пустым конвертом.
6. Повреждённая persisted row не резервирует ID и не затеняет следующую корректную запись с тем же идентификатором.
7. Сохранены ранее добавленные postcondition fingerprints в receipt evidence для проверки replay после восстановления без bounded projection index.

## Регрессии

- Идентичный JSON с другим порядком ключей остаётся идемпотентным.
- Изменение любого поля causal envelope при том же ID вызывает conflict без изменения event total.
- Retry без timestamp сохраняет исходное время.
- Мутация входного, возвращённого или найденного nested payload не меняет хранимое событие.
- Object/array getters и методы экземпляра Date не исполняются.
- Циклы, превышение depth/node/array/key лимитов, некорректные clocks и невалидная capacity не мутируют журнал.
- Ошибочная persisted row не мешает восстановлению корректной строки с тем же ID.
- Receipt с изменённым postcondition отклоняется и после потери bounded index; точный replay остаётся идемпотентным.

## Интеграция CI

- `runtime/neuro-kurisu/package.json`: `test:big-pass-161:cognitive` включён в `test:cognitive-integration-suite`.
- `.github/workflows/cognitive-integration-suite.yml`: файл регрессий включён в path filters для pull request и push.
- `CHANGELOG.md`: WorkPass347/346 размещены перед WorkPass345/344 без потери недавних release-date metadata исправлений.

## Проверка и статус

Существовавший прогон PR #169 на старом SHA упал из-за двойного экранирования regex для контроля event ID: обычные ID с цифрами ошибочно отклонялись. Дефект исправлен; старый failure сохраняется как регрессионное доказательство, а не скрывается.

**Не считать изменение закрытым**, пока новый Unified project integration suite, typecheck и event-fabric regression не пройдут на точном HEAD этой ветки. Ранее зелёные проверки на других SHA не переносятся на текущий SHA.

## Сопоставление с 421-шаговым чек-листом

- Шаг 72 — валидация конверта: **частично**, покрыты event identity/payload/clock, не весь набор типов событий.
- Шаги 73–75 — causal identity, tick integrity, exact replay: **реализация готова; CI этой ветки ожидается**.
- Шаги 76–78 — атомарность многостадийного kernel и восстановление после crash: **не закрыты этим изменением**; требуется интеграция/проверка WorkPass350–352.
- Шаг 79 — bounded capacity и retention: **guard и регрессии добавлены; общий retention audit частичный**.
- Шаги 80–85 — восстановление causal links, replay и проверка receipts: **частично**, требуется сквозная интеграционная проверка с реальным ActionGateway.


## Дополнительная проверка текущего release-candidate base

После initial envelope-регрессий добавлена строгая проверка runtime-входов: невалидный source, parent ID или верхнеуровневый payload не преобразуется молча в строку/пустой объект. Это уменьшает риск потери provenance и execution of caller-controlled coercion. **Эти последние изменения требуют свежего exact-head CI; предыдущий PASS на SHA `6a4d1920c51d420f78b7fdcd2a7bda1a2b79ddb5` не относится к новой ревизии.**
