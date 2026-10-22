# WorkPass122 — promotion gate hardening and research comparison

Date: 2026-10-21  
Branch: `workpass122-promotion-gate-coverage-hardening`  
Parent: WorkPass121 ledger-bound skill promotion proposals

## Code changes

- Normalized numeric thresholds in `SkillRevisionGate` and `VerifiedSkillPromotion` through finite, bounded integer parsing. A `NaN` value could previously propagate into `minPairedTasks`; comparisons against `NaN` are false, so the intended minimum-evidence check could be bypassed. Non-finite integer options now fall back to explicit conservative defaults.
- Corrected the proposal regression's count contract: `gate.pairedN` counts paired task-seed cells, not unique tasks. The fixture contains 10 tasks × 5 seeds, therefore `pairedN = 50`; `uniquePairedTasks = 10`; and seed-clustered `pairedN = 5`.
- Added regression assertions for stable proposal identity over an unchanged manifest/outcome ledger and for rejecting a two-pair sample when `minPairedTasks` is `NaN`.
- Kept proposal-only semantics: no live skill is activated and no automatic promotion path was introduced.
- Added this checkpoint and registered the WorkPass122 branch in the continual-learning workflow's push filter.

## Research and upstream comparisons

- [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench), paper [arXiv:2604.20087](https://arxiv.org/abs/2604.20087): evaluate skill quality, trajectory behavior, and deterministic task outcomes separately. Its reported result that self-feedback can drift while external feedback supports iterative improvement argues for verified outcomes rather than treating reflection text as truth.
- [ContinualSkillBench](https://arxiv.org/abs/2608.03874): sequential task streams reveal that gains vary by domain and that explicit skill consolidation is not uniformly better than using prior context and feedback. NK1 should measure transfer and consolidation against a no-new-skill/context-only control.
- [MemSkill](https://github.com/ViktorAxelsen/MemSkill): its learned memory-operation skills are meta-skills for what to extract, preserve, retrieve, and forget, distinct from the memory facts themselves. Adapt the distinction as a separate future track; do not port its Python/PPO/controller stack blindly into NK1's TypeScript runtime.
- [Memento-Skills](https://github.com/Memento-Teams/Memento-Skills): read/execute/reflect/write lifecycle, isolated skill repair, validation gates and rollback are relevant design references. Production write-back and rollback remain future work in NK1.
- [Voyager](https://github.com/MineDojo/Voyager): reusable executable skills, automatic curriculum and self-verification are useful patterns, but its Minecraft executor/environment are not portable without a task-adapter layer.

These are design-level comparisons, not claims that upstream code was copied or fully audited. No external source files were vendored in this pass; license and provenance review remains mandatory before direct code reuse.

## Validation status

- Regression code is wired into `test:p23:verified-skill-promotion-proposal` and the WorkPass110 continual-learning workflow.
- The connector does not provide a local execution environment for the repository; a successful exact-head GitHub Actions run has not yet been observed. Treat the tests as added, not passed, until Actions executes the new head.
- This change hardens evaluation gates; it does not demonstrate a learning-quality uplift.

## Remaining engineering work

1. Add authenticated evidence-artifact resolution instead of trusting an opaque `evidenceRef` string.
2. Add a versioned candidate-skill store with staged/shadow execution, explicit approval, atomic promotion and rollback.
3. Expand holdout reporting into three linked levels: skill artifact quality, execution trajectory, and verified task outcomes.
4. Add task-order and transfer experiments with context-only and no-skill controls, retention/forgetting metrics, paired seeds, and uncertainty intervals.
5. Fix the PR/Actions execution visibility issue before claiming validation.
