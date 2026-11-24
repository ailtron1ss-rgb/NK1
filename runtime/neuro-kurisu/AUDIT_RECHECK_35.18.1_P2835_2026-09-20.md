# FINAL RECHECK — Neuro/Kurisu 35.18.1 / P2835 Hardening

Дата: 2026-09-20

## 1. Итог

Этот релиз основан на P2805 и включает P2820 Self-Knowledge/Coreset + P2835 Transfer-Safety Synergy, с исправлениями persistence, stale-teacher detection, experimental toggling и replay provenance.

## 2. Реальный код

Основные изменения:
- `P2820SelfKnowledgeCoresetBridge.ts`
- `P2835TransferSafetySynergyController.ts`
- `NeuralExperienceBranch.ts`
- `NeuralExperienceToken.contextId`
- replay path с teacher ranking + transfer compatibility gate
- slow self-teacher / self-distillation
- bounded coreset + compaction
- transfer safety / negative transfer / replay compatibility
- end-of-outcome persistence snapshots

## 3. Verification evidence

### Current-release gate
- TYPECHECK: PASS
- P2835 hotpath: PASS, 40 outcomes, 1333.3 ms
- P2835 current synergy: PASS, 4 runs, ABA + ABBA
  - ABA transfer=0.5718, negative=0.2566, safety=0.9406, teacher=60, coreset=60, massDiff=13.2678
  - ABBA transfer=0.5496, negative=0.3119, safety=0.9112, teacher=60, coreset=60, massDiff=12.9536
- P2835 interaction factorial: PASS, 16 runs, 2 regimes × 4 variants × 2 seeds
  - ABA reward: control/teacher/transfer/full = 0.8733 / 0.8733 / 0.8733 / 0.8733
  - ABBA reward: control/teacher/transfer/full = 0.8750 / 0.8750 / 0.8750 / 0.8750
  - full neural mass delta: 0.0072 / 0.0303
- P2835 persistence: PASS, tick=48, teacher=48, coreset=48, transferOutcomes=48, restart=1
- organism smoke: PASS
- server smoke: PASS

### Sensitive legacy regressions
- P2716 continual battery: PASS
  - expForgetA=0.0113 vs ctlForgetA=0.0914
  - expForgetB=0.0040 vs ctlForgetB=0.0018
- P2774 model-time replay: PASS
  - modelTime=277.709
  - quietInterval=4.739, stressInterval=3.790
  - compactions=356, semanticConsolidations=402, replaySamples=120, restart=420
- P2805 stability/plasticity: PASS
  - directEvents=6240, consolidated=933, sparse=6134, protected=106
  - resetPressure=0.3463, stressResetPressure=0.5309
  - branchEvents=156, restart=156
- P2708 continual factorial: PASS
  - expForgettingA=0.0115 vs ctlForgetA=0.0411
  - expGeneralization=1.0, ctlGeneralization=1.0

## 4. Static audits

- audit:full: PASS
- architecture: PASS, sourceFiles=1609, canonicalFiles=516, missing=0, cycles=0, legacyLeakage=0
- integrity: PASS, release=35.18.1, core=100.9.1-self-knowledge-transfer-safety-p2835-hardened, schema=209
- forensics: PASS, activeFiles=3548, empty=0, duplicateContent=0, duplicateNames=0, pathMarkers=0, staleMarkers=0
- source hygiene: PASS, errors=0, warnings=0
- syntax: PASS, js=1115, sh=6, json=240
- release contract: PASS
- release source: PASS
- archive manifest: regenerated and verified with no missing/hash mismatch/extra entries

## 5. Known performance limitation

Long combined benchmark chains can hit runtime/resource ceilings after several heavy neural/world-model suites. This is treated as an operational performance debt, not a passing result. The release gate therefore uses short deterministic current-release checks plus separate clean-process legacy evidence.

## 6. Code / work distribution

- production code: 85%
- tests / ablations / validation: 10%
- research / release engineering: 5%

## 7. Main conclusion

P2835 provides a real self-teacher + coreset + transfer-safety learning path that changes neural trajectories and persists across restart. The current factorial does not show a short-horizon reward gain, so no universal performance improvement is claimed. The next research target is long-horizon/held-out behavioural transfer under more realistic external environments.
