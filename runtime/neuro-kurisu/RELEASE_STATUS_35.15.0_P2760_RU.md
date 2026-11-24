# Release Status — 35.15.0 / P2760

## Состояние
Статус: **research-release / validated engineering increment**.

P2760 добавляет явное resource-aware continuum memory scheduling поверх P2750 unified causal/world loop.

## Доля работы прохода
- production code: **84%**
- tests/validation: **11%**
- research/docs/release: **5%**

## Ключевые результаты
- typecheck: PASS
- P2760 continuum memory: PASS
- P2750 core/interference/fallback/mobile: PASS отдельными процессами
- P2734: PASS
- P2726: PASS
- P2720: PASS
- P2716 deep/continual/promotion/soak: PASS
- P2708 deep/continual/long: PASS

## Ключевой инженерный результат
Многошкальная память теперь обновляется не одинаково на каждом событии. Update frequency зависит от memory level и resource pressure; подтверждённая информация проходит downstream bridges.

## Ограничения
Полная длительная battery запускается дочерними процессами. Это необходимо из-за реального resource accumulation в одной Node VM. Timeout длинной объединённой цепочки не считается PASS.

Host smoke может занимать около 650+ MB RSS в текущем окружении. Поэтому mobile efficiency ещё не закрыта для medium Android без физического device run.
