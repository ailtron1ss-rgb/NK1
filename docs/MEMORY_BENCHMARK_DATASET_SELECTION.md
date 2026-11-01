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

## Reviewed cleaned-S ground truth (optional, recommended for sensitivity analysis)

A later independent review by the ReMe team published `agentscope-ai/ReMe_longmemeval_clean_s_v2`, preserving the same question/session histories while correcting 77 of 500 records: 57 answers and 58 evidence-session lists. In particular, 58 reviewed records have an empty evidence list because the reviewed answer says the supplied information is insufficient. The adapter therefore treats an empty `answer_session_ids` list as an abstention even when the question ID does not end in `_abs` and the original question type is not `abstention`.

- Dataset: [agentscope-ai/ReMe_longmemeval_clean_s_v2](https://huggingface.co/datasets/agentscope-ai/ReMe_longmemeval_clean_s_v2)
- Generated file SHA-256 published by its dataset card: `f8b308cc2d184d029dd2226e0c0a88eeac298e6318706d588e015beb1b83fc7d`
- Upstream original file SHA-256: `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`
- The reviewed dataset card does not clearly declare a separate redistribution license. Keep it as a user-supplied local evaluation file pending license review; do not commit or mirror it in NK1.
- Compare the original and reviewed ground-truth reports separately. Do not combine them into one score or treat the reviewed labels as the original benchmark's official labels.

Run it with the same CLI, using the reviewed filename `longmemeval_s_reme_cleaned.json`. The runner computes the exact local file SHA-256 and records it in the report. Preserve the generated-file SHA above for independent verification.

## Interpretation limits

The current adapter is a **retrieval-only lexical diagnostic**: it compares MemoryOS2's canonical no-embedding retrieval path against per-question Okapi BM25. It does not run an answer-generating model, LLM judge, or the full LongMemEval QA pipeline. The report breaks metrics down by all six question types (`metrics.byQuestionType`) so failures can be traced to temporal reasoning, multi-session recall, knowledge updates, preference, or other categories. Do not compare its retrieval recall/MRR directly with published end-to-end answer-accuracy scores (for example, ReMe's 89.4% agentic result).

The current CI uses a small synthetic contract fixture only. A real 500-question report remains pending until a local dataset file is supplied and its exact SHA-256 is verified. No benchmark score or `recallDelta` improvement is claimed yet.
