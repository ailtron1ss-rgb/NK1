# BIG PASS P2613–P2626 — Task-Free Generalization + Risk/Recovery + Goal/Identity Modulation + Device-Aware Neural Scheduling

## Цель блока

Перевести Neuro Kurisu от «банка переносимых процедур + иерархического planner» к связанному контуру, который умеет:

`контекст без task-ID → оценка полезности навыка → выбор/отказ от переноса → world-model risk → action/recovery → цель/идентичность → device-aware compute → наблюдение последствия → recalibration → persistence`.

Главный критерий блока — реальная закрытая петля поведения, а не увеличение количества модулей.

## Реализовано

1. `TaskAgnosticTransferRouter.ts`
   - task-ID отсутствует как входной управляющий сигнал;
   - skill utility учитывает specificity + abstractness + confidence + success + stability + contradiction;
   - negative-transfer penalty;
   - explicit abstain при недостаточной уверенности;
   - runtime coverage/calibration/transfer telemetry.

2. `RiskAwareRecoveryController.ts`
   - агрегирует prediction error, uncertainty, model drift и recoverability;
   - risk-aware bias для действий;
   - recovery routing через verify/explore/reflect/defer;
   - abstain/defer при опасно низкой recoverability;
   - post-outcome calibration.

3. `GoalIdentitySkillModulator.ts`
   - функциональная goal/identity-conditioned modulation;
   - медленно меняемый trait vector;
   - novelty/uncertainty/identity-gap sensitive routing;
   - coherence/stability/drift telemetry;
   - это поведенческий personality substrate, а не заявление о субъективной личности.

4. `DeviceAwareNeuralScheduler.ts`
   - thermal/battery/CPU/RAM/sensor-freshness aware compute budget;
   - deep-rollout gate;
   - degraded mode;
   - lightweight O(1)-style runtime controller;
   - phone-first design без требования реальных Android power sensors.

5. Интеграция в `NeuralExperienceBranch`
   - state schema 177 → 181;
   - новый контур встроен непосредственно в beforeDecision/afterOutcome;
   - новые состояния сохраняются/восстанавливаются;
   - action bias комбинируется с causal planner, embodied world model, transferable skills, hierarchical skills, task-free utility, risk, identity/goal modulation и device scheduling.

## Что принципиально изменилось

Ранее transfer мог быть формально успешным даже при очень узком состоянии retrieval. Теперь перенос должен пройти отдельную utility/risk проверку и может быть отклонён.

Ранее compute budget был в основном cognitive-level. Теперь он ограничивается также предполагаемым device pressure.

Ранее identity/goal signals влияли на общую decision pressure. Теперь они напрямую модулируют использование навыков и action preferences.

## Ограничения

- task-free benchmark остаётся synthetic/engineering benchmark;
- personality modulation не является доказательством сознания или субъективного опыта;
- thermal scheduler не является Android hardware governor и пока не использует реальную температуру SoC;
- risk controller не заменяет внешний safety layer;
- внешняя multimodal grounding остаётся слабее внутреннего synthetic/latent substrate.
