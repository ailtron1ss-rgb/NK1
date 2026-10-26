# NK1 WorkPass369 — атомарная запись полного когнитивного цикла

**Дата:** 2026-10-26  
**Ветка:** workpass369-atomic-operational-cycle  
**База:** WorkPass368 head `a45b3700ad3e6029e49cf77e7d6a07004e865448`  
**Статус:** typecheck прошёл; первый canonical-kernel run выявил ошибочную expected-string у phase-accessor test, исправлено в a43577446a02eed1b6f8a19bd8205811db280705. Нужен повтор exact-head CI.

## Найденный дефект

`recordOperationalCycle()` по очереди записывал observation, prediction, appraisal, attention, memory, goal, plan, action, outcome, learning и self-update. Если поздняя стадия имела недопустимую confidence/payload или append бросал исключение, более ранние события оставались в журнале как незавершённый цикл. Кроме того, прямое чтение root/phase полей могло выполнить user-supplied getter до валидации.

## Изменения

- Снятие own-data snapshot для корневого input и каждой phase без вызова getter-функций.
- Предварительная проверка tick/at, типов source/external/confidence и deep-clone всех payload до начала записи.
- Вся запись стадий выполняется внутри `withAtomicLedgerMutation()`, с rollback событий, total и receipt index при любом исключении.
- Порядок и causal parents для всех стадий сохранены.

## Регрессии

- Ошибка confidence на поздней стадии не пишет ранние стадии.
- Accessor-backed root/phase inputs и nested payload не исполняют getter.
- Искусственная ошибка на третьем append откатывает весь цикл.
- Успешный полный цикл подтверждает observation→prediction, plan→action, action→outcome, outcome→learning, learning→self-update.

## Границы

- CHANGELOG/checkpoint обновлены; `main` и published Release ZIP не менялись.
- Требуются свежие exact-head TypeScript, canonical-kernel и learning-metrics workflows.
