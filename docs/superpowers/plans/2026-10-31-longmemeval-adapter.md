# WorkPass82 — LongMemEval-S external retrieval adapter

**Goal:** Add a reproducible adapter for an independently published, English-only long-term conversational memory benchmark without bundling the dataset or weakening NK1's bilingual promotion gate.

**Selected source:** `xiaowu0162/longmemeval-cleaned`, pinned revision `98d7416c24c778c2fee6e6f3006e7a073259d48f`, declared MIT license, language metadata `en`. The dataset is about 3.03 GB across S/M/oracle files; the runner accepts a local path and never downloads or commits the corpus.

**Rejected candidates:**
- LoCoMo: GitHub reports license `NOASSERTION`; do not redistribute or bundle without explicit license confirmation.
- PersonaMem-v2: CC-BY-4.0 and English-only in Hub metadata, but its schema contains highly sensitive persona attributes (health, politics, race/ethnicity, sexual orientation, sensitive_info). Do not import raw persona records into NK1.
- LongMemEval-V2: Apache-2.0 but ~7.12 GB and oriented toward web/enterprise-agent trajectories rather than conversational chat memory; defer as a separate benchmark.

**Architecture:** One isolated MemoryOS2 instance per LongMemEval question; session records remain scoped to their question, preventing cross-question retrieval leakage. Compare canonical MemoryOS2 retrieval against a deterministic BM25 baseline. Bootstrap paired deltas over connected components of shared session IDs, so repeated source sessions cannot inflate the independent sample count. Reports contain hashes and aggregate metrics only, never raw query/session text.

**Promotion boundary:** This benchmark is English-only. It can provide external EN retrieval evidence, but it cannot satisfy NK1's bilingual RU/EN holdout requirement and can never auto-promote a retrieval candidate.

## Tasks
1. Add synthetic contract tests for answerable and abstention questions, session-ID mapping, dataset fingerprint order invariance, privacy-safe reports, and malformed label rejection.
2. Implement schema validation, per-question snapshot construction, baseline/candidate retrieval, paired bootstrap, pinned provenance, and report export.
3. Add CLI runner for a local LongMemEval-S JSON file; do not commit dataset files.
4. Add package script and exact-head CI; include adapter in canonical rebuild acceptance.
5. Document how to run the adapter and its non-promotion status.
