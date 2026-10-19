# B363 — Five-Step Predictive Planning Evidence

## Цель
Закрыть следующий пункт SCS-DIT после причинной проверки B362: расширить причинно действующий B283 planner с horizon=3 до horizon=5 без потери restart/persistence и с сохранением ON/OFF/SHAM доказательства.

## Изменения
- B283 получил единый `planHorizon(..., horizon=3|5)`; `planThreeStep()` сохранён как совместимый wrapper.
- Core получил `predictivePlanningHorizon`, для B363 release по умолчанию 5.
- Persistence B283 теперь валидирует и сохраняет `plannedSequence` до 5 действий. Это отдельно поймано тестом: первоначальный restore обрезал 5 до 3 и был исправлен до release.
- planning bias сохраняет strongest first-step influence и затухает на последующих шагах.
- Конституционный арбитраж не обходится.

## Результаты component-level
`tests/big-pass-363-five-step-predictive-planning.mjs`: PASS 5/5.

Минимальный lesion effect по seeds: 0.086625.
Минимальный sham effect: 0.0000955.
Во всех 5 seed lesion существенно сильнее matched SHAM; restart сохраняет полный пятишаговый план.

## Результаты real Core
`tests/big-pass-363-core-five-step-planning.mjs`: PASS 5/5.

Все 5 Core instances получили `plannedSequence.length = 5`, `planningSteps = 5`; restart сохранил последовательность и imagined return.

`tests/big-pass-363-core-five-step-causal-selection.mjs`: PASS 5/5 независимых seed.

Causal L1 по пяти seed: 0.236993, 0.236826, 0.236779, 0.236739, 0.236726.
Минимальное отношение causal L1 / SHAM: ≈20.0×.
Во всех пяти seed SHAM совпал с OFF.

При этом конечный argmax Core в этих пяти специальных сценариях не изменился: `ON=OFF=SHAM`. Это не скрывается и не объявляется как action-level override. Доказан более слабый, но строгий результат: пятишаговый planner причинно сдвигает поле candidate scores примерно в 20× относительно matched SHAM, после чего downstream governance может сохранить другой argmax.

## Регрессия
B362 3-step Core causal test: PASS 5/5; minimum causal L1 ≈0.3611; minimum causal/sham ≈31.6×; final action changed 4/5.
B361 3-step Core smoke: PASS.

## Ограничения
- Physical Android/Termux execution: OPEN.
- Долгоживущий 100/500/1000-cycle planning endurance: OPEN.
- Phenomenal consciousness: UNKNOWN; эти тесты не являются доказательством субъективного сознания.
