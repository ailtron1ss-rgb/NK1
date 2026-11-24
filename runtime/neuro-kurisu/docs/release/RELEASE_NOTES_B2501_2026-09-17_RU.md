# Neuro-Kurisu 35.6.41 — B2501 Deep Neural Causal Branch

## Цель прохода

Не расширять организм очередным независимым cognitive controller, а увеличить причинную роль neural substrate и связать его с развитием личности, predictive processing и реальным outcome-driven learning.

## Реально внедрено

1. `B2501DeepNeuralCausalBranch` — 48-unit recurrent neural branch.
2. Delayed recurrent synapses с четырьмя дискретными задержками.
3. Timing-dependent eligibility + neuromodulated three-factor plasticity.
4. Adaptive compute depth: mobile/balanced/quality.
5. Neural action readout + action gate.
6. Compositional primitive memory для reuse learned trajectories.
7. Outcome-driven world/body/self prediction heads.
8. Restart-safe persisted state.
9. Full runtime integration после B365 и до дальнейшей policy arbitration.
10. Outcome feedback integration в full runtime.
11. Explicit runtime disable/ablation path.
12. Causal lesion battery, restart determinism и mobile performance battery.
13. B365 causal test уточнён: теперь явно моделирует complete neural-policy-output lesion как evaluation-only perturbation; это не следует трактовать как доказательство феноменального сознания.

## Verification

- Typecheck: PASS.
- B2501 causal branch: PASS, 6 seeds.
- Minimum direct neural lesion effect: 0.02316.
- Runtime B2501 causal test: PASS; 8 cycles, 1727 learning updates, 142 delay updates.
- B2501 mobile microbenchmark: PASS; p50 ~0.65 ms, p95 ~6.24 ms, heap ~9.81 MiB in the test environment.
- B365 unified causal battery: PASS after explicit complete neural-policy-output lesion probe.
- B365 core neural causality: PASS.
- B365 homeostasis/structural test: PASS.
- B365 learning transfer: PASS.
- B368 full-runtime B365 causality: PASS.
- B2201-B2500 life-course regression: PASS.
- Core ownership: PASS.
- Architecture: PASS, 1381 source files / 420 canonical files / 0 cycles / 0 legacy leakage.
- Source hygiene: PASS.
- Forensics: PASS.
- Integrity: PASS.
- Release contract: PASS.
- Release source: PASS.

## Ограничения

B2501 является первым глубоким причинным проходом, а не финальным искусственным мозгом. Его текущая compositional replay memory ещё не подключена к отдельному sleep/offline scheduler в полном runtime на уровне, достаточном для заявления о полноценной консолидации. Физический Android benchmark остаётся отдельным этапом.
