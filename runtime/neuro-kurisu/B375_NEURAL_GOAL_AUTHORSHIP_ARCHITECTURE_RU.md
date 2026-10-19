# B375 — Нейронное авторство целей / Neural Goal Authorship

## Статус
CURRENT / IMPLEMENTED / CAUSALLY VERIFIED

B375 не создаёт второго нейронного decision-owner. Каноническим нейронным субстратом остаётся B365 Unified Neuro Causal Core.

## Архитектурный разрыв B374

B374 дал предиктивную модель собственного будущего состояния и автобиографическую консолидацию. Но цель всё ещё попадала в B365 преимущественно как `goalPressure`/`goalVector`, то есть организм мог моделировать себя, но ещё недостаточно явно моделировал **авторство собственной цели**.

## Новая causal chain

`B272/B273 candidate → B365 ownership gate → commitment → neural action-bias → action → verified outcome → goal-readout learning → revision pressure → future policy`

External candidate проходит тот же gate, но не получает высокий ownership только потому, что был предложен извне.

## State

`goalAuthorship` хранит:
- candidate id/vector/source;
- novelty/confidence;
- ownership;
- commitment;
- revision pressure;
- accepted/rejected counters;
- verified outcomes;
- counterfactual checks;
- action bias;
- persistent neural readout;
- history последних 96 goal-authoring событий.

## Causal mechanism

Внутренняя цель получает ownership только при достаточном сочетании:
- внутреннего источника;
- внутреннего давления;
- homeostatic pressure;
- identity continuity;
- autonomy;
- confidence.

После независимого verified outcome изменение `goalAuthorship.readout` разрешается. Непроверенный outcome не имеет права менять этот readout.

## Почему это не декоративная личность

Новая часть непосредственно добавлена в `baseLogits` B365 и меняет action probabilities. После обучения readout используется снова на следующем шаге. Состояние сохраняется и восстанавливается через B365 snapshot/restore.

## Evidence

B375 direct causal test:
- initial ON/OFF policy L1: `0.02821668`;
- future divergence after verified learning: `0.45905786`;
- neural goal-readout delta: `0.01646906`;
- unverified goal-readout delta: `0`;
- verified outcomes: `1`;
- counterfactual checks: `2`;
- restart equality: `true`.

## Performance

300 cycles:
- p50: `3.9806 ms`;
- p95: `11.5389 ms`;
- p99: `33.6555 ms`;
- max: `38.5124 ms`;
- heap: `19.46 MiB`;
- goal verified outcomes: `300`;
- bounded self episodes: `64`.

Это host benchmark, не физическая Android-сертификация.
