# NK1 WorkPass354 — проверка происхождения якорей завершения

**Дата:** 2026-10-26  
**Ветка:** `workpass354-completion-anchor-provenance`  
**База:** `workpass353-completion-replay-preflight`  
**Статус:** exact-head CI прошёл на кодовом/тестовом HEAD `e3c1ee6797dfd846353fc09e63c636193ddb340c`; после записи этого evidence запускается повторная проверка актуального HEAD.

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
4. Дублирующийся неизвестный ID и ID с внешними пробелами/управляющими символами отклоняются до записи; нормализация lookup не должна менять родительскую ссылку.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/core/CanonicalCognitiveKernel.ts` — commits `959932c`, `41d6d5d`, `56056db`.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — commits `96aa5be`, `3689910`, `e3c1ee6`.
- `CHANGELOG.md` — commits `acb76bb`, `e77f54a`.
- Checkpoint — commit `967f37d`.

## Проверка и границы

**PASS на кодовом/тестовом HEAD `e3c1ee6797dfd846353fc09e63c636193ddb340c`:**
- [WorkPass331 unified cognitive kernel #40279861063](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279861063) — все шаги завершились успешно: runtime typecheck, canonical causal loop, goal lifecycle, live runtime wiring, smoke, autonomous action, dialogue/restore continuity, background initiative и restart.
- [WorkPass110 continual-learning metrics #40279861088](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279861088) — success.

Это валидирует указанный snapshot автоматическими тестами. Runtime-проверки локально не заявляются; field/Android/Live2D/voice E2E и измеренный прирост обучения из этих тестов не следуют.

`main` не изменён. PR WorkPass353 не слит; Release ZIP не пересобирался и не публиковался.
