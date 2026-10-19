# Neuro-Kurisu 35.11.0 / P2726 — Release Status

## Статус
**P2726 — большой интеграционный проход завершён по коду, тестам и research-record.**

## Доля работы прохода
- production code: **~84%**
- tests / ablations / endurance: **~10%**
- research / docs / release evidence: **~6%**

## Выполнено
1. Context-conditioned action models — DONE
2. Online latent transition model — DONE
3. Confidence-aware shallow planning — DONE
4. Adaptive replay mixture priority/context/novelty/random — DONE
5. Replay policy online adaptation — DONE
6. P2724 selective replay integration preserved — DONE
7. Persistence / restart for new state — DONE
8. State version 23 integration — DONE
9. P2726 240-outcome battery — PASS
10. P2724 1500-cycle mobile endurance — PASS (host only)
11. Release contract/source/architecture/integrity/forensics/syntax/hygiene/archive audits — PASS

## Current evidence
`P2726_CONTEXT_MODEL_REPLAY=PASS outcomes=240 contexts=3 ctxModelSamples=240 latentSamples=240 latentConf=0.5442 replay=96/240 replayUsed=494 mix=0.365,0.308,0.230,0.098 entropy=0.9350 planDepth=2 rollouts=14 trajectoryDiff=67.0240 restartOutcomes=240`

## Known negative / incomplete evidence
- P2708 factorial benchmark previously showed experimental forgetting can be worse than baseline; this remains an active counterexample.
- P2716/P2724 gains are benchmark-dependent and synthetic.
- World model remains shallow, not a general latent simulator.
- Physical Android/Termux endurance is not yet independently measured on the actual target device.
- Consciousness is not claimed; theory-linked ablations remain required.

## Next high-value pass
Independent replay factorial (`no/random/context/adaptive`), A→B→C→A + interleaved + sparse delayed reward + noisy verification + distribution shift, non-parametric context allocation, richer latent world model, and real Termux/Android device evidence.
