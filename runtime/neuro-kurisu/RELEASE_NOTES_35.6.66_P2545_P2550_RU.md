# RELEASE 35.6.66 — P2545–P2550 Adaptive Neural Continuity

Дата: 2026-09-18

## Главный результат
Реализована единая bounded neural continuity subsystem поверх `NeuralExperienceBranch`:
- learned memory operations;
- protected identity/utility anchors;
- anti-forgetting stability gate;
- H1/H2/H4 latent world prediction;
- epistemic disagreement signal;
- selective sleep consolidation;
- resource-aware replay/memory budgets;
- restart-safe persistence.

## Интеграция
Новая система не является отдельным policy owner. Она работает внутри canonical neural branch и отдаёт только bounded signals в decision/learning path.

Выбранное действие теперь явно возвращается в neural branch через `commitAction`, а replay frequency адаптируется по continuity compute budget.

## Verification
- `TYPECHECK=PASS`
- `B2545_B2550_ADAPTIVE_MEMORY_WORLD_PASS`
- `B2545_B2550_PERFORMANCE_PASS`
- `B2546_B2550_ANTI_FORGETTING_PASS`
- `B2550_NEURAL_BRANCH_RESTART_PASS`
- `B2522_RUNTIME_INTEGRATION_PASS`
- `B2521_RUNTIME_PASS`
- `B269` PASS
- `B365` causal PASS
- architecture PASS
- integrity PASS
- forensics PASS
- hygiene PASS
- syntax PASS
- release contract PASS
- release source PASS
- lockfile PASS
- 30-step organism smoke PASS
- 30-step smoke with `--max-old-space-size=256` PASS

## Known limitation
`tests/big-pass-320-mobile-durability.mjs` remains a pre-existing failure in the 35.6.63 base archive (`8 !== 14`). It is outside the P2545–P2550 neural changes and is retained as an explicit legacy/mobile persistence follow-up rather than being relabeled as PASS.

## Research memory
All fresh research used in this release is stored under `research/2026-09-18/`.
