# WorkPass500 — multiscale cognition and replay integration notes

Research date: 2026-10-24.

## Sources examined

- Jensen, Hennequin & Mattar (2024), *A recurrent network model of planning explains hippocampal replay and human behavior*, Nature Neuroscience: https://www.nature.com/articles/s41593-024-01675-7
- Huang et al. (2024), *Replay-triggered brain-wide activation in humans*, Nature Communications: https://www.nature.com/articles/s41467-024-51582-5
- Rolls & Treves (2024), *A theory of hippocampal function: New developments*, Progress in Neurobiology: https://pubmed.ncbi.nlm.nih.gov/38834132/
- Hodson, Mehta & Smith (2024), *The empirical status of predictive coding and active inference*: https://doi.org/10.1016/j.neubiorev.2023.105473
- Wang et al. (2023), *Voyager: An Open-Ended Embodied Agent with Large Language Models*: https://arxiv.org/abs/2305.16291
- Letta/MemGPT memory architecture overview: https://github.com/letta-ai/ezra/blob/main/reference/2026-02/letta_memory_systems.md

## What the evidence does and does not support

The cited work supports studying replay as a mechanism for planning, memory retrieval and coordination across systems; it does not establish that an artificial agent using analogous software has subjective consciousness. Predictive processing and active inference remain empirical research programs with unresolved scope and validation requirements. NK1 should therefore optimize measurable capabilities—prediction calibration, counterfactual planning, verified outcome learning, continuity, transfer and self-initiated goal pursuit—without claiming these prove phenomenal experience.

## Proposed NK1 architecture mapping

1. **Fast active workspace:** the existing global-workspace / cognitive-cycle path selects a small set of high-salience, goal-relevant items for the current decision.
2. **Episodic replay:** the hippocampal/multi-timescale memory layer retrieves short trajectories around surprising or consequential events, not just isolated text matches.
3. **Counterfactual planning:** replay branches into alternative action sequences and estimates predicted outcomes; simulations stay explicitly labeled as simulations.
4. **Reality reconciliation:** after action, the verified outcome/postcondition ledger labels which predicted consequences actually occurred. User reports, model-generated claims and simulation outputs must not silently become external ground truth.
5. **Consolidation and skill formation:** only provenance-preserving, outcome-linked trajectories feed candidate skill repair; independent holdout evaluation remains outside candidate generation and tuning.
6. **Homeostatic resource control:** memory/replay effort is bounded by uncertainty, expected information gain, importance, compute budget and mobile latency. Low-value replay must not crowd out active perception or current safety checks.

## Donor-project lessons

- **Voyager:** automatic curriculum + executable skill library + feedback/error-conditioned refinement. Adapt the loop and compositional skill idea; do not import Minecraft-specific controllers.
- **Letta/MemGPT:** explicit memory tiers and context-budget management. Adapt tier boundaries and deliberate retrieval; preserve NK1's existing memory substrate instead of creating a parallel store.
- **Hippocampal replay literature:** evaluate trajectory replay and future-state simulation, not only retrieval recall. Use ablations to measure whether replay improves planning and transfer.
- **Predictive processing/active inference:** expose prediction error and uncertainty as explicit signals, but calibrate them against observed outcomes instead of treating model confidence as truth.

## Next engineering passes

- Wire the same causal outcome identity through action receipt, postcondition evidence, episodic replay and P23 candidate provenance.
- Add a replay ablation that compares no replay, recency-only replay, surprise-weighted replay and causal-utility replay on identical task seeds.
- Report per-family/per-seed transfer, forgetting, latency and resource cost; do not promote based on aggregate reward alone.
- Require all simulated futures to retain simulation provenance until an external/device observation verifies the relevant postcondition.

## Definition of integrated

A mechanism is integrated only when production runtime calls it, it consumes/produces the canonical evidence contract, its state survives restore when required, failure paths are explicit, and a regression test demonstrates the behavioral effect. A research document or a passing unit test alone does not meet this bar.

## WorkPass509 — Hermes reflective evolution and NK1 promotion-boundary update (2026-10-24)

### Upstream evidence reviewed

- NousResearch/hermes-agent-self-evolution: https://github.com/NousResearch/hermes-agent-self-evolution and its PLAN.md. The loop mines real failures/traces, splits train/validation/holdout, creates candidate variants, evaluates them in parallel, applies size/semantic/test constraints, and opens a reviewable change. The upstream README distinguishes implemented skill-evolution from later planned phases; NK1 must not assume the whole optimizer stack is production-ready.
- Voyager paper and project: https://arxiv.org/abs/2305.16291 and https://github.com/MineDojo/Voyager. Transferable ideas are automatic curriculum, executable/compositional skills, error-conditioned refinement, and environment self-verification—not Minecraft-specific action code.
- GEPA use-case notes: https://gepa-ai.github.io/gepa/guides/use-cases/. Reflective mutation is valuable only when tied to traces and a measurable evaluator; it is not a substitute for independent holdout evidence.

### NK1 adaptation decisions

1. Keep P23 as the only skill-revision pipeline. Do not add a second optimizer, skill library, or memory store.
2. Treat trajectory/error analysis as a candidate-generation signal, never as proof that the proposed repair works.
3. Preserve independent train/validation/holdout identities and reject candidates that improve the target slice while regressing protected capability families.
4. Keep candidate creation, evaluation, and activation as distinct authority boundaries. Activation requires the existing explicit promotion gate and provenance manifest.
5. Mine only privacy-safe, provenance-tagged examples; synthetic, user-reported, simulator, and device-observed evidence remain separate lanes.
6. Use Voyager-style curriculum as a bounded goal proposer: rank by capability gap × expected information gain × relevance, then pass candidates through budget, cooldown, ethics and capability gates.
7. Keep source-code copying blocked until the exact upstream license and dependency transitive licenses are verified. This pass transfers design patterns only.

### Next implementation passes

- P0: propagate one decision/event identity through receipt → postcondition → RealityEvidenceLedger → episodic replay → P23 candidate manifest.
- P1: add multi-seed paired evaluator that compares baseline/candidate on target and protected task families, recording latency and resource cost.
- P2: add bounded failure clustering and a repair-plan schema that references concrete trace steps and expected postconditions.
- P3: connect automatic curriculum to endogenous goals while ensuring simulated outcomes never enter the external-grounding lane.
- P4: expose exact-head CI/holdout evidence in the integration dashboard; no branch merge or release publication without those gates.

### Evidence boundary

The upstream architecture is a useful donor pattern but does not establish NK1 improvement. No benchmark uplift, successful test run, production integration, or release artifact update is claimed by this research note.

