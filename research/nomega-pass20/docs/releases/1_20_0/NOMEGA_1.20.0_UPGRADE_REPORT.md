# NΩ 1.20.0-dev — Real Upgrade Report

Date: 2026-09-20
Status: `research_only`

## 1. What was actually changed

This update is intentionally code-first. It does not replace the existing neural research
stack. It adds a canonical executable path on top of the already-existing acquisition,
TinyVM and HVM components and connects that path to the main runtime.

### New executable modules

- `core/nomega/execution_contract_v2.py` — canonical evidence-bearing result contract.
- `core/nomega/prompt_grounding_v2.py` — conservative natural-language grounding into canonical TaskSpec families.
- `core/nomega/executable_spine_v2.py` — ground → propose → execute → cross-verify → persist loop.
- `core/nomega/counterexample_search_v2.py` — bounded counterexample-driven refinement.
- `core/nomega/self_evolution_lab_v1.py` — bounded configuration self-optimization with evidence and rejection gates.

### Main runtime integration

`NOmegaCore.run()` now gives the executable spine first refusal on bounded, grounded math/
program tasks. Verified results are persisted to memory/skills and cached, and otherwise execution falls
through to the original cognitive route.

`NOmegaRuntime` now exposes:

- `executable_spine(...)`
- `self_evolution_probe(...)`

### Governance / packaging

- research branch version aligned to `1.20.0-dev`
- package version aligned to `1.20.0.dev0`
- new configuration flags for executable spine, counterexample refinement and bounded self-evolution
- governance check passes with 0 failures

## 2. Measured implementation delta

Baseline archive: 381 Python files / ~35,220 Python LOC.
Current archive: 390 Python files / ~36,108 Python LOC.

New production/research code in this upgrade: 667 Python LOC.
New tests: 66 LOC.
Modified pre-existing source/config/version files: 7.

This is a real implementation delta, not only a planning update.

## 3. Direct measured results

### 3.1 Executable spine matched benchmark

Three canonical task families × three seeds = 9 cases.

- verified rate: **1.00 (9/9)**
- mean confidence: **0.9997**
- mean evidence score: **1.00**
- mean host latency: **2.50 ms**
- independent TinyVM/HVM cross-check included

This result is valid only for the bounded canonical benchmark represented by the project DSL.
It must not be interpreted as broad coding competence.

Artifact: `runtime/executable_spine_v2_benchmark.json`.

### 3.2 Fresh-process smoke

A fresh runtime process solved:

- `add the first three values` → 20, verified
- `multiply the first two values` → 42, verified

Artifact: `runtime/fresh_process_spine_smoke.json`.

### 3.3 Self-evolution experiment

Six bounded configuration mutations were evaluated against a small explicit-operation suite.
Baseline verification was already **1.00**. No mutation was promoted. The first draft of the evaluator exposed a missing explicit-op field; that harness defect was corrected and the final self-evolution measurement is the second recorded run.

Reason: there was no evidence of an improvement large enough to justify promotion.
This is a positive control result for the rejection mechanism, not a failure of the feature.

Artifact: `runtime/self_evolution_lab_v1.jsonl`.

## 4. Regression status

Targeted 1.20 tests + selected 1.17/1.18 neural tests:

- **19/19 PASS** in the final targeted groups used for this update before packaging.

Governance:

- **PASS / 0 failures**
- 88 legacy warnings remain in old core files for `except/pass` patterns.

Full regression:

- 279 tests were collected.
- The full run still exceeds the short execution window because `test_ladder_contract::test_channels_separated` is a long-running legacy test.
- This remains a project performance/CI bottleneck and is explicitly **not** marked as PASS.

## 5. Problems discovered and corrected during this upgrade

1. The research neural stack existed but was not on the main canonical executable path.
2. Natural-language arithmetic queries could fall through to planner routing when no explicit
   `op` context was supplied.
