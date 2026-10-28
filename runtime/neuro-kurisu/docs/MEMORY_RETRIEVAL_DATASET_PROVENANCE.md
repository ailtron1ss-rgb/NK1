# NK1 MemoryOS2 retrieval-dataset provenance

## Why this exists

A benchmark report needs both a canonical hash for the labelled examples and a digest for the exact source-file bytes. The first makes semantic label identity reproducible when harmless row ordering or query casing changes; the second pins the actual JSONL artifact that was reviewed. Neither hash proves that the labels are correct or independent.

## Fingerprint a frozen labels file

From `runtime/neuro-kurisu`:

```bash
npm run fingerprint:memory-retrieval-dataset -- --labels data/retrieval/labels.jsonl
```

The script emits:
- `contentSha256`: canonical fingerprint used by `MemoryRetrievalBenchmark` as `datasetProvenance.contentSha256`.
- `rawSourceSha256`: SHA-256 of the exact valid UTF-8 bytes in the supplied labels file.
- Counts for train, answerable holdout, and explicitly unanswerable holdout queries.
- A provenance JSON template with fields that must be replaced by verified dataset-specific values.

Freeze the labels file, the provenance file, and the commit/archive reference in version control before comparing retrieval strategies. Never generate holdout answers from the candidate system being evaluated. A synthetic fixture or a hash does not establish benchmark quality. Duplicate ground-truth labels and malformed relevance-label values (blank strings, non-strings, or nulls) are integrity failures. The runner counts malformed values before normalization filters them; a valid fingerprint of the surviving normalized rows does not waive the source-label integrity gate.

## Run the offline paired baseline/candidate experiment

The provenance file should include the canonical hash from `contentSha256`, a stable dataset ID/version/sourceRef, a clear labeling protocol, and a **verified** SPDX identifier or `LicenseRef`. It may also include `rawSourceSha256`; when supplied, the runner refuses to publish a report unless it matches the exact labels-file digest.

```bash
npm run run:memory-retrieval-experiment -- \
  --snapshot data/retrieval/memoryos2-snapshot.json \
  --labels data/retrieval/labels.jsonl \
  --provenance data/retrieval/provenance.json \
  --out reports/retrieval-run-001.json \
  --seeds 13,29,53 --k 5
```

Output publication is exclusive: choose a new `--out` path for each run; an existing report is not overwritten. The runner performs an offline clone experiment and does not mutate live MemoryOS2. Bootstrap seeds vary confidence-interval resampling only; they do not train the retrieval algorithm.

## Promotion boundary

The experiment always sets `candidateAutomaticallyPromoted=false`. Promotion eligibility is not a deployment authorization. The current default gates include corpus/dataset integrity, query-split leakage checks, source provenance, sufficient labelled and unanswerable holdout examples, recall uplift, MRR non-inferiority, unsupported-retrieval non-inferiority, and candidate-result safety. Independent review and all project-level release gates remain mandatory.
