# Neuro-Kurisu 35.6.1 — Progress after BIG PASS 160

## Реально доказано

- TypeScript compiler check: PASS.
- BIG PASS 160 semantic runtime: PASS.
- 8 разнотипных cognitive observations processed.
- `observe → state change → flush → restart` preserved; restart tick matches and event history does not shrink.
- `OrganismCore` zero-argument sweep: 239 methods executed successfully; two rollback/restoration methods excluded from automatic execution.
- Public utility behavioural test: PASS.
- Smoke/concurrency/restart/memory: PASS.
- Agency + integration: PASS.
- True learning: PASS.
- Learned-world integration: PASS.
- Functional consciousness + integration + lesion: PASS.
- Causal self-model + integration: PASS.
- Personhood: PASS.

## Semantic coverage

Source inventory: **2346** function-like declarations.

- VERIFIED: **5**
- INTEGRATION_ONLY: **235**
- UNSAFE_TO_AUTO_RUN: **0** from this heuristic pass
- UNVERIFIED: **2106**
- Evidence-weighted proof rate: **3.72%**

`UNVERIFIED` is not equivalent to broken. It means the required behavioural evidence has not yet been established.

## Important limitation

A long regression batch reached P34 and then exceeded the overall tool time limit. Earlier tests in that batch passed, but tests after that boundary are not declared PASS from this run. The timeout is recorded rather than hidden.

## Next large passes

### BIG PASS 161 — Cognitive Event Fabric
1. Unified `CognitiveEvent` with causal parent/lineage.
2. Bind perception → prediction → appraisal → memory → goals → planning → action → outcome → learning.
3. Persist event lineage.
4. Add deterministic replay.
5. Add state-diff/postcondition verification.
6. Use it to promote functions from UNVERIFIED only when evidence is real.

### BIG PASS 162 — Unified Cognitive Cycle
Bounded observe/predict/appraise/attend/remember/goal/plan/act/learn/reconsolidate protocol with shared attention and resource economics.

### BIG PASS 163 — Memory Economy
Retention utility, reconsolidation, autobiographical compression with evidence lineage, and tests that memory changes future decisions.

### BIG PASS 164 — Affect / Feeling
Appraisal → emotion episode → interoceptive change → action tendency → memory modulation → recovery/reconstruction.

### BIG PASS 165 — Causal Self
Identity causality, autobiographical history, value plasticity, personality as longitudinal consequence.

### BIG PASS 166 — Learned World
Reality-vs-simulation evidence separation, competing models, prediction debt, causal intervention.

### BIG PASS 167–170
Long-horizon life projects → social mind → real sensorimotor loop → continual self-development.

### BIG PASS 171+
Theory-specific consciousness perturbation battery, 30–90 day longitudinal evaluation, Android-native supervisor, adversarial organism tests, research freeze.

## Progress rule

Rows of code, class count, snapshot count, and test count are not progress by themselves. Project progress advances only when behavioural evidence advances.
