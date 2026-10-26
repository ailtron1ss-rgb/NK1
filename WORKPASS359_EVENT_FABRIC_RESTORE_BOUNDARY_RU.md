# NK1 WorkPass359 — строгая и атомарная загрузка CognitiveEventFabric

**Дата:** 2026-10-26  
**Ветка:** `workpass359-event-fabric-restore-boundary`  
**База:** `work/nk1-substrate-restore-integrity-2026-10-26-r1` (stack поверх WorkPass355–358)  
**Статус:** код и регрессии добавлены; exact-head CI ожидается.

## Найденный дефект

`CognitiveEventFabric.restore()` принимал не все поля как их исходные типы: например, дробный tick превращался в целое, строковые значения использовались в Boolean/Number-преобразованиях, а `id` и parent ID нормализовались. Кроме того, прямые чтения вроде `raw.recent` и `event.id` могли вызывать getters, переданные через in-process snapshot. Восстановление поэтапно меняло живой event list/index, поэтому сбой посередине способен был оставить смешанное состояние.

## Реализация

- Если snapshot имеет поле `version`, принимается только версия 1. Неизвестная схема и accessor-backed поля корневого снимка отклоняются до mutation.
- Поля события читаются только через собственные data descriptors. ID должны быть каноническими строками; tick — non-negative safe integer; timestamp — конечное неотрицательное число; `external` — boolean; confidence — конечное число в `[0,1]`; parent IDs проверяются без trim/truncate.
- Вложенный payload копируется рекурсивно по собственным data descriptors. Getter не вычисляется; cycles, sparse/extended arrays, функции, undefined, non-finite numbers, unsupported prototypes и превышение лимитов глубины/узлов приводят к отказу от строки.
- Результат restore сначала строится в локальных коллекциях. Только после обработки ограниченного набора событий/receipt-index меняются живые `events`, replay index и total.
- Сохранена совместимость со старыми snapshot, где отсутствуют version или старые optional-поля; отсутствие обрабатывается консервативно, повреждённые присутствующие значения не превращаются в более сильные evidence.

## Регрессии

В `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` добавлено:
1. Контроль корректного restore валидного event.
2. Отбрасывание строковых/дробных tick, строкового external, некорректной confidence, неканонического parent ID и циклического payload.
3. Проверки, что getter на event ID, root collection и вложенном payload не вызывается.
4. Проверка, что неизвестная schema version отвергается, а предыдущий snapshot и event остаются неизменными.
5. Команда `npm run test:canonical-cognitive-kernel` уже зарегистрирована в runtime package; WorkPass331 workflow включает изменённые runtime/test пути.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` — strict bounded decoder, safe nested JSON clone, local restore preflight.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — регрессии restore boundary.
- `CHANGELOG.md` — WorkPass359 checkpoint.

## Проверка и границы

Exact-head WorkPass331 + runtime typecheck должен завершиться успешно прежде, чем проход можно считать validated. Локальное исполнение Node/TypeScript в этом проходе не заявляется.

Это hardening доверия к восстановленному причинному журналу, а не доказательство улучшения обучения/интеллекта. `main` не изменён; Release ZIP не пересобирался и не публиковался.
