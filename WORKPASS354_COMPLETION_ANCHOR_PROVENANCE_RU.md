# NK1 WorkPass354 — проверка происхождения якорей завершения

**Дата:** 2026-10-26  
**Ветка:** `workpass354-completion-anchor-provenance`  
**База:** `workpass353-completion-replay-preflight`  
**Статус:** код и регрессии добавлены; требуется exact-head CI.

## Проблема

Kernel принимал перечисленные в `anchors` ID исходных событий и использовал их для создания `outcome`, `learning`, `self-update`. Проверка идентичности completion-записей защищала стабильные ID этих трёх событий, но сама по себе не запрещала caller указать, например, observation от тика 41 вместе с action/plan тика 42. При доступном в буфере событии kernel мог сохранить feedback с ложной причинной связью; поздний lineage-verifier отмечал бы цикл неполным, но загрязняющая запись уже была бы в журнале.

## Исправление

До первого completion-write kernel теперь проходит по каждому заданному canonical anchor:
- если запись сохранена, её `tick` должен совпадать с логическим тиком завершения;
- её `stage` должен совпадать с ролью в `anchors`;
- один event ID не может одновременно обозначать несколько стадий;
- обнаруженное несоответствие приводит к `canonical-cognitive-kernel-anchor-provenance-conflict` до записи outcome/learning/self-update и до продвижения cycle ledger.

Осознанно сохранено поведение для отсутствующих в ограниченном буфере записей: запоздавший результат можно записать как неполное evidence, но verifier не должен считать его полным циклом без обязательных причинных связей. Это важно для обратной совместимости с поздними результатами после retention eviction.

## Регрессии

1. Решения тиков 41 и 42 создаются отдельно; завершение тика 42 с observation-якорем тика 41 должно быть отклонено.
2. При отказе не создаются `cef:kernel:42:outcome`, `learning`, `self-update`; количество событий и счётчик циклов остаются прежними.
3. Завершение без якорей остаётся допустимым, но должно быть помечено как incomplete, чтобы late outcome evidence не превращалось в искусственно полный цикл.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/core/CanonicalCognitiveKernel.ts` — commit `959932c`.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — commit `96aa5be`.
- `CHANGELOG.md` — commit `acb76bb`.

## Проверка и границы

Существующий WorkPass331 workflow содержит изменённые runtime/test файлы, полный runtime typecheck, canonical kernel regression, live wiring, smoke, autonomy и restart tests. Этот проход не считается validated до наблюдения завершённого успешного workflow на его актуальном HEAD. Runtime-проверки локально не заявляются.

`main` не изменён. PR WorkPass353 не слит; Release ZIP не пересобирался и не публиковался.
