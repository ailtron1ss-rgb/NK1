# Neuro-Kurisu 35.14.0 / P2750 — Unified Causal World Loop

## Суть релиза

P2750 переводит проект от последовательности отдельных predictive/continual механизмов к более замкнутому execution loop, где world model реально связан с causal credit, policy fallback, multi-rate memory, synthetic replay и mobile resource control.

## Production code

- `src/organism/cognition/P2750UnifiedCausalWorldLoop.ts` — новый bounded causal/world-model controller.
- `src/organism/cognition/NeuralExperienceBranch.ts` — каноническая интеграция в decision, `microTick`, afterOutcome, replay, learning-rate gate и persistence.
- `src/organism/cognition/index.ts` — экспорт P2750.

## Механизмы

1. 8 контекстов с nearest-centroid allocation и switch hysteresis/cooldown.
2. Fast/medium/slow memory bands с разными decay/update rates.
3. Action-conditioned online latent transition + reward model.
4. Model confidence/risk и planner depth 1–3.
5. Policy fallback pressure при низкой надёжности world model.
6. Directional causal matrix `pre latent × latent delta`.
7. Causal surprise / causal credit / information value.
8. Bounded synthetic model replay.
9. World-model-aware replay utility.
10. Learning-rate modulation от world confidence, memory consensus, surprise и mobile pressure.
11. Hot/cold replay compaction для mobile memory pressure.
12. Snapshot/restore + explicit ablation switch.

## Тесты

`P2750_UNIFIED_CAUSAL_WORLD_LOOP=PASS` — 510 outcomes, 4 contexts, 15 switches, world=0.2038, transitionErr=0.3667, causal=0.2810, memory=0.7094, synth=180, restart=510.

`P2750_INTERFERENCE_MATRIX=PASS` — 720 outcomes, 4 contexts, 10 switches, A_visits=180, memory=0.8207, world=0.5830, synth=710.

`P2750_PLANNER_FALLBACK=PASS` — coldInfo=0.5491, coldLR=0.9490, hotWorld=0.2353, hotAgree=1.0000, synth=168.

`P2750_MOBILE_COMPACTION=PASS` — compactions=19, compacted=4428, replayBuffer=396.

Separate regression processes:

- P2742 causal predictive intervention — PASS
- P2734 self-optimizing continual — PASS
- P2726 context-model replay — PASS
- P2720 adaptive lifelong — PASS

## Research integration

P2750 основан на light-weight адаптациях следующих направлений: online world-model planning; adaptive planner/policy switching under model uncertainty; uncertainty-penalized world-model experience transfer; nested/continuum memory; multiple short-term + long-term memory; eligibility traces; fast/meta continual learning.

## Ограничения

- Causal matrix является online directional association model, не полноценным causal graph discovery.
- Synthetic replay является model-generated hypothesis, а не ground-truth simulation.
- Интегрированный world confidence пока умеренный; нужна held-out intervention calibration battery.
- Общий organism smoke RSS остаётся слишком высоким для уверенного заявления «готово для medium Android».
