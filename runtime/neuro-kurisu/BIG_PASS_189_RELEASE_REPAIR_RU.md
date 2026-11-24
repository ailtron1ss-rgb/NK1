# Neuro-Kurisu BIG PASS 189 — Release Repair & Reality Gate

## Что реально изменено

1. Удалён найденный дубликат `BRAIN_BRANCH_ANALYSIS_BASELINE_COPY_RU.md`.
2. Исправлен реальный регресс P16 в `WorldModel2`: обратная связь, пришедшая без предварительного `predict()`, теперь формирует grounded calibration sample вместо оставления calibration table пустой.
3. Добавлены воспроизводимые npm-профили `test:brain:core` и `test:reality:brain-release`.
4. Добавлен Termux-compatible runner `scripts/run-brain-reality-release.sh`.
5. Зафиксирован текущий evidence status отдельно от архитектурного процента.

## Что проверено в этом release pass

### Build / brain core

- TypeScript typecheck: PASS
- B182 brain substrate: PASS
- B182 deterministic causal graph: PASS
- B183 central brain: PASS
- B185 hippocampal central brain: PASS
- B186 predictive self / agency: PASS
- B187 recurrent global workspace: PASS
- B188 metacognitive neural substrate: PASS

### Legacy functional gates

- P16 memory/world/learning: PASS (после исправления)
- P17 embodied multimodal: PASS
- P19 adaptive development: PASS
- P20 temporal continuity: PASS
- P21 resilience: PASS
- P22 phone reliability: PASS
- P31 functional consciousness: PASS
- P31 lesion: PASS
- P31 truthfulness: PASS
- P32 causal self: PASS
- P32 lesion: PASS
- P32 truthfulness: PASS
- P33 personhood: PASS
- P41 truthfulness: PASS

### Long horizon

- operational 500 cycles: PASS
  - ratio 1.115
  - first 60.93 ms
  - last 67.96 ms
  - p95 82.11 ms
  - heap first 53.48
  - heap last 144.59

- `long-horizon-memory.mjs`: NOT CERTIFIED IN THIS FINAL RUN because the combined invocation exceeded the execution window before completion.

- `big-pass-181-function-reality-closure.mjs`: NOT CERTIFIED IN THIS FINAL RUN because it followed the timed-out command. Earlier archive evidence exists, but this report deliberately does not re-count it as a fresh pass.

## Interpretation

The 188 archive was not fully correct: P16 exposed a real regression. That regression is fixed and independently reproduced as PASS.

The new brain mechanisms B182–B188 still pass after the fix.

The project must not claim full function verification or full long-horizon memory certification from this release. The evidence matrix therefore remains conservative.

## Current status semantics

- Implemented: code exists.
- Integrated: reachable in runtime path.
- Executed: direct execution observed.
- Verified: dedicated behavior test passed.
- Long-horizon verified: dedicated extended test completed.
- Real-device verified: physical Android evidence completed.
- Research-grade: causal ablations + controls + reproducibility.

No consciousness claim is inferred from any numeric metric.

## Next major passes

B189/190 cleanup is followed by:

B190 Predictive interoception / allostasis
B191 Neuromodulatory plasticity
B192 Active perception
B193 Autonomous scientific brain
B194 Social brain integration
B195 Developmental brain
B196 1k → 10k → 50k → continuous-life certification
B197 full Android physical brain gate
B198 brain-wide causal science battery

The main unresolved engineering bottleneck is no longer lack of modules; it is evidence coverage and long-horizon causal integration.
