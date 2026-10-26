# NK1 WorkPass361 — строгая и атомарная загрузка CognitiveEventFabric

**Дата:** 2026-10-26  
**Ветка:** `workpass361-event-fabric-restore-boundary`  
**База:** `work/nk1-substrate-restore-integrity-2026-10-26-r1` (stack поверх WorkPass355–360)  
**Статус:** код и регрессии внесены; exact-head CI ожидается.

## Найденный дефект

`CognitiveEventFabric.restore()` нормализовал часть повреждённых полей вместо сохранения их реального типа: дробный tick превращался в целое, строковые значения могли преобразовываться в boolean/number, а ID и parent ID trim/truncate. Прямое чтение полей из JS-снимка могло вызвать getters. Сам restore менял живой список событий и replay-index до завершения обработки снимка, поэтому исключение посередине могло оставить частично восстановленное состояние.

## Исправление

- Если в snapshot присутствует `version`, принимается только schema v1. Неизвестная версия и accessor-backed поля корневого snapshot отклоняются до изменения живого журнала.
- Поля event читаются через собственные data descriptors. ID проверяются без trim/truncate; tick должен быть safe integer; timestamp — конечным неотрицательным числом; `external` — boolean; confidence — конечным числом в `[0,1]`; parent ID должны быть каноническими строками.
- Вложенный payload копируется рекурсивно без вызова getters. Accessors, cycles, sparse/extended arrays, unsupported prototypes, undefined/functions/non-finite numbers, а также превышение лимитов глубины/числа узлов приводят к отбрасыванию строки.
- Events, receipt projection index и ссылки сначала формируются в локальных коллекциях. Live events/index/total обновляются в самом конце, после обработки всех ограниченных строк.
- Для старых снимков, где отсутствуют version и optional-поля узлов, сохранены консервативные defaults. Некорректные присутствующие значения не превращаются в валидное evidence.

## Регрессии

Добавлены в `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs`:
1. Контроль успешного восстановления валидного события.
2. Отбрасывание строковых/дробных тиков, строкового external, некорректной confidence, malformed parent ID и циклического payload.
3. Проверки, что getter поля event ID, root recent и вложенного payload не вызывается.
4. Проверка, что неизвестная schema version и root accessor не изменяют уже загруженный журнал.
5. Финальный маркер `WorkPass361 event-fabric restore boundary: PASS`; текущая команда `npm run test:canonical-cognitive-kernel` уже доступна.

## Файлы

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs`
- `CHANGELOG.md`

## Проверка и границы

Exact-head WorkPass331 (runtime typecheck + canonical kernel + live wiring/smoke/autonomy/dialogue/initiative/restart) должен завершиться успешно прежде, чем проход можно считать validated. Локальный запуск Node/TypeScript в этой среде не заявляется.

Это hardening восстановления причинного журнала, а не доказательство прироста обучаемости или готовности релиза. `main` не изменён; Release ZIP не пересобирался и не публиковался.
