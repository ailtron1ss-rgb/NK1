# PASS20 — synergy analysis and expected-effect framework

## Why these mechanisms were chosen together

The current NOMEGA bottleneck is composition: multiple useful mechanisms exist, but their feedback is fragmented. The PASS20 design connects four loops.

1. **Experience persistence**: raw execution histories are not treated as skills; they are stored first and consolidated into reusable knowledge.
2. **Structured composition**: active skills are selected jointly as a subset + count + order instead of independent top-k retrieval.
3. **Adversarial pressure**: actual counterexamples seed harder variants, which prevents the evaluator from becoming a static benchmark.
4. **Cost-aware evidence**: expensive checks are delayed until a candidate survives cheaper evidence, while final verification remains unchanged.

## External signals that motivate the design

- SkillComposer reports that learnable create/improve/merge operations can improve skills and transfer; its related structured-composition formulation treats subset/count/order as a joint decision.
- SkillRT applies compiler/runtime techniques to skills and reports large efficiency improvements in its own evaluation setting.
- WikiSkill separates raw experience, persistent knowledge and executable skills and reports better skill evolution/transfer with persistent knowledge accumulation.
- EvoTest evolves reusable agent components across episodes using test-time experience.
- DGM, Beagle/DarwinX and CodeEvolve explore lineage, population search, islands, adversarial pressure and harness evolution.

These external numbers are **not** added to NOMEGA's metrics. The tasks, models and evaluation protocols differ.

## Expected effect if all mechanisms work together

The mechanisms should have complementary—not additive—effects:

`persistent memory` can reduce relearning;
`composition` can reduce search over skill combinations;
`adversarial tests` can reduce false promotion and benchmark gaming;
`staged evidence` can reduce wasted compute;
`causal credit` can reduce incorrect attribution;
`evolution` can widen the search distribution.

The combined effect could therefore be substantial, but no defensible single multiplier can be inferred from the literature. The correct experiment is the matrix below.

| Variant | Added mechanism | Main question |
|---|---|---|
| A | PASS19 | baseline |
| B | experience wiki | does persistent knowledge improve repeat-task transfer? |
| C | skill composition | does joint planning beat independent retrieval? |
| D | adversarial arena | does failure-driven testing improve robustness? |
| E | evidence scheduler | does staged evidence reduce compute per verified success? |
| F | B+C+D+E | does the integrated system outperform isolated mechanisms? |
| G | F + causal credit | does attribution improve retention and reduce regression? |

Each variant should use the same task families, seeds, compute budget, model checkpoint policy and frozen holdout/OOD sets.
