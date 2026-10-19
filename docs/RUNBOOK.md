# Runbook

## Install

```bash
npm run install:all
```

The installer runs `npm ci --no-audit --no-fund` separately in `app/` and `runtime/neuro-kurisu/`, validates each committed lockfile against the workspace manifest, and never regenerates lockfiles. The runtime lockfile currently has zero external packages; the app lockfile pins the compiler and UI/build dependencies. If npm reports `EAI_AGAIN` or `ENOTFOUND`, repair registry DNS/network access and rerun `npm run install:all`; the installer fails fast rather than claiming success.

## Development

```bash
npm run dev
```

Services:
- Runtime: `127.0.0.1:3310`
- Research bridge: `127.0.0.1:8765`
- Vite UI: `127.0.0.1:8080`

## Production-style local start

```bash
npm --prefix app run build
npm run start
```

Gateway: `127.0.0.1:8080`.

## Quick audit

```bash
npm run audit:quick
```

This performs syntax/asset/import/ownership/inventory checks without running the long historical benchmark matrix.

## Full release audit

Use the runtime release matrix under `runtime/neuro-kurisu/package.json` and the research matrix in `research/nomega-pass20`. Long-running research benchmarks are not part of the interactive startup path.

## Release operations (v20 final)

Use `npm run doctor` before starting. `npm run backup` creates a timestamped state backup; `npm run restore` restores the latest backup. `npm run migrate` applies the app migration set when `DATABASE_URL` is configured and runs the runtime persistence migration check. `npm run sbom` and `npm run freeze` refresh release evidence. `npm run release:verify` checks final-tree constraints. `node tools/super-health-guard.mjs` checks the live runtime against the operator thresholds in `contracts/OPERATIONAL_ALERT_THRESHOLDS.json`.


## UI regression gates (WorkPass 14)

Run source-only UI script regressions with `npm run test:app:scripts` (currently 202 tests). Run `npm run audit:workpass14` for this pass's aggregate gates.

For a real browser smoke, first install app dependencies with `npm run install:all`, start the UI with `npm run dev`, then run `node app/scripts/browser-smoke.mjs http://127.0.0.1:8080/ /workspace/screenshots/neuro-kurisu.png`. A baseline can be supplied with `--baseline /workspace/screenshots/known-good.json`; a clean-but-divergent baseline exits 3, current page/console errors exit 2, and navigation/HTTP failure exits 1. The smoke runner requires the Playwright package and browser binaries; unit tests of the comparator do not count as a real browser run.

## Evidence and outcome integrity (WorkPass 15)

Before evaluating a change to action/outcome behavior, run `npm run test:runtime-evidence-bus` and `npm run test:outcome-verification-hardening`; then run `npm run audit:workpass15` for the combined runtime, reafference, memory, imports, UI/API and asset gates. RuntimeEvidenceBus is a bounded diagnostic/evidence projection, not the durable operational journal. External outcomes count as verified only with an explicit supported basis and non-empty independent observation receipt; verifier errors are treated as unverified. Do not infer provider-level exactly-once semantics from local idempotency or unit tests.

Server smoke has a hard startup deadline and bounded per-probe timeout; its helper regression can be run with `npm run test:server-smoke-poll`. A failed startup must produce bounded diagnostics instead of waiting through repeated multi-second network timeouts.


## External research transport (WorkPass 18)

The research adapter is fail-closed and disabled by default. To use it, explicitly configure:

- `NEURO_PROJECT_NETWORK_ENABLED=1`
- `NEURO_PROJECT_NETWORK_ALLOWLIST=host1.example,host2.example`
- `NEURO_PROJECT_RESEARCH_URL` and `NEURO_PROJECT_RESEARCH_URL_2` for independent source URLs
- `NEURO_PROJECT_RESEARCH_QUERY` with at least three distinct topic terms, or pass `query` to the project tool

Only standard-port HTTPS is allowed. Each host and redirect is checked against the allowlist and its full DNS answer; the request is pinned to a validated public address while TLS validation remains bound to the hostname. Redirects are capped, and responses are bounded by time and size and restricted to textual content types. Pages below the topical relevance threshold are not ingested as evidence. Query identity is included in the firewall claim key.

The topical relevance gate uses lexical term coverage. It reduces irrelevant-page promotion risk but is not a natural-language entailment verifier. Do not treat it as proof that a web page supports a factual claim. External DNS and provider execution must be tested in the target environment; a source-only regression suite does not certify live network access.

