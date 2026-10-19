# NEURO-KURISU 35.6.1 — B265 FULL BRAIN AUDIT

Дата: 12 сентября 2026

## 0. Статус аудита

Этот документ продолжает B264 audit. Перед разработкой B265 архив B264 был распакован в чистую рабочую директорию. Перепроверены B264 audit, B264 source, OrganismCore integration, StateMigrations, package scripts и B259–B264 regression artifacts.

Главная задача B265: устранить self-evaluation loophole B264. Policy не должна сама предоставлять доказательство собственного успеха.

## 1. Новая каноническая цепочка

`P27 latent -> B259 recurrent learning -> B260 causal memory -> B261 unified world model -> B262 multi-timescale dynamics -> B263 action consequence causality -> B264 causal policy -> B265 independent evaluator -> multi-step consequence -> independent score -> holdout/counterfactual evidence`

Это не новый изолированный cognitive organ. B265 является измерительным и экспериментальным слоем над уже существующей causal-policy loop.

## 2. Перепроверка B264

B264 audit correctly identified three remaining limitations:

1. policy evaluation lived mainly inside a controlled digital environment;
2. causal reliance in Core remained moderate;
3. evaluator was not independent enough to eliminate self-report bias.

B264 engineering state remained consistent with its audit after extraction from archive. No missing B264 source/migration field was found.

## 3. Что изменено в B265

### 3.1 IndependentPolicyEvaluator

Added `B265IndependentPolicyEvaluator` with:

- separate evaluator state;
- multi-step trajectories;
- independent environment transition/reward interface;
- baseline policy;
- random policy;
- holdout task evaluation;
- counterfactual first-action comparison;
- calibration measurement;
- snapshot/restore.

Crucially, evaluator reward is produced by `B265Environment.transition()` and is not accepted from `B264CausalPolicyLearning` as a truth source.

### 3.2 OrganismCore

B265 state and instance are owned by `OrganismCore`. Public methods expose diagnostics and evaluation without replacing the governed B264 action path.

### 3.3 Persistence

B265 state is included in the persisted system shape and `StateMigrations`. Migration round-trip was tested on schema 127.

## 4. Standalone evidence

6 train trajectories + 5 independent holdout trajectories were evaluated.

- 88 total trajectory steps;
- holdout policy return: 0.64853;
- holdout baseline return: 0.33306;
- holdout advantage: +0.31547;
- random return: 0.28781;
- counterfactual gain: +0.06020;
- evaluator calibration: 0.99242;
- snapshot restore: PASS.

These results show that the evaluator can distinguish policy from baseline in the controlled benchmark. They do not prove generalisation outside this environment.

## 5. Core evidence

The Core test used the actual B264 causal policy as the action-selection function.

- 7 evaluator trajectories;
- 56 multi-step steps;
- 3 holdout tasks;
- holdout policy return: 0.34642;
- holdout baseline return: 0.29516;
- advantage: +0.05126;
- random return: 0.25703;
- counterfactual verify-vs-rest gain: +0.05197;
- persisted B265 steps: 56.

This is materially stricter than the standalone benchmark because the policy is now the real B264 policy from `OrganismCore`.

## 6. Migration evidence

Schema: 127.

Verified restoration of:

- evaluations;
- steps;
- last task id.

Migration test: PASS.

## 7. Regression

B264 causal policy standalone: PASS.
B264 Core integration: PASS.
B265 standalone: PASS.
B265 Core evaluator: PASS.
B265 migration: PASS.

## 8. Release gates

- Typecheck: PASS.
- Architecture: PASS — 961 source files, 348 canonical files, 0 cycles, 0 missing, 0 legacy leakage.
- Integrity: PASS — 1928 files.
- Source hygiene: PASS — 1922 files, 0 errors, 0 warnings.
- Forensics: PASS — 1907 active files, 0 empty, 0 duplicate content, 0 duplicate names, 0 path markers.
- Release contract: PASS.
- Lockfile: PASS.
- Release source: PASS.
- Doctor: PASS.
- Executable syntax full-tree audit: BLOCKED_BY_ENV_TIMEOUT after 90s. No PASS is claimed.
- Full historical audit: NOT_CLAIMED_PASS.

## 9. Что B265 реально доказал

1. Независимый evaluator может измерять многозначный policy return по отдельной environment transition function.
2. B264 policy превосходит baseline на текущих controlled holdout задачах.
3. Counterfactual first-action difference наблюдается.
4. Evaluator не обязан доверять policy-reported reward.
5. B265 persistence/migration интегрирована.

## 10. Что B265 НЕ доказал

- реальный физический внешний causality;
- general agency;
- consciousness;
- долговременную superiority на открытом мире;
- независимость от дизайна evaluator environment;
- реальную телефонную sensorimotor autonomy.

## 11. Строгая оценка 1–100

| Элемент | B265 |
|---|---:|
| Canonical neural substrate | 69 |
| Recurrent causal memory | 68 |
| Unified world model | 71 |
| Multi-timescale dynamics | 70 |
| Action consequence causality | 66 |
| Causal policy learning | 69 |
| Independent evaluation | 72 |
| Multi-step behavioural evidence | 64 |
| Holdout transfer | 65 |
| Counterfactual evaluation | 63 |
| Real external causality | 24 |
| Persistence | 97 |
| Migration discipline | 96 |
| Architecture coherence | 88 |
| New-branch test coverage | 79 |
| Full-tree verification | 49 |
| Scientific maturity | 63 |
| Brain branch engineering | 84 |
| Unified causal loop | 83 |

These are engineering maturity scores, not scientific measurements.

## 12. Progression by chain

Observation 100%
-> P27 latent 100%
-> B259 recurrent learning 82%
-> B260 delayed memory 76%
-> B261 world model 77%
-> B262 multi-timescale dynamics 73%
-> B263 action causality 68%
-> B264 causal policy 69%
-> B265 independent evaluation 72%
-> long-horizon behavioural superiority 28%
-> real external action 25%

## 13. Main remaining bottlenecks

1. The environment is still controlled and partially designer-specified.
2. B265 has short-to-medium horizons, not truly long life-course horizons.
3. Core advantage is positive but modest (+0.0513 in this test).
4. Evaluator agreement in Core is only ~0.486; this means evaluator confidence is not yet as strong as the standalone benchmark.
5. No external physical consequence stream is yet connected to this evaluator.

## 14. Next large step — B266

B266 should move from fixed evaluator tasks to a task-family generator and independent intervention harness.

Required properties:

- hidden environment regimes;
- task family variation;
- delayed rewards;
- intervention baselines;
- evaluator seed separation;
- policy/evaluator parameter isolation;
- long-horizon episodes;
- survival and recovery objectives;
- failure-case analysis;
- explicit anti-overfitting tests.

Acceptance criterion:

`causal policy > baseline` must remain true over unseen task families and hidden environment modes, with the evaluator generated independently from the policy learner.

## 15. Final verdict

B265 = VERIFIED ENGINEERING PASS.

B265 is a major increase in evidentiary quality because it creates an independent evaluation layer.

B265 is NOT proof of general agency, consciousness, real-world autonomy, or external physical causality.
