# Independent bilingual memory retrieval holdout

This runner evaluates MemoryOS2 retrieval against the current BM25 baseline without mutating live memory or promoting a candidate. It deliberately does **not** ship a fabricated "independent" dataset: supply an independently sourced and labelled JSON file outside the repository.

## Dataset contract

The input JSON must contain:
- \`schemaVersion: 1\`
- \`snapshot.items\` with 12–1600 unique memory rows
- a \`provenance\` object with \`datasetId\`, \`datasetVersion\`, \`sourceRef\`, \`labelingProtocol\`, and \`licenseId\`
- \`examples\` with unique IDs, explicit \`language: "ru" | "en"\`, \`split: "train" | "holdout"\`, query text, and exact \`relevantIds\`
- unanswerable holdout queries with \`answerable: false\` and an empty \`relevantIds\` list

Per language, require at least 4 unique training queries, 20 answerable holdout queries, and 8 explicitly unanswerable holdout queries. All ground-truth memory IDs must exist in the snapshot. Duplicate corpus IDs, duplicate example IDs, and duplicate labels within one example are rejected. Fixture-like source references are rejected; this is evaluation of independent evidence, not a way to re-label synthetic fixtures as real.

## Run

From \`runtime/neuro-kurisu\` with Node 22.12+:

\`\`\`sh
node --experimental-strip-types tests/run-independent-bilingual-memory-holdout.mjs --dataset /secure/path/nk1-memory-holdout.json --out /secure/path/nk1-memory-holdout-report.json
\`\`\`

The runner reports Russian and English separately, evaluates five paired bootstrap seeds (13, 29, 53, 71, 101), binds labels to the shared canonical SHA-256 fingerprint, and records corpus/configuration fingerprints, integrity checks, baseline/candidate metrics, deltas and confidence intervals. Bootstrap seeds resample evidence; they do not train the retrieval algorithm.

The report is evidence for review, never an automatic promotion decision. Keep private or user-origin memory data outside public commits and use a controlled local file or private CI artifact.

No independent dataset is bundled by this change, so no recall uplift is claimed.