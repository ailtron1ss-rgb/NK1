# BIG PASS 338 — Endogenous Goal Plasticity + Real Runtime Closure

Дата: 2026-09-14
Версия архива: Neuro-Kurisu 35.6.1

## Главный вывод

B338 исправляет конкретный разрыв organism-level причинной петли, найденный при перепроверке B337/master-audit.

До B338 `B272EndogenousGoalGenesis.learnFromOutcome()` и связанный `B273AutonomousGoalLifecycle.learnFromOutcome()` находились внутри ветви `if (!outcome.worldTransition)` в `OrganismCore.feedback()`.

Это означало:

`обычный runtime -> действие -> реальный/simulated worldTransition -> feedback`

но для B272:

`worldTransition -> B272 learning = НЕ ВЫПОЛНЯЕТСЯ`.

То есть система могла менять policy/neural/world state после реального перехода, но эндогенный генератор целей не обучался от собственного последствия в том же реальном контуре.

B338 добавляет common-path bridge для `outcome.worldTransition` после synthetic/non-transition branch. Существующая synthetic ветка не дублируется; для реальных world transitions теперь выполняются:

- B272 goal-outcome learning;
- B273 autonomous-goal lifecycle learning;
- persistence of their learned state.

## Собственно функциональное улучшение B272

B272 получил небольшой ассоциативный persistent memory layer `goalOutcomeMemory`.

Для каждого endogenous goal сохраняются:

- goal vector prototype;
- mean reward;
- mean prediction error;
- update count;
- last tick.

При генерации следующего endogenous goal candidate система ищет похожие ранее встречавшиеся goal vectors и добавляет bounded learned closure bias к `predictedFutureValue01`.

Это не утверждение о сознании и не полноценное reinforcement-learning доказательство. Это конкретный новый causal seam:

`endogenous goal -> outcome -> learned goal memory -> future goal valuation`

### Persistence

`goalOutcomeMemory` входит в B272 snapshot/restore и имеет backward-compatible defaults.

## B338 unit evidence

PASS:

- goal outcome memory entries = 10;
- learned goal closure > 0.30;
- positive goal experience creates positive learned goal bias;
- restore сохраняет goal outcome memory;
- restored memory сохраняет positive bias.

Команда:

`node --experimental-strip-types tests/big-pass-338-endogenous-goal-plasticity.mjs`

Результат:

`B338_ENDOGENOUS_GOAL_PLASTICITY=PASS memory=10 closure=0.316 learnedBias=0.0160 next=1.000`

## B338 REAL RUNTIME evidence

PASS на коротком реальном `OrganismRuntime` контуре:

- 6 runtime ticks;
- 6 goal outcome memory entries;
- 6 endogenous goal learning updates;
- learned goal closure = 0.279.

Это важнее прежнего B272 unit-only статуса: подтверждено, что обычный runtime world-transition feedback действительно теперь достигает endogenous goal learner.

Команда:

`node --experimental-strip-types tests/big-pass-338-endogenous-goal-plasticity-core.mjs`

Результат:

`B338_CORE_REAL_RUNTIME=PASS ticks=6 goalMemory=6 learning=6 closure=0.279`

## Регрессии / инфраструктура

PASS:

- `npm run typecheck`
- `npm run audit:core-ownership`
- `npm run audit:architecture` — PASS, sourceFiles=1211, canonicalFiles=399, cycles=0
- `npm run audit:integrity` — PASS, files=2596, schema=127
- `npm run audit:syntax` — PASS
- `npm run audit:contract` — PASS
- `npm run test:p23:learning` — PASS

OPEN / НЕ PASS:

- полный `tests/organism-autonomy.mjs` на 80 ticks — timeout;
- B333 long-running gate — timeout в текущем локальном execution budget;
- `audit:forensics` — non-zero из-за ранее существовавших duplicate-content/name и long-line findings;
- `audit:hygiene` — errors=1, warnings=6; основной выявленный error — существующий trailing whitespace в `RELEASE_NOTES_B318_RU.md`.

Timeout никогда не переводился в PASS.

## Что B338 реально меняет в организме

До:

`world outcome -> policy/neural learning -> goal generator остаётся без outcome learning`

После:

`world outcome -> policy/neural learning + endogenous goal learning -> persistent goal memory -> будущая оценка похожих внутренних целей`

Это первый в этой ветке шаг, где improvement направлен непосредственно на длительную мотивационную жизнь организма, а не на дополнительную evidence-метрику.

## Что всё ещё НЕ доказано

B338 не доказывает:

- долгосрочную автономную личность;
- человеческую мотивацию;
- феноменальное сознание;
- causal ownership внешнего физического мира;
- Android/Termux device proof;
- независимую replication;
- то, что learned goal bias в длительном run существенно меняет top-level action distribution.

Следующий крупный этап должен теперь связывать этот learned endogenous goal state с persistent self-model/personality changes и измерять изменение будущего распределения решений на holdout, вместо добавления нового изолированного gate.
