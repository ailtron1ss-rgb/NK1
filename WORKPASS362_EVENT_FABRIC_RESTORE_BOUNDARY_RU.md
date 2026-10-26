# NK1 WorkPass362 — строгая и атомарная загрузка CognitiveEventFabric

**Дата:** 2026-10-26  
**Ветка:** `workpass362-event-fabric-restore-boundary`  
**База:** `work/nk1-substrate-restore-integrity-2026-10-26-r1` (stack поверх WorkPass355–361)  
**Статус:** код и регрессии добавлены; точная CI-проверка ожидается.

## Дефект

`CognitiveEventFabric.restore()` нормализовал некоторые повреждённые поля: дробный tick мог округляться вниз, строковые значения превращались в boolean/number, а ID и parent IDs обрезались. Прямое чтение полей in-process snapshot могло вызвать getters. Восстановление изменяло живой список событий и replay index поэтапно, так что неожиданная ошибка посередине могла оставить частично восстановленное состояние.

## Реализация

- При наличии `version` принимается только schema v1. Неизвестная версия и accessor-backed поля root snapshot отклоняются до mutation.
- Поля событий читаются только через собственные data descriptors. ID проверяются без trim/truncate; tick должен быть safe integer; timestamp — конечным неотрицательным числом; `external` — boolean; confidence — конечным числом в `[0,1]`; parent IDs — каноническими строками.
- Вложенный JSON payload копируется рекурсивно без вызова getters. Accessors, cycles, sparse/extended arrays, unsupported prototypes, функции, undefined, non-finite numbers и превышение лимитов глубины/числа узлов приводят к отбрасыванию строки.
- Events, receipt projection index и связанные ссылки сначала собираются локально. Живые `events/index/total` обновляются в конце после завершения bounded restore.
- Старые snapshot без version и optional-полей остаются совместимыми через консервативные defaults. Некорректные присутствующие значения не повышаются до валидного causal evidence.

## Регрессии

В `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs`:
1. Валидное событие остаётся доступным после restore.
2. Отбрасываются строковый/дробный tick, строковый external, некорректная confidence, malformed parent ID и циклический payload.
3. Ни event ID getter, ни root collection getter, ни вложенный payload getter не выполняются.
4. Неизвестная версия и root accessor не меняют текущий журнал.
5. Добавлен маркер `WorkPass361 event-fabric restore boundary: PASS`; `npm run test:canonical-cognitive-kernel` уже зарегистрирован.

## CI и границы

Соседний WorkPass360 запуск прошёл runtime typecheck и substrate unit test, затем упал в wiring assertion из-за точного строкового ожидания прежнего импорта; это было исправлено в upstream WorkPass361. В WorkPass362 не перенесён альтернативный вариант этого upstream test fix — сохранён актуальный test file из base. Точный WorkPass331 запуск на этом HEAD должен завершиться успешно прежде, чем проход можно считать validated.

Локальное исполнение Node/TypeScript не заявляется. Это hardening восстановления причинного журнала, а не доказательство прироста обучаемости/интеллекта. `main` не изменён; Release ZIP не пересобирался.
