# NΩ 1.23.0-dev — Real Upgrade Report

## Scope
This pass extends the execution-grounded program learning stack with two experimental mechanisms:

1. **Partial-program value estimation** from execution-derived Monte-Carlo returns.
2. **Verifiable environment forging** that creates harder, reusable test rows from an independently verified oracle and candidate disagreement.

The value-guided search path is explicitly **research-only by default** because current small-benchmark measurements show candidate pruning but not an end-to-end latency win.

## Code work
- `core/nomega/partial_program_value_v1.py` — 197 LOC
- `core/nomega/verifiable_environment_forge_v1.py` — 136 LOC
- `core/nomega/counterexample_search_v2.py` — revised with explicit opt-in value guidance
- `core/nomega/execution_preference_trainer_v1.py` — accepts forged hard rows
- `core/nomega/neural_execution_learning_lab_v1.py` — incorporates forged environments into preference-learning experiments
- package exports and release version advanced to `1.23.0-dev`
- new targeted tests for the value model, value-guided search, and environment forge

### Code accounting
- Entire extracted project: 405 Python files / 36,936 Python LOC.
- New/changed core research code in this pass: 333+ LOC across the two new modules plus integration edits.
- New tests: 42 LOC.
- Code work for the planned 1.23 pass: **100% completed**.

## Value-guided search
The new value model turns executed candidates into prefix-labelled Monte-Carlo observations. A bootstrap ensemble predicts eventual verifier score for a candidate prefix and exposes predictive disagreement for exploration.

Important implementation rule: value guidance is disabled in the normal `CounterexampleSearchV2` path. It is enabled only through `enable_value_guidance=True`. This avoids silently adding neural inference/training latency to the established verified runtime.

### Controlled measurement
On a four-family broken-program benchmark, the research path considered 295 candidates and retained 132 after value ranking (55.3% pruned). In a frozen-model, no-fitting comparison the no-value search took 0.156 s while value-guided inference took 0.361 s on this small benchmark; the one-time training pass took 4.02 s. Thus pruning is real, but the current model is still too expensive for this small search space.

Therefore:

- value-guided candidate pruning: **accepted as research capability**;
- canonical runtime promotion: **rejected for now**;
- next target: batched/vectorized prediction plus larger candidate populations where verifier cost dominates.

## Verifiable environment forge
`VerifiableEnvironmentForgeV1` creates test instances from a verified program oracle. Candidate programs are used only to rank instance hardness and disagreement. Reference outputs are checked through TinyVM and HVM before a row is admitted.

A small end-to-end learning-lab experiment generated 30 hard rows across three families with mean candidate-failure hardness of 0.3333. A separate five-family forge run produced 32 accepted hard rows across four families; `compose_sum_xor` produced zero admissible rows under the minimum-hardness gate, which is a useful rejection signal rather than a fabricated benchmark gain. The resulting neural preference experiment did **not** show a held-out verified-coverage improvement, so no neural checkpoint was promoted.

This is still useful infrastructure because it moves the project toward a self-improving benchmark where the evaluation environment can evolve instead of remaining static.

## Verification
Targeted release gate:

- **31/31 tests PASS** across the affected execution, search, training, governance, and new research modules.
- `tests/test_ladder_contract.py`: **5/5 PASS**; isolated runtime about 31 seconds.
- Full repository regression: **not completed inside the available 180-second validation window**. This remains an explicit release limitation rather than a claimed pass.

## Promotion decisions
### Promoted
- execution-derived partial-program dataset capture
- persisted value-model checkpoint/replay artifacts
- verifiable environment forging
- forged test rows accepted as optional training data
- opt-in value-guided counterexample search

### Not promoted to default runtime
- always-on neural value ranking, due to measured latency overhead on the current small benchmark
- dense-reward neural checkpoint from the preceding 1.22 experiment, because held-out verified generalization remained flat

## Engineering state
| Area | Current estimate |
|---|---:|
| Unified executable spine | 87/100 |
| Independent verification | 89/100 |
| Counterexample search | 79/100 |
| Partial-program value learning | 50/100 |
| Neural synthesis | 56/100 |
| Execution-feedback learning | 49/100 |
| Adaptive test/environment generation | 45/100 |
| Memory/replay | 76/100 |
| Self-evolution governance | 45/100 |
| Full regression infrastructure | 58/100 |
| Research/evidence discipline | 89/100 |

Overall engineering progress toward the long-term project target is estimated at **~39%**. This is an engineering-roadmap estimate, not a measure of intelligence or a probability of achieving a goal.

## Remaining high-value bottlenecks
1. Vectorized value inference so search-time prediction is materially cheaper than verifier calls.
2. A stronger partial-program value target using stepwise execution traces rather than only terminal candidate returns.
3. Adversarial environment generation that adapts to the current model's blind spots and freezes verified suites after novelty/difficulty checks.
4. Multi-seed ablations at larger candidate populations where verifier cost dominates the value-model overhead.
5. Full-suite decomposition to isolate the slowest legacy tests and convert them into cached, independently gated profiles without weakening correctness.
6. Online replay training with holdout/OOD/restart promotion gates.

## Research basis
- B-Coder motivates value-based program synthesis as a natural fit when verification rewards are cheap and historical/off-policy programs are abundant.
- ReVeal motivates iterative generation-verification loops and dense per-turn rewards.
- Project Aletheia motivates training explicit error repair/backtracking from verified traces.
- VerMCTS motivates verifier-guided tree search using intermediate verification feedback.
- 2026 EvoEnv work motivates self-improving systems that construct reusable, validated environments rather than endlessly producing static synthetic data.

See `docs/research/1_23_0/RESEARCH_FRONTIER_2026.md` for source links and integration notes.
