# BIG PASS 344 — Personality Decision Carryover / Late-Arbitration Preservation
Дата: 2026-09-14

## Почему этот pass нужен

B343 доказал, что зрелая personality state усиливает влияние personality source внутри B297 Executive Neural Fusion. Перепроверка полного `OrganismCore` показала, что после B297 идут дополнительные arbitration stages: B291, constitutional arbitration, consciousness access bias, developmental diversity, P64 kernel finalization, quorum/repair и B312 policy handoff.

Следствие: личность могла быть причинно активна внутри B297, но её influence мог быть частично потерян до финального candidate field.

B344 закрывает именно этот seam, не создавая вторую personality subsystem.

## Реальное изменение организма

В `OrganismCore` добавлен bounded late-arbitration personality carryover.

Carryover активен только когда:
- нет пользовательского requested action;
- нет внешнего observation/world-event;
- B297 personality source имеет накопленную authority/reliability;
- B299 personality имеет достаточную consolidation/generalization maturity.

Magnitude вычисляется из learned B297 personality source authority + B299 personality maturity и применяется к уже накопленному `actionBias` конкретной личности.

Это не фиксированный bonus: сигнал зависит от состояния обученного организма и полностью исчезает при B299 personality lesion.

## Controlled full-Core evidence — PASS

Один и тот же зрелый persisted state был использован для двух реальных `OrganismCore` экземпляров:
- normal personality;
- personality lesion = 1.

Measured final candidate distribution:
- `verify` trained = `0.4034461289`;
- `verify` lesioned = `0.3173952286`;
- `verify delta` = `+0.0860508992`;
- full candidate-distribution L1 difference = `0.1688281244`;
- learned B299 verify bias = `0.0468583612`;
- personality lesion bias = `0`.

Это подтверждает уже не только B297-local signal, а downstream effect на candidate field самого `OrganismCore`.

Restart check:
- B299 verify bias restored exactly: `0.0468583612`.

## Regression evidence

PASS:
- typecheck;
- core ownership: `errors=0`;
- architecture: `1221 source files / 399 canonical / 0 cycles / legacyLeakage=0`;
- integrity: `2620 files / schema=127`;
- release contract;
- B338 unit + Core runtime;
- B339 unit + Core runtime;
- B340 unit + Core runtime;
- B341 standalone fast/slow personality unit;
- B343 personality executive plasticity;
- B344 personality decision carryover.

OPEN / not PASS:
- B341 full slow/fast Core reproduction can exceed the local execution budget;
- B342 live unseen-context Core holdout still fails because autonomous Core does not naturally produce enough endogenous `verify` observations (`0` obtained in the existing 120-observation harness);
- executable syntax audit was started after B344 changes but exceeded the current local execution budget, therefore not promoted to PASS in this report.

## Почему это качественный progress

B338: real-world outcome -> endogenous goal learning.

B339: learned self-model -> future decision bias.

B340: self-model / goal quality -> personality consolidation.

B341: fast personality -> slow personality.

B342: slow personality -> generalized trait in unseen context (controlled).

B343: personality maturity -> executive personality gravity.

B344: executive personality influence -> survives late arbitration -> changes final candidate distribution.

Таким образом причинная цепочка теперь длиннее:

`experience -> goal learning -> self-model -> personality consolidation -> trait generalization -> executive influence -> late-arbitration carryover -> final candidate distribution`

## Что ещё не доказано

B344 не доказывает:
- полностью endogenous unseen-context action shift в live Core;
- long-horizon 80–120+ tick individual development;
- Android/Termux device reality;
- consciousness or subjective experience;
- human-level personality.

## Следующий high-value organism target

Не добавлять ещё один personality layer.

Следующий pass должен провести единый developmental experiment:
1. baseline candidate distribution;
2. endogenous training through real feedback;
3. personality consolidation;
4. restart;
5. new context without forced action;
6. final candidate-distribution comparison;
7. personality ablation;
8. repeated holdout.

Ключевая метрика: не наличие нового state, а causal divergence of future behaviour attributable to the organism's own accumulated history.
