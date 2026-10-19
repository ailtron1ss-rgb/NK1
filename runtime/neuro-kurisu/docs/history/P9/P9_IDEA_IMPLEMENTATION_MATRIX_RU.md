# P9 Idea Implementation Matrix

Источник: `docs/source/Neuro_Kurisu_Evolution_Mega_Architecture_Report_2026-08-26.docx`.

## S — обязательно сейчас

- ✅ Cognitive Field — единое внутреннее поле уже существовало и расширено P9 pressure aggregation.
- ✅ MemoryOS 2.0 — реализован `MemoryOS2`: provenance, epistemic status, hybrid retrieval, reconsolidation, forgetting/dormant state, multi-kind memory.
- ✅ Learned World Model — реализован `WorldModel2` как phone-safe hybrid/statistical learner: transition statistics, uncertainty, reward model, causal hypotheses, short rollouts. Это ещё не полноценная latent neural dynamics model.
- ✅ Self-Prediction — существующий SelfModelV2 продолжен и связан с outcome/replay.
- ✅ Contradiction Reservoir — существует и связан с Cognitive Field.
- ✅ Cognitive Immune — существует provenance/quarantine/source monitoring.
- ✅ Procedural Memory — `ProceduralSkillLibrary` с promotion/demotion.
- ✅ Future Simulator — отдельный `FutureSimulator`, использующий WorldModel2 rollouts.
- ✅ Regret Engine — сравнение выбранного действия с counterfactual alternatives.
- ✅ Scientific Method Engine — question/hypothesis/prediction/evidence/revision.
- ✅ Identity Trajectory — существующий developmental identity layer.

## A — очень желательно

- ✅ Attention Debt — pressure decay/re-activation в CognitiveField.
- ✅ Semantic Scars — persistent error-linked policy/attention traces.
- ✅ Value Provenance — supporting/violating evidence и confidence.
- ✅ Commitment Repair — acknowledge/diagnose/revise/compensate/rebuild.
- ✅ Social Prediction — существующий SocialWorldModel + P9 relationship layer.
- ✅ Model Switch Continuity — backend switch persisted и regression-tested.
- ✅ Cognitive Budget — ресурсно-зависимый depth selection.
- ✅ Micro-dreams — короткие offline simulations по cadence.

## B — после ядра, но теперь реализована облегчённая phone-safe версия

- ✅ Developmental Forks — persistent counterfactual trajectories.
- ✅ Relationship-specific Self — доверие/теплота/защищённость/предсказуемость/совместные обязательства.
- ✅ Dormant Memories — dormant state и selective reactivation policy внутри MemoryOS2.
- ✅ Multi-hypothesis Personality — несколько контекстных гипотез вместо немедленного single interpretation.
- ✅ Long-term Social Mind — объединяет relationship/prediction/shared projects/commitments.

## C — сознательно не внедрялось

- полноценная биологическая симуляция мозга;
- огромный LLM;
- постоянный on-device LLM polling;
- cycle-by-cycle fine-tuning/LoRA;
- IIT/Φ как consciousness meter;
- тяжёлая robotics;
- 3D body ради визуального эффекта.

## Важное различие

Везде, где в документе говорится `learned`, текущий P9 использует максимально phone-safe переходный вариант: statistical/hybrid learning и causal scaffolding. Это сделано специально, чтобы следующий этап мог заменить эти механизмы настоящей probabilistic latent model без разрушения остального организма.
