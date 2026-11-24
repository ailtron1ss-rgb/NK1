# Neuro-Kurisu 35.6.1 — B302 Release Notes

## Основное изменение

B302 добавляет Long-Horizon Development Ledger. Это не новая personality database и не новый neural substrate. Он связывает evidence от уже существующих B296/B299/B300/B301/B285 и измеряет их изменение на длинной последовательности опыта.

## Ключевые результаты

- 96 ticks;
- 30 full cognitive pulses;
- 66 micro-cycles;
- 8 autonomous full cycles;
- 6 verified world transitions;
- 4680 B296 synaptic updates;
- 3 B285 consolidations;
- restart сохранён.

## Mobile

Последний B301 checkpoint smoke:
- 4.657 MB → 4.270 MB;
- ~8.32% уменьшение bounded history projection.

При этом проект пока не считается «гарантированно готовым для любого среднего телефона»: host benchmark показывал peak RSS около 433 MB на этом контейнерном тесте. Это не Android measurement, но достаточный сигнал сохранять mobile optimization как активное направление.

## Harness note

B302 standalone benchmark явно завершает процесс после assertions, поскольку OrganismCore host context оставляет stdio sockets. Это не изменение runtime behavior.

## B303 compatibility recheck addendum
B302 long-horizon benchmark now uses `beginBatch/endBatch` to separate cognitive endurance from intermediate persistence overhead. `OrganismCore.snapshot()` now explicitly synchronizes B302 micro-cycle state before clone, closing a real restart-loss path discovered during B303 recheck.
