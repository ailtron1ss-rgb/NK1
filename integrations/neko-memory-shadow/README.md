# NK1 × N.E.K.O. MemoryOS2 shadow evaluator

Dependency-free, read-only evaluation bridge from the real NK1 MemoryOS2 ranked retrieval path into a N.E.K.O.-style hybrid RRF experiment.

**Important:** NK1 already has its own six-channel weighted RRF in MemoryOS2. This package does not replace or duplicate the live fusion. It exports bounded ranked IDs from an isolated MemoryOS2 snapshot so alternate channel weights can be evaluated offline.

## Runtime preview

`MemoryOS2.previewRetrieveWithRankedChannels(query, limit, goal, identity, temporal, maxPerChannel)` returns:
- baseline item IDs,
- ranked IDs for BM25, token coverage, fuzzy, metadata, entity and relationship channels,
- current RRF k and weights,
- answerability diagnostics.

Only IDs that survive the same canonical answerability gate are exported. The preview runs on an isolated snapshot; canonical MemoryOS2 state is not mutated. Memory text is never returned.

`previewNekoHybridMemoryRanking(memory, query, { includeSemanticEmbeddingChannel: true })` optionally adds the existing semantic embedding preview as a vector rank channel. It is opt-in. If canonical retrieval abstains, vector-only IDs are returned separately as `exploratorySemanticIds`; they are not included in shadow fusion. Every result is marked `userFacingEligible: false`.

## Ranking contract

RRF score = sum(weight / (rrfK + one-based rank)); default k=60. Channel weights are bounded to [0,4], including zero to represent a disabled channel. Input channels, candidate arrays, IDs and output size are bounded. Accessor-backed records, proxies, sparse arrays and malformed data fail closed. Equal-score ordering uses locale-independent code-unit comparison.

The adapter returns IDs/ranks/scores only. It does not persist memory, change prompts, mutate OrganismState or replace MemoryOS2.

Run tests from this directory with `npm test`.

Keep this feature shadow-only until independent bilingual source/session-clustered holdout evaluation proves positive recallDelta over at least five paired seeds, with no subject leakage, material unsupported-retrieval increase or latency-budget regression.

## Existing bilingual holdout harness

The offline runner can select this evaluator as the candidate arm of the existing `MemoryRetrievalBenchmark`; it does not create a second metrics/scoring framework. The existing Inspect evidence export then records the shadow arm in `candidateRankedMemory`, and the established Python scorer evaluates recall, MRR, precision, unsupported retrieval, abstention and safety flags.

Example (use the same snapshot, labels, provenance, `--now`, `--k` and seeds for both canonical and shadow reports):

```bash
node --experimental-strip-types scripts/run-memory-retrieval-experiment.mjs \
  --snapshot memory-state.json --labels bilingual-holdout.jsonl \
  --provenance provenance.json --out shadow-report.json \
  --seeds 11,29,47,71,101 --k 5 --inspect-evidence true \
  --candidate-strategy neko-shadow-rrf --candidate-rrf-profile equal \
  --shadow-vector true
```

Run again with `--candidate-strategy memoryos2-canonical` for the current NK1 candidate arm. Choose `--candidate-rrf-profile memoryos2` to replay NK1's existing six channel weights; `equal` tests equal-weight fusion. `--shadow-vector true` is an explicit opt-in to the configured semantic provider. The report records whether the provider actually enabled, fallback reasons, vector coverage and preview latency. The candidate strategy/profile/vector flag are included in the retrieval configuration fingerprint.

The runner uses an isolated snapshot and injects only the shadow-ranked `MemoryItem2` results into the existing benchmark candidate seam. It does not mutate live memory or auto-promote. The five seeds in `MemoryRetrievalExperiment` are paired-bootstrap resampling seeds; they do not randomize or train the retrieval algorithm. A synthetic CI fixture validates the bridge but is not retrieval-uplift evidence.
