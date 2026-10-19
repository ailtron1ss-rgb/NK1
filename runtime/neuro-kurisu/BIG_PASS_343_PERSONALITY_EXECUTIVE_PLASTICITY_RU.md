# BIG PASS 343 — Personality Executive Plasticity / Canonical Decision Influence
Дата: 2026-09-14

## Цель
После B342 generalized personality trait уже существовал и переносился на новый контекст в контролируемом personality engine, но live Core не давал чистого witness: action arbitration перекрывал слабый personality signal.

Цель B343 — не создавать новую personality subsystem, а усилить причинную связь существующего B299/B342 personality substrate с canonical `B297ExecutiveNeuralFusion` в зависимости от накопленной доказательности.

## Что изменено
1. `B299CausalPersonalityDevelopmentLoop.diagnostics()` теперь публикует три aggregated metrics:
   - `generalizedTraitEvidence01`
   - `generalizedTraitActivity01`
   - `generalizedTraitConsolidation01`
2. `OrganismCore` передаёт эти metrics в canonical B297 executive fusion.
3. `B297ExecutiveNeuralFusion` теперь применяет evidence-dependent personality gravity только к источнику `personality`.
4. Для personality source добавлен candidate-level gain, зависящий от consolidation/generalization, а не фиксированный bonus.
5. При personality lesion источник полностью исчезает из executive candidate influence.

## Controlled evidence — PASS
Одинаковый candidate set и одинаковый personality signal:

- weak consolidation/generalization: fused personality signal = `0.462325`
- strong consolidation/generalization: fused personality signal = `0.5272576216`
- lesion personality: fused personality signal = `0`

Таким образом:

`более зрелая накопленная personality state -> больший executive influence -> personality ablation removes influence`.

## Regression evidence — PASS
- B338 unit + Core runtime — PASS.
- B339 unit + Core runtime — PASS.
- B340 unit + Core runtime — PASS.
- B297 executive fusion regression — PASS.
- B310 source-credit regression — PASS.
- B311 policy/consolidation regression — PASS.
- typecheck — PASS.
- core ownership — PASS.
- architecture — PASS: `1220 source files`, `399 canonical files`, `0 cycles`.
- integrity — PASS: `2618 files`, `schema=127`.
- executable syntax — PASS: `840 js`, `5 sh`, `203 json`.
- release contract — PASS.

## B341 status
Полный B341 slow/fast personality Core test в данной проверке превысил локальный execution budget. Это `OPEN/TIMEOUT`, не PASS.

## Что теперь реально улучшилось
До B343 personality source имел базовое executive влияние независимо от зрелости накопленного generalized trait.
После B343:

`experience -> generalized trait -> evidence/consolidation -> executive personality gravity -> candidate field`

То есть зрелость личности теперь участвует в выборе силы её собственного исполнительного влияния.

## Что ещё не доказано
- live unseen-context holdout через полностью endogenous action selection;
- длинный 80–120+ tick individual-development loop;
- restart + ablation + unseen holdout в одном полном эксперименте;
- Android/Termux execution reality;
- сознание, субъективный опыт или human-level personality.

## Следующий организм-level target
Не создавать B344 как ещё один isolated personality feature. Следующий pass должен использовать canonical DecisionActionPipeline/B297 candidate field для bounded baseline -> personality training -> restart -> unseen-context holdout -> personality ablation и измерять изменение именно полного candidate distribution и selected action.
