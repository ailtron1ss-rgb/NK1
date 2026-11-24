# Progress 35.6.70 — P2587–P2598

Дата: 18.09.2026

## Главный результат

Проект получил переносимый процедурный слой, который теперь находится внутри основного neural/embodied loop. Одновременно B2521 перестроен с exact-key зависимости на `exact → prototype → action prior`, а embodied world model получил селективную H1/H2/H4/H8/H16 лестницу.

## Оценки

Это инженерные оценки состояния проекта, а не научные измерения сознания.

- Engineering maturity: 89/100
- Progress toward artificial organism: 80/100
- Unified neural substrate: 92/100
- Temporal credit assignment: 87/100
- Learnable delays: 81/100
- Embodied world model: 88/100
- Actionable world arbitration: 83/100
- Causal memory: 84/100
- Continual dream rehearsal: 78/100
- Transferable procedural skills: 74/100
- Conflict-aware memory: 76/100
- Anti-forgetting: 78/100
- Long-horizon continuity: 80/100
- Autonomy/goal coupling: 78/100
- Personality coupling: 69/100
- External grounding: 53/100
- Android feasibility: 66/100
- Consciousness-related functional substrate evidence: 35/100

## Процент работы

- Реальный код и интеграция: **88%** усилий
- Тесты/профилирование/регрессии: **8%**
- Исследование/документация/release: **4%**

## Выполнение задач P2587–P2598

| Задача | Выполнение |
|---|---:|
| Transferable skill substrate | 100% |
| Successor-feature representation | 100% |
| Prototype transfer fallback | 100% |
| Intervention/recovery path | 100% |
| H1/H2/H4/H8/H16 ladder | 100% |
| Causal-effect focused world-model learning | 100% |
| B2521 exact-key bottleneck removal | 100% |
| NeuralExperienceBranch integration | 100% |
| Persistence validation | 100% |
| Research capture | 100% |
| Performance benchmark | 100% |
| Baseline skill consolidation | 100% implementation / 0% proven gain |
| Android real-device thermal benchmark | 0% |
| External multimodal grounding expansion | 20% |
| Task-id-free real-world generalization evidence | 20% |

**Сводная готовность блока: ≈92%.**

## Ключевые измерения

- B2521 runtime coverage: **0.4190**; прошлый зафиксированный runtime baseline: **≈0.0037**.
- B2521 horizon-test model coverage: **≈0.8560**.
- Prototype coverage в synthetic horizon test: **1.0**.
- Transfer holdout: **280/280** synthetic successes.
- H16 horizon: error≈**0.1424**, confidence≈**0.8087**; H1 confidence≈**0.9666**.
- Dream rehearsal retention: **0.6131** против plain **0.5000**, delta **+0.1131** в benchmark P2575–P2586.
- Mobile smoke: **PASS**, 30 autonomous steps, **26.65 s**, RSS≈**354.6 MB**, V8 heap cap 256 MB.

## Что действительно ещё мешает

1. Skill bank может фрагментироваться до 48 навыков в сильно меняющемся контексте; текущий integrated optionCoverage в этом benchmark≈0.047.
2. Intervention probes пока не являются доказанным внешним физическим вмешательством.
3. Дальние горизонты требуют uncertainty calibration и более сильного recovery.
4. Реальный Android thermal/RAM benchmark на физическом телефоне не выполнен.
5. Внешняя мультимодальная ground truth пока слабее внутреннего world-model substrate.

## Следующий блок P2599–P2612

`task-id-free cross-domain transfer → skill consolidation/abstraction → adversarial intervention benchmark → model-failure recovery → uncertainty calibration → option-level planning → asynchronous sensor adapters → Android thermal benchmark → stronger autonomy-goal-personality coupling → identity-linked continual traces`.
