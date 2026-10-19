# RELEASE NOTES — B264

## B264 Causal Policy Learning

Большой апдейт brain branch.

### Architectural change

B264 впервые связывает B263 intervention model напрямую с action selection. Причинная модель больше не существует только как диагностический слой: она влияет на ранжирование действий, после чего фактический outcome обучает policy.

### New files

- `src/organism/cognition/B264CausalPolicyLearning.ts`
- `tests/big-pass-264-causal-policy-learning.mjs`
- `tests/big-pass-264-core-integration.mjs`
- `B264_RELEASE_EVIDENCE.json`
- `B264_PROGRESS_2026-09-12_RU.md`
- `AUDIT_NEURO_KURISU_35.6.1_BRAIN_UPDATED_B264_2026-09-12.md`

### Regression status

B259/B260/B261/B262/B263 regression chain verified; B264 standalone and Core integration verified.

### Important scientific status

B264 is not a claim of general autonomous agency or real-world causal competence. The strongest current benchmark is still a controlled digital environment. External/physical-world action consequence validation remains future work.
