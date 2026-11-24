# BIG PASS 339 — Self-Model Goal Coupling / Real Decision Influence

Дата: 2026-09-14
Версия: Neuro-Kurisu 35.6.1

## Почему этот шаг

Перепроверка B338 показала следующий реальный bottleneck: SelfModelV2 уже сохранял predicted action, agency belief, identity coherence и prediction errors, но в основном использовался как наблюдатель. Его learned state почти не входил в action ranking. Поэтому self-model существовал, но не был полноценно причинным участником организма.

## Реальное функциональное изменение

`SelfModelEngine` получил два связанных механизма:

1. `learnGoalOutcome(...)` — результат внутренней цели обновляет goal alignment, agency belief, identity coherence и per-action self-consistency trace.
2. `actionBias(action)` — accumulated self-consistency и self-model state создают bounded decision influence.

`OrganismCore` теперь добавляет этот self-model decision bias в основной `rawUtility` перед `DecisionActionPipeline`.

Новый контур:

`goal -> action -> outcome -> self-model update -> persistent self-consistency -> next action ranking`

Это уже не только диагностика: learned self-model state способен менять будущую оценку действий.

## Persistence

Новые поля находятся внутри существующего `SelfModelV2`, поэтому проходят через существующий persistence projection: `goalAlignment01`, `goalAlignmentEMA01`, `selfConsistentAction11`. Старые snapshots получают backward-compatible defaults через `restore`.

## Evidence

### Unit

`node --experimental-strip-types tests/big-pass-339-self-model-goal-coupling.mjs`

PASS:
- self-consistent action bias вырос с `0.0302` до `0.0541`;
- `goalAlignmentEMA01 = 0.706`;
- snapshot/restore сохраняет влияние.

### Real runtime

`node --experimental-strip-types tests/big-pass-339-self-model-goal-coupling-core.mjs`

PASS:
- 8 runtime ticks;
- goal alignment изменяется от baseline;
- runtime self-model сохраняет strategy traces;
- self-model decision bias становится ненулевым и доступен основному ranking.

### Regression

PASS:
- B338 unit;
- B338 real-runtime core;
- B339 unit;
- B339 real-runtime core;
- typecheck;
- core ownership;
- architecture;
- integrity.

Syntax/contract полного инфраструктурного пакета в этой сессии не завершили полный прогон из-за execution timeout. Это НЕ считается PASS.

## Что это меняет в организме

До B339 self-model главным образом отвечал на вопрос «что я сделал и насколько хорошо себя предсказываю?».

После B339 появляется causal loop:

`результат цели -> изменение модели себя -> изменение оценки следующего действия`.

Это делает self-model частью регуляции, а не только журнала состояния.

## Что всё ещё не доказано

Не доказаны:

- long-horizon self-consistent behavioural transfer;
- независимый holdout causal effect на unseen contexts;
- сильное изменение top-level action distribution от self-model learning на длинном горизонте;
- Android/Termux device proof;
- феноменальное сознание.

Следующий крупный этап: провести controlled baseline -> self-model learning -> holdout, где ablation self-model сравнивается с full organism и проверяется изменение будущего action distribution.
