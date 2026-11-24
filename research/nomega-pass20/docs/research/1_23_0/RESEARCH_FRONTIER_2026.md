# NΩ 1.23.0-dev — Research Frontier / Integration Log

## 1. B-Coder — value-based program synthesis
Source: https://arxiv.org/abs/2310.03173

Relevant idea: program synthesis has cheap automatic rewards from execution tests and abundant off-policy historical programs, making value-based learning a natural complement to policy generation. NΩ now has an initial partial-program value learner and persistent execution-derived replay, but its default runtime path remains conservative.

Integration decision: **experimental / opt-in** until vectorized inference demonstrates net runtime savings.

## 2. VerMCTS — verifier-guided tree search
Source: https://arxiv.org/abs/2402.08147

Relevant idea: use intermediate verification feedback inside tree search rather than checking only completed programs. NΩ's counterexample search already incorporates contract checking, semantic pruning, execution feedback, and HVM cross-verification.

Integration decision: **active**.

## 3. ReVeal — self-evolving code agents
Source: https://arxiv.org/abs/2506.11442

Relevant idea: iterative generation and verification, tool feedback, memory of failures, and dense per-turn rewards can improve code-agent behavior. NΩ now retains execution-grounded preference/replay infrastructure and adds reusable forged environments.

Integration decision: **active research direction**.

## 4. Project Aletheia — verifier-guided backtracking distillation
Source: https://arxiv.org/abs/2601.14290

Relevant idea: train small models on verified traces that explicitly contain conflicts, self-correction, and backtracking instead of only correct terminal answers.

Integration decision: next training pass should add branch/repair traces to the curriculum and value dataset.

## 5. EvoEnv — self-evolving verifiable environments
Source: https://arxiv.org/abs/2605.14392

Relevant idea: self-improvement can come from constructing reusable, validated training environments whose solve/verify asymmetry remains informative as models improve. The paper reports gains from generated environments after validation and difficulty calibration.

Integration decision: **new active direction**. NΩ now has `VerifiableEnvironmentForgeV1` as the first executable implementation of this idea.

## 6. Test generation as a first-class verifier problem
Source: https://arxiv.org/abs/2507.06920

Relevant idea: static, homogeneous tests can overestimate correctness; adaptive test generation should be measured for coverage and verifier quality. NΩ's environment forge is designed to generate separating cases rather than merely random extra cases.

Integration decision: add coverage, novelty, mutation-kill, and OOD metrics before promotion.

## Current experimental conclusion
The strongest architecture emerging from these directions is:

`proposal -> partial value -> verifier-guided search -> execution trace -> counterexample -> repair -> verified environment -> replay -> training -> immutable holdout -> promotion/rollback`

The main measured limitation is that a small value model currently saves verifier candidates but does not yet reduce total wall time on small search spaces. A separate environment-coverage finding is that some families provide no sufficiently hard separating rows; the forge now rejects such rows instead of padding them into the benchmark. The next optimization therefore targets batching, cost-aware activation, and blind-spot-driven environment generation rather than simply increasing model size.
