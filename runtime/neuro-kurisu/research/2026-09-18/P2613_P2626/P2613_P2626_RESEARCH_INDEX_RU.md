# Research Index — P2613–P2626

Дата: 2026-09-18

## Исследования, использованные при проектировании

1. **Hierarchical Planning with Latent World Models** — Zhang et al., 2026, arXiv:2604.03208.
   - Идея: планирование на нескольких временных масштабах уменьшает стоимость длинного поиска и ограничивает накопление ошибок.
   - В проекте: H1/H2/H4/H8/H16 + hierarchical procedural skills + compute gate.

2. **Test-Time Mixture of World Models for Embodied Agents in Dynamic Environments** — Jang et al., 2026, arXiv:2601.22647.
   - Идея: test-time routing между world-model experts и prototype-based adaptation для незнакомых доменов.
   - В проекте: task-free prototype utility gate и bounded online world-model adaptation; полноценный multi-expert world-model fusion пока оставлен будущим направлением.

3. **Rethinking World Models for Safety-Critical Embodied Systems** — Ma et al., 2026, arXiv:2609.03774.
   - Идея: decision-centric world model должен учитывать consequence, intervention, epistemic uncertainty и recoverability.
   - В проекте: RiskAwareRecoveryController + abstain/defer + recovery quality + uncertainty/drift inputs.

4. **World Models for Embodied Intelligence: From Plausible to Controllable to Actionable** — Yao et al., 2026, arXiv:2609.16697.
   - Идея: полезность world model определяется тем, улучшает ли он planning/action/learning/verification/recovery/data selection.
   - В проекте: проверка downstream action, consequence и recovery, а не только prediction.

5. **Break It Down, Pass It On: Cross-Task Skill Transfer in LLM Agents** — Feng et al., 2026, arXiv:2608.20274.
   - Идея: subtask-level transfer надёжнее whole-task retrieval; полезность навыка требует баланса specificity и abstractness.
   - В проекте: TaskAgnosticTransferRouter использует specificity/abstractness-like utility, plus negative-transfer abstention.

6. **IDER: IDempotent Experience Replay for Reliable Continual Learning** — Liu et al., 2026, arXiv:2603.00624.
   - Идея: надёжность continual replay важна вместе с uncertainty calibration.
   - В проекте: существующий dream/replay contour дополнен calibration/risk telemetry; idempotent replay пока не внедрён как отдельный алгоритм.

7. **AdaJEPA: An Adaptive Latent World Model** — Wang et al., 2026, arXiv:2606.32026.
   - Идея: closed-loop test-time adaptation world model по наблюдаемому переходу.
   - В проекте: bounded residual adaptation без полного gradient training.

8. **EnerInfer: Energy-Aware On-Device LLM Inference** — Zou et al., 2026, arXiv:2606.23001.
   - Идея: energy/thermal state должен менять runtime configuration; ограничение частот может улучшать energy efficiency.
   - В проекте: DeviceAwareNeuralScheduler как lightweight policy; аппаратные frequency controls не используются.

9. **Phoenix: Thermal-Aware On-Device Inference of Multi-Instance DNNs for Mobile Video Applications** — 2026, ACM TECS.
   - Идея: thermal-aware runtime scheduler и adaptive early-exit/degradation.
   - В проекте: skipDeep/degradedMode/thermal safety.

## Отложенные эксперименты

- полноценный test-time mixture из нескольких world-model experts;
- real Android thermal feedback loop;
- idempotent replay;
- task-ID-free evaluation на внешних benchmark distributions;
- intervention fault injection через реальные sensor adapters;
- value/identity-conditioned hierarchical skill consolidation на реальных episodic traces.
