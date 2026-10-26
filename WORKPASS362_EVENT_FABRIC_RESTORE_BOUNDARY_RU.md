# NK1 WorkPass362 — строгая и атомарная загрузка CognitiveEventFabric

**Дата:** 2026-10-26  
**Ветка:** `workpass362-event-fabric-restore-boundary`  
**База:** `work/nk1-substrate-restore-integrity-2026-10-26-r1` (stack поверх WorkPass355–361)  
**Статус:** PASS на source/test HEAD `1f92e8eed3e17ff0aa2722b3af7165da056bcb3a`. Последующие коммиты меняют только checkpoint/CHANGELOG.

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
5. Добавлен маркер `WorkPass362 event-fabric restore boundary: PASS`; `npm run test:canonical-cognitive-kernel` уже зарегистрирован.

## CI и границы

**Exact-head PASS на source/test snapshot `1f92e8eed3e17ff0aa2722b3af7165da056bcb3a`:**
- [WorkPass331 unified cognitive kernel #40282530812](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40282530812) — success, все 23 шага; runtime typecheck, substrate restore/wiring, canonical loop, live runtime, smoke/autonomy/dialogue/background initiative/restart.
- [WorkPass110 continual-learning metrics #40282530835](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40282530835) — success, все 48 шагов.

Более ранний WorkPass360 запуск действительно падал на старом exact-string wiring assertion; это upstream-изменение исправлено до указанного source/test snapshot. Документационные коммиты после указанного SHA не меняют runtime/test файлы.

Локальное исполнение Node/TypeScript не заявляется. Это hardening восстановления причинного журнала, а не доказательство прироста обучаемости/интеллекта. `main` не изменён; Release ZIP не пересобирался.
