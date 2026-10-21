# WorkPass84 — SkillLearnBench learning-evaluation integration

Date: 2026-10-21

## Selected upstream

- Project: [cxcscmu/SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench)
- License: MIT; upstream LICENSE text is preserved at `runtime/neuro-kurisu/research/vendor/SkillLearnBench/LICENSE`.
- Why selected: it directly evaluates generated agent skills for real-world tasks and separates three dimensions often conflated by a single reward: task success, skill quality, and execution-trajectory quality. Its documented skill rubric includes functional coverage, executability, and safety; trajectory metrics include key-point recall, order, and completeness.
- Source inspected: upstream `README.md`, `LICENSE`, `BASELINES.md`, and `evaluate_skills.py`.

## Implemented source changes

1. Added `SkillLearnBenchAdapter.ts` as a native TypeScript evaluator with explicit input contracts and deterministic normalized metrics.
2. Task success is derived only from a boolean supplied by an independent verifier; the skill cannot declare itself successful.
3. Skill quality reports capability coverage, trusted executability preflight, and safety-violation presence separately.
4. Trajectory quality reports expected-step recall, order-preserving match rate, completeness, missing reference steps and unexpected observed steps.
5. Added macro-averaging across task families so tasks with more repeated trials do not dominate the aggregate.
6. Added regressions for ideal and degraded trials, missing capabilities/steps, out-of-order actions, unexpected actions, invalid safety counts, duplicate rubric IDs, and task-level macro averaging.
7. Registered the test in `package.json` and `.github/workflows/p26-learning-validation.yml`.
8. Preserved the upstream license and baseline taxonomy with an intake note.

## Byte-for-byte boundary and why the full upstream runner was not copied

The original `evaluate_skills.py` requires Docker, Python-side agent/task modules, external model credentials, and task-specific execution environments. Copying that entry point alone would not be a functional integration and could trigger costly or credential-dependent execution. Instead, the legally relevant MIT license and baseline reference are preserved verbatim; the evaluator is a native adapter of the benchmark's published metric dimensions. This is **not** a claim of full SkillLearnBench compatibility and does not include its 20-task/100-instance dataset or reproduce its official leaderboard.

## Verification status

- Source, test, vendor license/reference, npm script and workflow step have been committed to `workpass79-learning-input-integrity` / PR #13.
- This connector session has not executed Node or TypeScript commands. The new workflow is wired to run the regression, but until a completed GitHub Actions job is inspected, tests/typecheck remain **unverified**.
- No improvement in real-world learning, transfer, retention or task success is claimed. This pass adds a measurable evaluation interface, not evidence that the learner improved.

## Next integration gates

1. Bind trusted task-specific capability/step rubrics and independent verifier outputs to real skill execution records.
2. Run the same task/seed matrix against no-skill, one-shot, self-feedback and repair/replay baselines.
3. Report task-macro averages plus per-family and per-seed uncertainty; keep holdout evidence isolated from skill-generation feedback.
4. Audit actual runtime call paths to ensure candidate skills cannot forge `executable`, safety or verifier fields.
