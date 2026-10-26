# WorkPass353 — защита полной идентичности причинного события

**Дата:** 2026-10-26  
**Ветка:** `workpass353-active-event-envelope-integrity-2026-10-26`  
**База:** проверенный release-gate HEAD `d795bd5513f0a99176c79f10d18c8cb4e69ced23`  
**Статус:** исправление и регрессии добавлены; exact-head CI ещё должен подтвердить изменения.

## Дефект

Активный `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` считал событие с повторным ID идемпотентным, если совпадали только tick, stage и source. Другие поля причинного конверта могли отличаться без отказа: timestamp, parent IDs, external flag, confidence и payload. Кроме того, payload копировался поверхностно, так что вложенные объекты оставались разделяемыми ссылками.

## Исправление

1. Нормализовать event envelope до изменения журнала.
2. Для повторного ID сравнить стабильный fingerprint всех полей: tick, timestamp, stage, source, порядок причинных родителей, external, confidence и рекурсивно очищенный payload.
3. Если timestamp при повторе опущен, использовать timestamp уже сохранённого события; явный timestamp остаётся частью идентичности.
4. Рекурсивно отделять входной payload от внутреннего состояния; циклический JSON несовместимый payload отклонять до первой записи.
5. Не вызывать getter/accessor свойства при подготовке payload.
6. Возвращать deep clone из append и для receipt events в snapshot.
7. Добавить regression в `tests/big-pass-161-cognitive-event-fabric.mjs` и включить его в `test:cognitive-integration-suite`.
8. Добавить точный путь теста в push и pull_request path filters workflow.

## Регрессии

- Точный повтор с другим порядком ключей JSON остаётся идемпотентным.
- Изменение timestamp, tick, stage, source, parent IDs, external, confidence или payload при прежнем ID вызывает `cognitive-event-id-conflict` без изменения total.
- Retry без timestamp сохраняет исходное время.
- Изменение входного или возвращённого вложенного payload не меняет запись в журнале.
- Вложенный getter не исполняется.
- Циклический payload отклоняется без добавления события.

## Команды проверки

```bash
cd runtime/neuro-kurisu
npm run typecheck
npm run test:big-pass-161:cognitive
npm run test:unified-substrate-runtime-wiring
npm run test:smoke
npm run test:autonomy
npm run test:restart
npm run test:cognitive-integration-suite
```

## Ограничения и критерий закрытия

Это улучшает целостность причинного журнала, но само по себе не доказывает общий рост интеллекта или качества обучения. Считать проход validated можно только после успешного exact-head workflow на ветке WorkPass353. Далее требуется сквозная проверка action receipt → postcondition → causal ledger → persistence/restart.
