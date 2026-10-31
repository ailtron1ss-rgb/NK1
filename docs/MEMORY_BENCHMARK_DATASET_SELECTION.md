# External memory benchmark selection for NK1

Checked 2026-10-31. The corpus itself is never committed to NK1; the adapter accepts a local copy and binds the report to both the upstream dataset revision and the exact file SHA-256.

## Selected: LongMemEval-S cleaned

- Dataset: [xiaowu0162/longmemeval-cleaned](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned)
- Official implementation and task schema: [LongMemEval repository](https://github.com/xiaowu0162/longmemeval)
- Dataset revision: `98d7416c24c778c2fee6e6f3006e7a073259d48f`
- Hub-declared license: MIT
- Hub-declared language: English (`en`)
- 500 questions; 5 abilities include information extraction, multi-session reasoning, knowledge updates, temporal reasoning and abstention.
- Hub storage is about 3.03 GB across S, M and oracle files. NK1 uses only `longmemeval_s_cleaned.json`; no dataset content is stored in this repository.
- The adapter builds one isolated MemoryOS2 corpus per question, preventing sessions from another question from becoming retrieval candidates. It compares per-question Okapi BM25 with canonical MemoryOS2 retrieval.
- Reports include dataset/file fingerprints, hashed question/session IDs and aggregate metrics only; no raw queries or transcript text.

### Running locally

Download the S file from the pinned dataset revision, then run:

```bash
node --experimental-strip-types runtime/neuro-kurisu/tests/run-longmemeval-memory-benchmark.mjs \
  --dataset /path/to/longmemeval_s_cleaned.json \
  --revision 98d7416c24c778c2fee6e6f3006e7a073259d48f \
  --out /path/to/nk1-longmemeval-report.json
```

This is diagnostic external evidence only. LongMemEval is English-only and cannot satisfy the NK1 bilingual RU/EN promotion contract. No candidate is automatically promoted.

## Rejected / deferred datasets

### LoCoMo

[Official repository](https://github.com/snap-research/locomo) has GitHub license metadata `NOASSERTION`. Do not copy or redistribute its data until an explicit upstream dataset license is verified.

### PersonaMem-v2

[Hugging Face dataset](https://huggingface.co/datasets/bowen-upenn/PersonaMem-v2) declares CC-BY-4.0 and English-only metadata. Its schema contains persona attributes and a `sensitive_info` flag, including health, political, race/ethnicity and sexual-orientation fields. NK1 will not import raw persona profiles; the task design can inform future tests without copying the sensitive records.

### LongMemEval-V2

The dataset is Apache-2.0 but about 7.12 GB and designed for web/enterprise-agent trajectories. Defer it as a separate agent-memory benchmark rather than mixing it into conversational-memory scores.
