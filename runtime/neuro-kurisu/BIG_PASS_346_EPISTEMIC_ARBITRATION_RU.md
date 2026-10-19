# BIG PASS 346 — ЭПИСТЕМИЧЕСКАЯ АРБИТРАЦИЯ ОРГАНИЗМА

## Цель
После B345 организм умел выбирать на основании уже известных последствий. B346 добавляет второй контур: когда внутреннее давление неопределённости высоко и нет внешнего запроса, организм оценивает **ценность уменьшения собственного незнания**.

Это не отдельный «модуль любопытства». Сигнал рассчитывается внутри DecisionActionPipeline из уже накопленного outcome history и текущего состояния организма.

## Реализованная петля
experience → outcome history → uncertainty → novelty of evidence → learnability → action cost → epistemic value → candidate ranking → action → new outcome → learning

## Формула
Для каждого кандидата:
- uncertainty = 1 - learned outcome confidence
- novelty = 1 - min(samples / 12, 1)
- learnability = f(candidate confidence, novelty)
- information opportunity = uncertainty × novelty × learnability × cost feasibility
- gate = internal epistemic pressure × cognitive-load gate × no-external-request
- epistemic adjustment ограничен ±/+= 0.018 и действует только как bounded arbitration signal.

## Почему это улучшение организма
Ранее при отсутствии достаточной истории неизвестные действия почти не отличались друг от друга. Теперь организм способен предпочитать действие, которое одновременно:
1. связано с существенным незнанием;
2. действительно является новым для его истории;
3. остаётся выполнимым по собственной оценке кандидата;
4. не конфликтует с внешним запросом пользователя;
5. не требует постоянного hard-coded bonus для конкретного action type.

## Доказательства
### Unit
B346_EPISTEMIC_ARBITRATION=PASS
- explore uncertainty 0.65, novelty 1.0, learnability 0.40, cost 0.20
- epistemic adjustment 0.007307
- verify: adjustment 0.000326
- external request полностью блокирует epistemic adjustment.

### Live Core
B346_CORE_EPISTEMIC=PASS
- 12 operational runtime cycles
- selected action: explore
- 7 actions получили ненулевой epistemic influence
- verify и reflect получили больший epistemic signal, чем explore, когда их learned history оставалась неопределённой
- influence зависит от candidate confidence и predicted cost, а не является одинаковым для всех неизвестных действий.

### Regressions
B345 learned consequence rehearsal — PASS.
B344 personality decision carryover — PASS.
Typecheck — PASS.
Core ownership — PASS.
Architecture — PASS.
Integrity — PASS.
Release contract — PASS.

## Ограничения
B346 не доказывает сознание, настоящую биологическую нейронность или полноценную самостоятельную научную мотивацию. Он закрывает более узкий инженерный разрыв: **собственный дефицит знаний теперь может менять arbitration конечного решения через вычислимую history-dependent epistemic value**.

Длинный объединённый audit bundle в этой сессии не использован как PASS, потому что предыдущие полные прогоны упирались в execution timeout. Это отдельно от функциональных PASS выше.

## Следующий критический шаг
Не добавлять новый motivational subsystem. Проверить developmental loop:

накопление outcome history → restart → новая ситуация → epistemic choice → результат → подтверждение/опровержение собственного uncertainty model → изменение личности/self-model → следующий выбор.

Главная цель: доказать, что организм **сам меняет стратегию исследования мира из-за собственной истории**, а не только получает epistemic bonus в одном тесте.
