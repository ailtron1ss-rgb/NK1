# B305 Next Step Plan
Дата: 13.09.2026

## Приоритет 1 — реальный Android evidence
Запустить `scripts/run-b305-termux-benchmark.sh` на Termux на целевом среднем телефоне с `B305_CYCLES=48`, затем повторить с 96. Собирать модель, Android SDK, RSS, latency, thermal/battery/RAM pressure, full/micro ratio.

## Приоритет 2 — закрыть слабые edges критической цепи
Особенно:
- policy -> externally verified outcome;
- outcome -> durable checkpoint;
- autonomous outcomes, а не только user/external prompts.

## Приоритет 3 — targeted verification debt
Не пытаться проверить 3700 функций подряд. Добавлять доказательства к узким critical paths, которые реально участвуют в искусственной личности.

## Приоритет 4 — только после этого расширять autonomy
Следующая сильная проверка должна показать, что изменившаяся personality policy влияет на будущие autonomous cycles без внешнего user prompt и переживает restart.
