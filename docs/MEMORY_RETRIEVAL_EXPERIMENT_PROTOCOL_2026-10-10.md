# MemoryOS2 retrieval experiment protocol — WorkPass 11

**Scope:** reproducible offline baseline-vs-MemoryOS2 evaluation against an externally labelled corpus.  
**Safety boundary:** the experiment restores the supplied snapshot into isolated instances; it never writes to live memory, policy, identity, or release state. A passing result is only eligible for independent review and is never auto-promoted.

## Why this pass exists

The WorkPass 7–10 harness protected label integrity and supplied paired bootstrap intervals, but it was awkward to apply to an external corpus larger than 64 queries. Its corpus digest also omitted rank-affecting item metadata and its adaptive retrieval-policy state. That made some materially different evaluation inputs appear to share a fingerprint.

WorkPass 11:

- fingerprints each complete memory row (including score weights, semantic vectors, links, temporal metadata and provenance fields) using canonical object-key ordering;
- separately fingerprints retrieval configuration that affects the policy choice (`adaptiveMemoryPolicy`, version, link-update and semantic-query counters);
- detects malformed rows, duplicate IDs and input truncation in the supplied corpus and blocks review eligibility when integrity is ambiguous;
- reports future-valid, dormant and unsupported epistemic-status results, and blocks eligibility if the candidate returns them;
- supports up to 512 labelled examples in the offline runner while retaining the HTTP API's default 64-example limit;
- repeats the same fixed experiment with multiple bootstrap seeds, reports confidence-interval sensitivity, and verifies rank metrics remain invariant across seeds.

## Input contract

### 1. Snapshot JSON

The snapshot must be the exported `MemoryOSState2` JSON object, with an `items` array. Up to 1,600 memory rows are supported by the canonical runtime. The snapshot should be a read-only export of the intended test environment, not an edited or hand-composed corpus.

### 2. Labelled JSONL

One JSON object per line:

```json
{"id":"q-train-001","query":"How did the service recover after reconnect?","relevantIds":["memory-id-1"],"split":"train"}
{"id":"q-holdout-001","query":"What evidence confirmed delivery after reconnect?","relevantIds":["memory-id-2"],"split":"holdout"}
{"id":"q-holdout-none-001","query":"Which event has no matching evidence in the snapshot?","relevantIds":[],"split":"holdout","answerable":false}
```

Every label must be produced by the declared labeling protocol independently of the candidate retrieval output. Queries must be unique after Unicode/case/punctuation normalization; duplicate prompts or train/holdout overlap block eligibility. Every relevant ID must exist in the supplied snapshot. For an explicitly unanswerable query, set `answerable: false` and `relevantIds: []`; do not infer that label from the candidate returning no results. The CLI defaults omitted `answerable` to `true` and rejects contradictory rows (for example, `answerable: false` with non-empty relevance IDs). Do not create labels by asking the candidate system what should be relevant.

### 3. Dataset provenance JSON

```json
{
  "datasetId": "your-stable-dataset-id",
  "datasetVersion": "immutable-revision-or-date",
  "sourceRef": "source archive hash, commit, or internal artifact reference",
  "labelingProtocol": "who/what labeled relevance, adjudication policy, and how conflicts were handled"
}
```

Do not put secrets or unnecessary personal data in the report metadata. Use a stable source reference, not a claim that the corpus is high quality.

## Run an experiment

From `runtime/neuro-kurisu`:

```bash
node --experimental-strip-types scripts/run-memory-retrieval-experiment.mjs \
  --snapshot /absolute/path/memoryos2-snapshot.json \
  --labels /absolute/path/relevance-labels.jsonl \
  --provenance /absolute/path/dataset-provenance.json \
  --out /absolute/path/memory-retrieval-report.json \
  --seeds 11,29,47,71,101 --k 5
```

The output file is created exclusively; an existing file is not overwritten. Choose a new output name or explicitly archive the old report before rerunning. Inputs have bounded size and label count. `--now` accepts a fixed Unix timestamp in milliseconds for time-sensitive replay.

The HTTP diagnostic endpoint intentionally retains its smaller bounded request limit. The offline runner is preferred for real corpora and audit artefacts.

## Reading results

- `datasetFingerprint`: normalized labelled query IDs, queries, split assignments and relevant IDs.
- `corpusFingerprint`: canonicalized complete memory rows, with object keys normalized and row order stabilized by ID.
- `retrievalConfigurationFingerprint`: policy/configuration state that can alter ranking even when memory rows are unchanged.
- `determinism`: confirms that retrieval point metrics and the three fingerprints remain stable across bootstrap seeds.
- `sensitivity`: range of paired-bootstrap confidence bounds across seeds.
- `promotion`: always has `allowed: false`; a qualifying outcome is only `candidate-eligible-for-independent-review` and still requires separate human/CI review.

These seeds vary bootstrap resampling, not a stochastic or trained retrieval model. This is a sensitivity analysis for interval stability, not a claim of multi-seed model training. The baseline-vs-candidate ranking is deterministic in this harness. Report Recall@k, MRR, precision, coverage, result safety, latency, and source provenance together; do not cherry-pick a single seed.

## Evidence still required for production uplift

No real user/project corpus is bundled with this pass, and no production uplift is claimed. Before using the report as promotion evidence, run it against an explicitly authorized, independently labelled corpus with a held-out set fixed before viewing candidate results. Record the exact snapshot hash, label protocol, baseline definition, thresholds and report hash. For stronger evidence, use multiple independently collected holdout partitions or temporal holdout sets; do not reuse holdout queries for tuning.


## WorkPass 12 addendum — uncertainty-aware MRR and report publication

- Candidate review now requires both a positive paired-bootstrap recall lower bound and an MRR lower bound no worse than the configured non-inferiority tolerance (`maximumMrrRegression01`). The point estimate must also stay within that tolerance. In multi-seed experiments, every seed must meet the MRR non-inferiority bound.
- Every single-run result includes a `promotion.gates` object so reviewers can see all failed gates instead of inferring them from the first summary reason. Invalid explicitly supplied bootstrap seeds are reported and block eligibility; the effective seed is recorded separately.
- The CLI publishes reports from a flushed temporary file via an atomic, exclusive same-filesystem link. It never overwrites an existing destination and cleans up temporary files on handled failures.
- These additions improve the validity and durability of evidence. They do not replace independent labeling, temporal holdouts, or browser/release evidence.
