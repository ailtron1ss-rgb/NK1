# NK1 WorkPass364 — строгая граница записи CognitiveEventFabric

**Дата:** 2026-10-26  
**Ветка:** workpass364-event-fabric-append-ingress  
**База:** WorkPass363 head 9b507034237c9366b9842829adcd58fbbfdd0494  
**Статус:** первый runtime typecheck поймал TS2322 в сужении типа event ID — исправлено (`f6a15d15ddc3a40263d758c160567cf746652ada`). Canonical-kernel затем обнаружил, что legacy top-level payload accessor compatibility была ошибочно изменена в restore; исправлено правильное место append в 6e925824e07c9bf9d4e5127f308eecdf72b7fe89. Exact-head CI должен перепройти.

## Найденный разрыв

Восстановитель WorkPass362/363 уже отклонял дробные или строковые ticks, отрицательные timestamps, некорректные confidence/external и неплоские payload. Но публичный append нормализовал некоторые из этих полей, мог оставить NaN tick, принимал неизвестные stage и копировал вложенный payload через structuredClone. Поэтому журнал мог записывать запись, которую его же restore затем удалял, а getters могли исполняться на входе.

## Изменения

- Проверка собственного data descriptor для полей входного объекта, без исполнения getter-функций.
- Tick должен быть неотрицательным safe integer; явно переданный timestamp — конечным неотрицательным числом.
- Проверяются перечисление CognitiveStage, boolean external, confidence в [0,1] и канонические уникальные parent IDs; malformed данные больше не coercеятся.
- Вложенные payload копируются через ограниченный plain-JSON clone, совместимый с restore; cycles, accessors, non-JSON values, extended/sparse arrays и превышение бюджета отклоняются до записи.
- Существующая атомарность сохраняется: счётчик и события изменяются только после полной проверки всех полей и сериализуемости payload.

## Регрессии

- Прямые append-тесты на string/fractional/negative/unsafe tick, некорректное время, stage, external, confidence и parent IDs.
- Getter-тесты для входного объекта и вложенного payload.
- Проверка сохранности текущего snapshot после каждого отказа и round-trip для корректного события.

## Проверка и границы

- Тесты добавлены в существующий canonical cognitive kernel suite, чтобы использовать уже подключённый WorkPass331 workflow.
- Exact-head CI должен пройти на новом SHA; прошлые WorkPass363/362 PASS не переносятся автоматически.
- Не заявляются локальный запуск, доказанный прирост обучения или release readiness. main и опубликованный Release ZIP не менялись.
