# SkillLearnBench source intake

- Upstream: https://github.com/cxcscmu/SkillLearnBench
- Upstream license: MIT; the upstream LICENSE text is preserved in this directory.
- Upstream README describes 20 tasks, 15 sub-domains, 100 verified instances and three dimensions: task success, skill quality, trajectory quality.
- Upstream baseline taxonomy (b1 one-shot, b2 self-feedback, b3 teacher-feedback, b4 skill-creator) is preserved in `BASELINES.md`.
- Upstream evaluator `evaluate_skills.py` is **not** copied into production: it requires Docker, API credentials, Python packages and the upstream task/agent modules. Copying that entry point alone would be a broken integration and could trigger costly external execution.
- NeuroCore implementation is in `runtime/neuro-kurisu/src/organism/learning/SkillLearnBenchAdapter.ts`; it ports the evaluation schema into a native, deterministic adapter without adding dependencies or executing candidate skills.
- This is an adaptation of the benchmark's published dimensions, not a claim of full benchmark compatibility or an official SkillLearnBench result. Task rubrics and independent verifiers must be supplied by a trusted evaluator.
- Source inspected: upstream `README.md`, `LICENSE`, `BASELINES.md`, and `evaluate_skills.py`. Upstream repository: https://github.com/cxcscmu/SkillLearnBench
