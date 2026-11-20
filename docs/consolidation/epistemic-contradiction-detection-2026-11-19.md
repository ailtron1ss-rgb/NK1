# Epistemic contradiction detection — 2026-11-19

## Gap this closes

`PerceptualEpistemicGraph` is the organism's record of what it currently believes it has observed: each `EvidenceClaim` carries a modality, a claim, a provenance class (`observed`, `model-output`, `derived`, `unresolved`) and a confidence. The type declares `contradictionPairs`, the default state initialises it to `0`, and `summary()` reports it to every caller. **Nothing ever incremented it.**

Adding `door is open` from vision and then `door is closed` from the world produced `contradictionPairs: 0`. There was no polarity logic, no negation handling and no antonym handling anywhere in the module, so the epistemic graph could not represent the one thing its name promises: that two of its claims disagree.

The consequence was not cosmetic. `CognitiveImmuneSystem.inspectHealth()` derives its contradiction-pressure signal from `contradictions.snapshot().claims[].status === 'open'`, and the canonical `ContradictionReservoir` was registered from exactly one call site — prediction-error divergence. Perception-level disagreement therefore never reached contradiction pressure, action bias, the cognitive field or the global workspace. The organism could see two incompatible things and report a clean epistemic state.

## What was added

`runtime/neuro-kurisu/src/organism/cognition/PerceptualEpistemicGraph.ts`:

- **`claimPolarity(claim)`** — splits a claim into a comparable core proposition and its polarity. Negation tokens flip polarity and are removed from the core, so `door is open` and `door is not open` share a core and become comparable. Two negations cancel. Bilingual on purpose: English and Russian tokens carry equal weight.
- **Scalar phrases are not negations.** `not only`, `not just` and `не только` are stripped before tokenising. Counting them would manufacture phantom contradictions, which is worse than missing one.
- **Two detection rules.** Identical core with opposite polarity is a contradiction. Different wording over a shared subject with an antonym and the same polarity (`open` / `closed`) is also a contradiction. Unrelated claims never pair, so sharing a negation token is not enough.
- **`contradictionPairs` is a gauge, not a lifetime event counter.** It is recomputed over the retained window as the number of distinct opposing *witness* pairs, where a witness is `(modality, claim)`. Restating the same claim from the same modality is persistence, not a second witness, so it cannot inflate the gauge; trimming the 256-claim window cannot freeze a stale number.
- **Resolution is explicit and never destructive.** A `supersedes` edge settles the pair, increments `resolvedPairs`, and keeps both claims in the window so the audit trail survives.
- **`contestedPairs(limit)`** exposes the concrete `{claim, opposing}` rows. The pairing rule lives in the graph, so downstream consumers cannot invent a different notion of conflict.
- **Fail-closed ingestion.** `add()` refuses `null`, non-string, whitespace-only and empty claims instead of throwing, truncates over-long claims, clamps non-finite confidence, normalises a missing/invalid `at` and `modality`, and duplicates `targetIds` defensively.
- **Restore recomputes the gauge.** A saved `contradictionPairs` may predate the current detection rules, so the restored claim window is treated as the source of truth. Hostile saved counters (`NaN`, negative, absurdly large) are refused.

`P41SemanticPerception` exposes the gauge as `metrics.epistemicContradictions` and the pairs as `epistemicConflicts(limit)`. `OrganismCore` registers each perceived conflict into the **existing** canonical `ContradictionReservoir` and adds bounded `contradiction` pressure to the cognitive field. No second contradiction ledger was introduced.

## Verification

`tests/epistemic-contradiction-integrity.mjs`, registered as `test:epistemic-contradiction` and chained into `test:rebuild-recovered`:

- polarity for English and Russian, double negation, and `not only` as a non-negation;
- punctuation and whitespace normalisation;
- direct semantic opposites counted, identical-core opposite-polarity counted once;
- agreement never counted as contradiction, and same-polarity cross-modal claims still corroborate;
- different subjects never pair;
- restating one side does not manufacture a contradiction;
- replay of the same receipt leaves the gauge unchanged and claims idempotent;
- legacy state without the counter restores to zero, and still detects conflicts afterwards;
- a hostile saved counter is refused;
- a 600-claim flood stays bounded at 256 claims, keeps an integer gauge, and completes well inside a 5 s budget;
- `supersedes` settles the pair, keeps three claims, and increments `resolvedPairs`;
- end-to-end: P41 ingest of agreeing evidence produces no conflict, opposing vision/world evidence raises the gauge and yields concrete pairs, the reservoir holds them open, the immune system accepts the snapshot, and a control run with an empty reservoir produces no contradiction signal.

`TYPECHECK=PASS mode=tsc compiler=app-lock` (real strict `tsc`, not strip-only). `test:rebuild-recovered` and `test:smoke` pass, as do the neighbouring p41 suites (`p41-perceptual-integrity-deep-pass`, `big-pass-93-real-semantic-vision`, `p41-semantic-perception`, `p41-truthfulness`, `p41-temporal`) and `cognitive-integrity-gate`. Aspect registry validation and its 12 tests pass.

## What this does not claim

- This is **conflict detection over evidence claims**, not reasoning. Deductive, inductive, abductive and probabilistic inference remain scattered and still have no single owner; aspect #9 is recorded as `CONNECTED` with a candidate owner, not `PROVEN`.
- Detection is lexical: negation tokens and a bounded bilingual antonym table. It will miss paraphrase-level and world-knowledge contradictions, and it can pair claims that are compatible in context. It is deliberately conservative rather than clever.
- A raised gauge is not a confidence penalty. It does not yet change belief revision, goal selection or the selected action; it makes the disagreement representable and observable downstream.
- No Release ZIP, no `main` change and no claim of improved organism competence.
