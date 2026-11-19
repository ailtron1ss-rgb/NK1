# Independent bilingual memory retrieval holdout

This runner evaluates MemoryOS2 retrieval against the existing BM25 baseline without mutating live memory or promoting a candidate. It deliberately does **not** ship a fabricated “independent” dataset: supply an independently sourced and labelled JSON file outside the repository.

## Dataset contract

```json
{
  "schemaVersion": 1,
  "now": 2000000000000,
  "provenance": {
    "datasetId": "dataset-name",
    "datasetVersion": "immutable-version-or-commit",
    "sourceRef": "URL, immutable archive hash, or internal artifact reference",
    "labelingProtocol": "how independent ground-truth labels were assigned",
    "licenseId": "SPDX identifier or documented LicenseRef"
  },
  "snapshot": { "version": 1, "items": [] },
  "examples": [
    { "id": "ru-train-001", "language": "ru", "split": "train", "query": "пример запроса", "relevantIds": ["memory-id"] },
    { "id": "en-holdout-001", "language": "en", "split": "holdout", "query": "example query", "relevantIds": ["memory-id"] },
    { "id": "ru-noanswer-001", "language": "ru", "split": "holdout", "query": "запрос без ответа", "relevantIds": [], "answerable": false }
  ]
}
```

Requirements per language: at least 4 unique training queries, 20 answerable holdout queries and 8 explicitly unanswerable holdout queries. The snapshot must contain 12–1600 unique memory rows; all labelled IDs must exist in it. Provenance must identify dataset version, source, labelling protocol and license. Test fixtures/synthetic data are rejected as independent evidence.

## Deterministic normalization

Query fingerprints use Unicode NFKC normalization, lowercase conversion, and Unicode punctuation/symbol/whitespace canonicalization. Rows and relevant IDs are sorted before SHA-256 hashing. This logic lives in `holdout-normalization.mjs` and has direct regression coverage for full-width characters, punctuation, whitespace, row/label order and content changes.

## Run

From `runtime/neuro-kurisu` with Node 24:

```sh
node --experimental-strip-types tests/run-independent-bilingual-memory-holdout.mjs --dataset /secure/path/nk1-memory-holdout.json --candidate-mode canonical --out /secure/path/nk1-memory-holdout-report.json
# After the baseline run, evaluate the opt-in metadata candidate against the same labelled data:
node --experimental-strip-types tests/run-independent-bilingual-memory-holdout.mjs --dataset /secure/path/nk1-memory-holdout.json --candidate-mode metadata --out /secure/path/nk1-memory-metadata-candidate-report.json
```

The runner reports Russian and English separately, uses five paired bootstrap seeds (13, 29, 53, 71, 101), binds labels to SHA-256 fingerprints, and records corpus/configuration fingerprints, integrity checks, baseline/candidate metrics, deltas and confidence intervals. The report is evidence for review, never an automatic promotion decision. Seeds vary resampling only; they do not train the retriever. Keep private/user memory data outside public commits and use a controlled local file or CI artifact.

## Candidate mode

`--candidate-mode canonical` is the default and evaluates the existing canonical retriever. `--candidate-mode metadata` opts the isolated candidate arm into the metadata postings channel while the baseline arm remains canonical. The mode is included in the retrieval-configuration fingerprint and report. This switch never mutates live memory and never promotes a candidate; an external dataset with independently labelled train/holdout queries and complete provenance is still required. Run both modes against the same immutable dataset version and compare per-language paired metrics; synthetic contract tests are not independent evidence.
