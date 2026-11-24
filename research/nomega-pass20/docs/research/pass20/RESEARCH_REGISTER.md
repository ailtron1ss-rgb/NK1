# NOMEGA PASS20 — research and implementation register

## 2026 findings incorporated

### SkillComposer / structured skill composition
SkillComposer (June 4, 2026) treats skill creation as learnable **create / improve / merge** operations and reports gains on agent/code benchmarks. A related June 30, 2026 work formalizes **structured skill composition** as a joint decision over subset, count and order rather than independent retrieval. NOMEGA PASS20 therefore adds `SkillCompositionEngineV1`, but only executable verified programs may become active skills.

Sources:
- https://arxiv.org/abs/2606.06079
- https://arxiv.org/abs/2606.32025

### SkillRT
SkillRT (April 3, 2026) applies compiler ideas to skills: capability-based compilation, environment binding, concurrency extraction, JIT solidification and adaptive recompilation. It reports up to 40% token reduction, 3.2x speedup and larger latency reductions in its evaluated setting. NOMEGA already has a `SkillCompiler`; PASS20 records this as the next concrete optimization direction rather than claiming those numbers transfer to NOMEGA.

Source: https://arxiv.org/abs/2604.03088

### WikiSkill
WikiSkill (August 27, 2026) separates raw execution experience, persistent knowledge and executable skills and reports that persistent accumulated knowledge is important for skill evolution and transfer. PASS20 implements the same separation as `ExperienceWikiV1` and links admitted skills back to experience/knowledge IDs.

Source: https://arxiv.org/abs/2608.27454

### Evolutionary test-time learning
EvoTest provides a recent open-source example of evolutionary test-time learning in which an agent updates reusable prompts, memory, state extractors and tool routines between episodes without requiring fine-tuning. PASS20 borrows the persistent-episode and adversarial test-generation ideas, but keeps NOMEGA's independent execution verifier authoritative.

Source: https://github.com/yf-he/EvoTest

### Recursive self-improvement / harness evolution
Recent 2026 work and open implementations continue to explore self-modifying agents, population search, adversarial arenas and evolving harnesses. DGM provides a lineage-preserving self-improvement loop; Beagle/DarwinX provides large-scale agent-harness evolution; CodeEvolve provides islands/migration/quality-diversity style search.

Sources:
- https://github.com/lemoz/darwin-godel-machine
- https://github.com/SalesforceAIResearch/Beagle
- https://github.com/inter-co/science-codeevolve

## Integration hypothesis

The findings should **not** be added as independent layers. The PASS20 hypothesis is that the biggest useful combination is:

`experience wiki -> structured skill composition -> adversarial test generation -> staged evidence -> verified skill admission -> evolutionary lineage -> causal replay`

Expected benefit is a reduction in wasted search and better transfer/retention of successful experience. Numeric gains must be measured on matched seeds/budgets and must not be added arithmetically across papers because the reported benchmarks, models and evaluation protocols differ.

## Experimental matrix

| Variant | Components | Primary measurement |
|---|---|---|
| A | PASS19 | baseline verified success / compute |
| B | + wiki | transfer after repeated episodes |
| C | + composition | multi-skill success |
| D | + adversarial arena | error avoidance / robustness |
| E | + adaptive scheduling | verified success per unit compute |
| F | B+C+D+E | full PASS20 synergy |
| G | F + causal credit | retention and regression resistance |

Promotion requires matched multi-seed, holdout/OOD, restart, regression and resource-budget checks.
