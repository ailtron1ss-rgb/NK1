# Neuro Kurisu — Progress P2545–P2550 / 35.6.66

## Цель прохода
Развивать именно автономный искусственный организм: непрерывный нейронный субстрат, память, мир-модель, саморазвитие, устойчивость, автономность и мобильная выполнимость. Новые подсистемы не получают отдельное право управления организмом и работают через bounded residual/контракт.

## Реально изменённый код
1. `src/organism/cognition/AdaptiveNeuralContinuityController.ts` — новый canonical controller.
2. `NeuralExperienceBranch.ts` — интеграция learned memory policy, multi-horizon world model, anti-forgetting gate, sleep consolidation и adaptive budgets.
3. `OrganismCore.ts` — фактически выбранное действие передаётся в neural branch; replay cadence адаптируется по continuity compute budget.
4. Release contract/version 35.6.66 / P2550.
5. Новые executable tests P2545/P2546/P2550.
6. Исследования сохранены отдельно в `research/2026-09-18/P2545_P2550/`.

## Что даёт контроллер
- ADD / UPDATE / RETRIEVE / DELETE / NOOP как обучаемые memory operations.
- 48 bounded memory records.
- utility/strength/confidence/protection/contradiction/provenance.
- multi-horizon latent prediction H1/H2/H4.
- horizon disagreement как epistemic signal.
- anti-forgetting anchor sentinel.
- stability gate для plasticity.
- selective sleep consolidation.
- replay/sleep/memory budgets из resource + epistemic signals.
- persistence/restart без потери learned memory-manager state.

## Доказательства
### Adaptive memory/world test
- 1400 cycles
- memoryCount: 22
- memoryHits: 1391
- все 5 memory operations наблюдались
- horizon errors: 0.11245 / 0.12104 / 0.12959
- antiForgetting: 0.761
- consolidation cycles: 26
- learned policy updates: 1400

### Anti-forgetting test
- Phase A protected anchors: 15
- retained after 1800 steps of different experience: 15/15
- memoryCount: 15
- antiForgetting: 0.539
- anchor drift: 0.295
- antiForgetEvents: 223

### Performance
- 4000 controller cycles
- ~25,014 cycles/s in Node runtime
- horizon errors converged to ~0.000407 in the stationary control benchmark

### Runtime
- B2522 runtime integration: PASS
- B2521 runtime: PASS
- B269 spiking/plasticity: PASS
- B365 causal: PASS
- neural branch restart persistence: PASS

### Mobile endurance
30-step full organism smoke on current release:
- PASS
- standard runtime: ~31.85–33.9 s, peak RSS ~636 MB on test host
- Node `--max-old-space-size=256`: PASS, ~33.9 s, peak RSS ~357 MB on test host
This is a host-side stress gate, not a guarantee for a specific Android handset.

## Engineering score
- Engineering maturity: 81/100
- Toward artificial organism objective: 70/100
- Neural branch: 88/100
- Neural continuity: 83/100
- Memory architecture: 81/100
- Temporal learning: 85/100
- World model: 78/100
- Anti-forgetting: 72/100
- Adaptive compute: 68/100
- Autonomy/goal coupling: 72/100
- Personality coupling: 66/100
- Persistence: 89/100
- External grounding: 47/100
- Android feasibility: 61/100
- Consciousness-related functional evidence: 34/100

## What is still weak
1. B2521 generative loop remains a bottleneck in coverage and accuracy; the latest clean runtime showed ~0.471 accuracy and ~0.00371 coverage, so it passes but does not yet represent a strong general world model.
2. Full runtime memory footprint is still high; mobile optimization remains a major branch of work.
3. External sensory/embodied grounding is much weaker than internal simulated experience.
4. Anti-forgetting protects anchors, but causal ownership and long-term transfer still need stronger independent benchmarks.
5. The learned memory policy is intentionally lightweight; it is not PPO/GRPO and should be treated as an experimental local controller.

## Work composition in this pass
Approximate effort allocation:
- 84% implementation/code + executable tests
- 10% verification/profiling/audit
- 6% research documentation and release bookkeeping

Compared with the 35.6.63 base archive, the changed/new executable surface is dominated by ~400+ new/modified code/test lines, plus release and research artifacts.

## Honesty rule
Nothing in this release is evidence that the organism has subjective consciousness. The mechanisms are computational substrates and testable hypotheses toward the project goal.
