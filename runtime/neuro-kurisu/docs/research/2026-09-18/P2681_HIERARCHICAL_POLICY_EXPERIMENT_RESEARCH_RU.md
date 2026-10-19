# P2681 — исследование и архитектурные решения

## 1. Свежие направления
### Active inference and artificial reasoning — Nature Communications, 8 Sep 2026
Работа формализует выбор действий через ожидаемую information gain + value и показывает, как information gain может выбирать действия, различающие конкурирующие world-model hypotheses. Это поддерживает связку hypothesis competition → experiment → outcome → model update.

### World Models for Embodied Intelligence: From Plausible to Controllable to Actionable — arXiv, 15 Sep 2026
Предлагается оценивать world models по тому, улучшают ли они planning, action, learning, verification, recovery и data selection. Для проекта это означает: каждый новый world-model слой должен иметь closed-loop contribution, а не только prediction score.

### MuSix — Multi-scale Mixture of World Models for Embodied Agents in Evolving Environments — arXiv, 1 Jul 2026
Использует scale-aware routing, experiential distance и разные forgetting/update rates на разных масштабах. P2681 реализует lightweight аналог fast/medium/slow knowledge, но пока без полноценной learned MoE и gated inter-scale transfer.

### Policy-information-gain — Nature Communications, 2026
Работа связывает policy-IG с изменением action choice и исследует его как общий сигнал для learning, information processing и exploration/exploitation. P2681 добавляет отдельный policy-relative information controller; следующий этап должен перейти от эвристического score к явному изменению policy entropy / KL между альтернативными policies.

## 2. Реализовано в P2681
1. B2528HierarchicalWorldModelFabric — fast/medium/slow уровни, drift, abstraction, agreement.
2. B2529PolicyInformationGainController — information gain относительно конкурирующих действий, uncertainty и value.
3. B2530AutonomousExperimentScheduler — выбор эксперимента с compute/thermal/battery gating.
4. Интеграция в NeuralExperienceBranch.
5. Policy/experiment signals увеличивают bounded learning salience для autobiographical memory.
6. Factorial ablation B2527 остаётся основным measurement harness.

## 3. Результаты
- B2528: 1400 updates; hierarchical agreement 0.875875.
- B2529: 1400 decisions; 1091 experimental proposals/executions in standalone benchmark; policy information gain 0.419544; calibration 0.835950.
- B2530: 1400 proposals; 626 executed; 452 useful in synthetic benchmark; compute efficiency 0.478208.
- Integrated: 80 cycles each; persistence PASS.

## 4. Ограничения
Это lightweight approximations. Нет утверждения о полном Bayesian inference, полноценном latent neural world model, сознании или переносе синтетических результатов на реальный мир.

## 5. Следующий измерительный блок
Полный factorial benchmark с baseline и комбинациями B2524/B2525/B2526/B2528/B2529/B2530; метрики: reward, prediction error, calibration, transfer, retention, holdout, latency, memory, CPU, thermal and energy. Отдельно нужен real Android closed loop.