Run `npm run test:external-project-research-transport` for the focused test suite and `npm run audit:workpass18` for the aggregate workpass. Outbound research remains off unless the environment variables are explicitly configured.


## WorkPass 22 — optional local NLI service

NLI is opt-in. When `KURISU_RESEARCH_NLI_ENDPOINT` is absent or invalid, the runtime keeps its text-anchor/unknown behavior. It does not silently use a cloud model.

```bash
python3 -m pip install -r research/requirements-nli.txt
python3 tools/research_nli_server.py
# in the runtime process environment:
export KURISU_RESEARCH_NLI_ENDPOINT=http://127.0.0.1:8798/v1/nli
```

The service loads `cross-encoder/nli-deberta-v3-xsmall` before binding its port; first setup downloads model files, so it requires access to the Hugging Face model host unless weights are already cached. It listens on loopback by default, bounds request sizes and input text, does not log request content, and never labels the softmax scores as calibrated probabilities. Keep it loopback-only unless `KURISU_RESEARCH_NLI_TOKEN` is set on the service and runtime and traffic is protected with HTTPS. Configure `KURISU_RESEARCH_NLI_TIMEOUT_MS` (default 4500), `KURISU_RESEARCH_NLI_MIN_SCORE` (default 0.78) and `KURISU_RESEARCH_NLI_MIN_MARGIN` (default 0.18) as operational thresholds—not calibration. `npm run test:research-nli` tests only a mocked backend and mocked model stack. Before production use, run the real model against a labelled, adversarial holdout and measure calibration/error by language and claim type.


## WorkPass 23 — pinned/batched NLI and evaluation workflow

- Batch fallback is allowed only for 404/405 from older single-only endpoints. A 503/timeout/malformed response is not retried as a fan-out.
- Memory retrieval evaluation blocks promotion on exact or high-overlap near-duplicate train/holdout queries; this is still only an integrity guard, not evidence of memory uplift.

The NLI service defaults to the immutable upstream revision `a150876415327c80daeff35ca6f68f5ed8cf5c24`; `KURISU_NLI_REVISION` must be a 40-character lowercase commit SHA. Model loading uses `use_safetensors=True` and `trust_remote_code=False`. A custom `KURISU_NLI_MODEL` must be paired with its own reviewed immutable revision. The service accepts `/v1/nli` and `/v1/nli/batch`; a batch has 1–24 pair rows. Concurrency is bounded with `KURISU_NLI_MAX_IN_FLIGHT` (1–8) and CPU threads with `KURISU_NLI_TORCH_THREADS` (1–8); excess connections are refused with HTTP 503/`Retry-After`.

To evaluate a fixed labelled set after the model is actually installed:

```bash
python3 tools/evaluate_research_nli.py /path/to/holdout.jsonl --output /path/to/nli-evaluation.json
```

Use a disjoint holdout that was not used for threshold selection, ensure every label class is represented, retain the printed dataset hash/model revision, and examine class-wise false-support and false-refute behavior. Output contains metrics and provenance but not premise/hypothesis text; output files are atomically written with mode 0600. A remote HTTPS endpoint requires explicit `--allow-remote`; prefer loopback to avoid disclosing research text. Model softmax scores are not calibrated probabilities.


## Optional NLI health and warmup (WorkPass 24)

Default startup remains strict and does not open the port until the pinned model loads:

```bash
python3 tools/research_nli_server.py
```

If a process supervisor requires health endpoints before weights are available, opt in to lazy warmup:

```bash
python3 tools/research_nli_server.py --lazy-model-load
curl -i http://127.0.0.1:8798/livez
curl -i http://127.0.0.1:8798/readyz
```

`/livez` and `/healthz` confirm only that the process can answer HTTP. `/readyz` returns 503 until the model has loaded and includes a sanitized error code plus a bounded retry delay. Repeated requests during a load-failure cooldown do not reattempt artifact downloads. NLI remains opt-in and fail-closed; do not mark semantic evidence as verified solely because the service process is live.


### Local NLI calibration candidate (optional)

Follow `docs/RESEARCH_NLI_CALIBRATION.md`. Fit against a designated calibration split only, supply `--dataset-source` and `--labeling-protocol`, retain the emitted SHA-256 privately, and leave the final evaluation holdout untouched. To opt in, set `KURISU_NLI_CALIBRATION_FILE` to the candidate artifact before starting the local NLI service; model ID/revision mismatch makes startup fail-closed. Do not interpret the class score as a claim-truth probability or mark the system calibrated on real data until the pinned model has been run and independent holdout metrics have been reviewed.
