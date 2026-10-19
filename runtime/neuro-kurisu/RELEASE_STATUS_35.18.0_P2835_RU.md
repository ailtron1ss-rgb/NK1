# Release Status — 35.18.0 / P2835

Статус: research-release

## Главный результат

P2835 связывает P2820 self-teacher/coreset с P2805 stability/plasticity и P2774/P2750 model-time/world-model learning.

Главная новая связь:

`context provenance → transfer compatibility → replay gate → neural update safety`

## Доля работы

- Production code: 84%
- Tests / ablations / validation: 11%
- Research / docs / release engineering: 5%

## Evidence

- `P2820_SYNERGY_MATRIX=PASS` — 28 runs, 2 regimes, 7 variants, 2 seeds.
- `P2835_TRANSFER_SAFETY_SYNERGY=PASS` — 8-run shortened matched battery.
- `P2835_HOTPATH_SMOKE=PASS`.
- Typecheck: PASS.

## Known debt

1. Полный all-layer factorial должен запускаться как набор изолированных processes.
2. Real Android/Termux telemetry всё ещё не заменена host-side evidence.
3. Positive/negative transfer остаются task-dependent.
4. Full-stack reward не обязан улучшаться на коротком горизонте — это нужно оценивать на holdout и long-horizon.
5. Следующий selective-reset вариант стоит сравнить с FIRE-подобным safety criterion.
