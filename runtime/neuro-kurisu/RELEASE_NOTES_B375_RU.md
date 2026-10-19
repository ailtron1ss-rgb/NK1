# Release Notes — B375 / 35.6.25

## Главный апгрейд

B375 превращает существующий goal-generation path в часть causal neural spine B365.

Новая цепь:

`внутренний goal candidate → ownership → commitment → B365 policy → action → verified outcome → goal-readout learning → revision pressure → будущая policy`

## Что НЕ сделано

- не создан второй decision-owner;
- не объявлено сознание;
- host evidence не объявлен Android evidence;
- unverified outcomes не допускаются к goal-readout learning;
- старые исторические отчёты не переписаны ради красивого прогресса.

## Verified evidence

Initial ON/OFF policy divergence: `0.02821668`
Future divergence after verified learning: `0.45905786`
Verified readout delta: `0.01646906`
Unverified readout delta: `0`
Restart equality: `true`

## Regression

B365/B367/B368/B369/B371/B372/B373/B374: PASS.

## Performance

300 cycles: p50 `3.9806 ms`, p95 `11.5389 ms`, p99 `33.6555 ms`, max `38.5124 ms`, heap `19.46 MiB`.

## Caveat

Физический Android/Termux всё ещё не сертифицирован в текущем окружении.