3. Verification evidence had many different result shapes; a common evidence contract was missing.
4. Candidate failure information was not yet a first-class search signal in the new path.
5. Version metadata disagreed between `version.py`, `VERSION.json` and `pyproject.toml`.
6. Bare exception handling introduced by the new integration was rejected by governance and
   corrected before final packaging.

## 6. Remaining bottlenecks

### A. Pure-neural executable synthesis

The historical 1.18 matched V9/V13 research result still has verified rate 0.0 despite routing
improvements. This remains the primary neural bottleneck.

### B. Version sprawl

The archive contains many numbered development modules. The next consolidation pass should
introduce canonical interfaces before adding further `v14/v15/...` copies.

### C. Full-suite throughput

The legacy ladder tests dominate end-to-end verification time. CI needs an official tiered
suite: fast gate, research gate and exhaustive overnight gate.

### D. Device evidence

Host timing is useful for development but is not a mobile benchmark. Termux/Android measurement
is still required for real thermal/battery/latency claims.

## 7. Completion percentages

These are engineering progress indicators, not capability evidence.

- **Code implementation of this 1.20 upgrade block:** 100%
- **Executable spine integration:** 100%
- **Evidence/provenance contract:** 100%
- **Counterexample refinement block:** 100% implementation / 25% evidence breadth
- **Bounded self-evolution control:** 100% implementation / 15% evidence breadth
- **Research ingestion and archival:** 100%
- **Targeted regression:** 100% for the executed targeted set
- **Full regression resolution:** 15%
- **Version/packaging consistency:** 100%
- **Source-level autonomous self-modification:** 10%
- **Neural value-model integration:** 0% implementation in 1.20 block; next major block
- **Long-horizon self-evolution evaluation:** 5%
- **Real Android/Termux device validation:** 0% in this pass

### Overall project-development progress toward the long-term goal

**Estimated engineering roadmap completion: ~31%**.

This number is intentionally lower than the implementation completion of the current block:
the archive has many research mechanisms already, but the end-to-end path from neural proposal
to verified, transferable, self-improving code remains incomplete.

## 8. Capability / architecture ratings

Ratings are engineering-state scores, not claims of general intelligence.

| Area | Score / 100 | Basis |
|---|---:|---|
| Codebase breadth | 88 | large multi-module research platform |
| Executable infrastructure | 82 | TinyVM/HVM/acquisition now linked through a canonical spine |
| Verification infrastructure | 86 | multiple runtimes + evidence contract |
| Neural program synthesis | 48 | many implemented variants, weak verified grounding evidence |
| Search / repair | 70 | multiple repair/search mechanisms; counterexample layer newly added |
| Memory / skills | 72 | mature subsystem, transfer still needs stronger causal evidence |
| Self-model / autonomy | 58 | many mechanisms exist, long-horizon causal evidence incomplete |
| Self-evolution | 42 | bounded configuration evolution works; code evolution not yet automated |
| Mobile readiness | 39 | many optimizers exist; real device evidence is lacking |
| Architecture consolidation | 51 | strong feature depth, high version/module sprawl |
| Testing / CI scalability | 55 | broad suite, but exhaustive path is too slow |
| Research discipline | 84 | governance/promotion gates are unusually explicit |

## 9. Next giant pass

The next development block should be larger than the current one and focus on turning the
new spine into the learning substrate of the whole system:

1. train a value model over partial programs;
2. feed TinyVM/HVM execution traces into value learning;
3. train on counterexamples, not only successful programs;
4. add an instruction-space proposer before neural synthesis;
5. add independent test generation and frozen test sets;
6. add a multi-arm candidate archive with descendant/metaproductivity scoring;
7. connect verified programs to procedural skill memory and replay;
8. run transfer/negative-transfer experiments;
9. introduce a source-level patch sandbox only after the above gates pass;
10. evaluate long-horizon cycles with no reset;
11. benchmark on real mobile hardware;
12. consolidate legacy version modules into canonical interfaces.

The architectural target remains:

`observe → ground → generate → search → execute → verify → explain failure → repair → learn →
store skill → measure transfer → detect bottleneck → generate experiment → isolated change →
retest → promote/rollback`.
