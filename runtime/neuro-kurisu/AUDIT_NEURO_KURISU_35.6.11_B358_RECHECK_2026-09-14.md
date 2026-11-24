# Neuro-Kurisu — Strict Recheck Audit 35.6.11 / B358

## 1. Scope
Recheck from 35.6.10/B357. The mandatory next gate was learned compositional program revision with causal ablation and restart continuity.

## 2. Functional change
B276 step consequence credits now drive a persistent sequence revision at a safe execution boundary. The revision changes the executable order, increments `structureRevisionCount`, and persists through restart. Mid-action mutation is intentionally blocked.

## 3. Evidence
B358: 5/5 independent seeds PASS. Every trained program changed order; every revised order survived restart; every matched program-ablation snapshot restored the original order and removed the learned next-step preference.

## 4. Regression
B357 program consequence learning: PASS.
B355 compositional execution: not re-run in this pass.
B356 trajectory regression: TIMEOUT/OPEN in the available runtime window; not counted as PASS.
B353 causal SNN: stored prior evidence remains unchanged; B358 does not modify B269.

## 5. Type system / build
`node scripts/typecheck-runtime.mjs` did not complete within the runtime window; direct local `node_modules/.bin/tsc` is unavailable. Targeted TypeScript-strip runtime tests executed successfully. This is recorded as OPEN, not PASS.

## 6. Strict scores
Brick 0: 100/100
Brick 1: 100/100
Brick 2: 75/100 host-mobile profile; physical device gate OPEN
Brick 3: 100/100 host causal replication evidence
Brick 4 execution: 100/100
Brick 4 consequence learning/transfer: 100/100
Brick 4 structural revision/ablation: 100/100
Brick 4 long-horizon runtime: 55/100 OPEN
Brick 5: 0/100 — correctly held closed

Overall brain/identity branch: ~63%.
Full physical autonomous-organism path: ~42%, with Android/Termux still unverified.

## 7. Next mandatory work
Do not promote to Brick 5. First close the B356 timeout by profiling why structural revision increases long-horizon runtime, then run multi-episode revision with causal ablation and unseen contexts. Only a clean long-horizon gate may unlock predictive planning.
