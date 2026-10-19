# Local NLI score calibration — WorkPass 25

This pipeline implements optional scalar temperature scaling for the pinned local NLI cross-encoder. It is **not enabled by default**, does not calibrate a claim's probability of being true, and never promotes a model automatically.

## Why this exists

Raw neural-network softmax scores are often not calibrated. Temperature scaling is a lightweight post-processing method described by Guo et al., *On Calibration of Modern Neural Networks* (ICML 2017): https://arxiv.org/abs/1706.04599. Calibration remains domain-specific; the selected `cross-encoder/nli-deberta-v3-xsmall` model card identifies SNLI/MultiNLI training and English NLI, so performance on Russian, multilingual, legal, medical or project-specific assertions must not be assumed: https://huggingface.co/cross-encoder/nli-deberta-v3-xsmall.

## Required dataset contract

Supply a **dedicated calibration set**, separate from both training data and the final, untouched evaluation holdout. JSONL rows use:

```json
{"id":"stable-001","premise":"...","hypothesis":"...","label":"entailment"}
```

Allowed labels: `entailment`, `contradiction`, `neutral`. The fitting tool requires at least 50 examples per class (150 total minimum), distinct IDs, valid lengths, and a declared source/version plus a labeling protocol. The source text is sent only to the explicitly configured endpoint. Remote evaluation is prohibited unless HTTPS plus `--allow-remote` is explicitly supplied.

## Workflow

1. Start the local NLI service without `KURISU_NLI_CALIBRATION_FILE`; verify `/readyz` reports a loaded model and record its exact model ID/revision.
2. Fit a candidate against the dedicated calibration JSONL. Example:

```bash
python3 tools/fit_research_nli_calibration.py data/nli-calibration.jsonl \
  --dataset-source "internal-reviewed-calibration-v1" \
  --labeling-protocol "two reviewers; adjudicated disagreements; NLI premise/hypothesis rubric v1" \
  --output private/nli-calibration.json
```

The command is local-first (`127.0.0.1:8798` by default), records the input-file SHA-256, class counts, exact model ID/revision, chosen temperature and before/after metrics, excludes premise/hypothesis text from the artifact, uses mode `0600`, and refuses to overwrite an existing file without `--force`. It does not promote the candidate. It exits without producing a usable artifact if any class has fewer than 50 examples.

3. The fitter creates a deterministic, group-disjoint, approximately 80/20 train/validation split inside the dedicated calibration set. Related examples with the same optional `groupId` stay together; the same temperature is fit on train only and eligibility metrics are calculated on validation only. It requires at least 50 examples per class overall, at least 40 training examples/class and 10 validation examples/class for the standard 50/class case. Inspect validation NLL, Brier score, ECE and per-class metrics. Keep the final evaluation dataset untouched. A candidate is review-eligible only if held-out calibration NLL improves by at least 1e-4, Brier delta is <=0.01 and ECE delta <=0.03; it is still never auto-promoted.
4. For an explicit local opt-in, restart the server with `KURISU_NLI_CALIBRATION_FILE=/absolute/path/to/nli-calibration.json`. The service verifies schema, dataset provenance, class balance, temperature range, exact pinned model ID/revision and unpromoted candidate status. A mismatch keeps the service unready/fail-closed; it never guesses or silently applies a calibration for another model.
5. Runtime quotes persist calibration method, dataset hash, sample count and temperature. Restore rejects altered or inconsistent calibration provenance. The enclosing claim's `calibratedProbability` remains `null`: a temperature-scaled NLI class score is not the probability that a real-world claim is true.

## Current status / limitations

The calibration algorithm, artifact contract and mocked integration tests are implemented. The actual pretrained model has not been run in the current sandbox because package/model registry DNS is unavailable. Therefore no real calibration artifact, domain-level metric improvement, or inference latency claim is included. Model weights are not bundled. Thresholds remain conservative configuration values and must be reviewed separately against an untouched, domain-relevant holdout before any promotion policy changes.
