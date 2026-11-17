# NK1 Neural Prosthesis (OmeStro #28)

This optional sidecar adds real bottleneck residual branches to selected decoder
layers of a local Hugging Face Transformers causal language model. It is not a
prompt wrapper, a second cognitive runtime, or a replacement for the existing
llama.cpp backend.

## Runtime boundaries

- The host model's parameters are never registered in the adapter bank and are
  never optimized by the trainer. Only small residual branches receive gradients.
- Each branch starts as an exact identity because its up projection is zero-initialized.
  An untrained adapter therefore leaves base-model output unchanged.
- Each branch is bounded to at most 25% of the per-token hidden-state norm.
  Bottleneck width is capped at 512 and one adapter can target at most 8 layers.
- Adapter selection uses a request-local context. The inference server serializes
  calls to the shared model and clears the selected adapter after each request.
- Adapter files contain safetensors tensors plus a strict JSON manifest. No pickle,
  executable Python, optimizer state, or training examples are exported.
- The schema-v2 manifest binds the adapter to model ID, host-pinned model revision,
  model config digest, layer path, layer indexes, hidden width, weight-file digest
  and (when trained by the bundled trainer) dataset fingerprint, example count,
  epochs and seed. Loading fails closed on any mismatch or digest error.
- Newly loaded adapters remain in quarantine. A request can use an adapter only when
  the host allowlists its exact manifest SHA-256. There is no API to approve, train,
  promote, or execute arbitrary adapter artifacts.
- The service binds to 127.0.0.1 by default and refuses non-loopback bind addresses.
  Host headers outside localhost/127.0.0.1 are rejected. An optional server-side
  bearer token protects inference and detailed status; health remains a minimal
  liveness response. Model downloads are disabled with local_files_only=True.
- The runtime context window is capped by both the host environment setting and the
  detected model architecture limit (when exposed by its config). Prompt truncation
  keeps the newest turns, and generation reserves context space for output tokens.
  The sidecar returns token usage and reports finish_reason=length when the output
  budget is reached.
- The Python environment is isolated from the Node runtime. It adds no PyTorch or
  Transformers dependency to NK1's production npm dependency graph.

## 1. Prepare a local Transformers model

Install the optional dependencies in an isolated Python 3.11 environment:

    python3.11 -m venv .venv-neural-prosthesis
    source .venv-neural-prosthesis/bin/activate
    python -m pip install --upgrade pip
    python -m pip install -r research/neural-prosthesis/requirements.txt

Place a model already downloaded on disk. The service and trainer do not download
weights. Set a stable model ID and immutable revision/commit identifier; adapter
artifacts cannot be loaded with the fallback unversioned-local revision.

Set the package directory on Python's import path before using its module commands:

    export PYTHONPATH="$PWD/research/neural-prosthesis"

    export NEURO_NP_MODEL_PATH=/models/your-causal-lm
    export NEURO_NP_MODEL_ID=your-org/your-model
    export NEURO_NP_MODEL_REVISION=your-immutable-model-commit
    export NEURO_NP_DEVICE=auto
    export NEURO_NP_PORT=8091

Default decoder-layer discovery tries model.layers, transformer.h, gpt_neox.layers,
model.decoder.layers, decoder.layers, then layers. For another architecture, set
the exact module-container path explicitly:

    export NEURO_NP_LAYER_PATH=model.layers

The initial sidecar expects a standard local Transformers causal-LM checkpoint.
GGUF files and the llama.cpp runtime are not patched or converted by this feature.
The existing llama.cpp, Kobold and Gemini providers remain independent fallbacks.

## 2. Prepare a sanitized training set

Use JSON Lines with one supervised pair per line. For example:

    {"prompt":"Explain why evidence provenance matters.","completion":"Provenance records where a claim came from and which checks support it."}
    {"prompt":"Give a cautious answer when evidence is incomplete.","completion":"I do not have enough evidence to state that as a fact. I can identify what remains unknown."}

Only use data you have permission to use. Remove secrets, credentials, personal
identifiers and raw private conversations before building a dataset. Keep separate,
immutable files for training, validation and holdout. Do not train on the holdout file.

## 3. Train a candidate adapter

Choose layer indexes that exist in the exact model:

    python -m neural_prosthesis.train \
      --base-model-path "$NEURO_NP_MODEL_PATH" \
      --base-model-id "$NEURO_NP_MODEL_ID" \
      --base-model-revision "$NEURO_NP_MODEL_REVISION" \
      --train-jsonl ./data/train.jsonl \
      --output-dir ./artifacts/kurisu-reasoning-v1 \
      --adapter-id kurisu-reasoning-v1 \
      --layers 3,7,11 \
      --bottleneck-size 64 \
      --epochs 2 \
      --learning-rate 0.0002 \
      --max-length 1024

The command freezes every base-model parameter, optimizes only residual modules,
clips their gradient norm, and saves a candidate artifact. It refuses an existing
output directory. The training report contains sample count, dataset SHA-256 and
epoch losses, not the example text. The schema-v2 manifest binds that fingerprint
and the example count, epochs and seed to the adapter weights.

## 4. Compare baseline and candidate on a disjoint holdout

    python -m neural_prosthesis.evaluate \
      --base-model-path "$NEURO_NP_MODEL_PATH" \
      --base-model-id "$NEURO_NP_MODEL_ID" \
      --base-model-revision "$NEURO_NP_MODEL_REVISION" \
      --adapter-dir ./artifacts/kurisu-reasoning-v1 \
      --dataset-jsonl ./data/holdout.jsonl \
      --split holdout \
      --output ./artifacts/kurisu-reasoning-holdout.json

The evaluator performs paired baseline/candidate completion-token loss measurements
on the same examples and computes a deterministic paired-bootstrap 95% interval
for the mean loss delta. It rejects exact reuse of the training file using the
fingerprint embedded in the schema-v2 manifest. Review eligibility requires a
holdout split, bound training provenance, at least five pairs, lower mean loss and
an upper confidence bound below zero. Exact-file separation cannot detect partial
example overlap, so keep the datasets disjoint by construction. The report records
independently_verified=false and promotion_allowed=false; this is not an independent
attestation and does not activate the adapter.

Loss is a training diagnostic, not proof of better factuality, reasoning, user value,
or safety. Run NK1's separate task-quality, multilingual, safety and regression
evaluations before considering activation.

## 5. Host-approve and start the sidecar

Copy the 64-character manifest_sha256 from the candidate's manifest.json into the
host-owned allowlist. Load only artifacts that have passed the review process:

    export NEURO_NP_ADAPTER_DIRS_JSON='["/absolute/path/to/artifacts/kurisu-reasoning-v1"]'
    export NEURO_NP_ALLOWED_MANIFESTS_JSON='["<reviewed-manifest-sha256>"]'
    export NEURO_NP_DEFAULT_ADAPTER=kurisu-reasoning-v1
    export NEURO_NP_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
    python -m neural_prosthesis.service

The service refuses to use an adapter whose manifest digest is absent from the
host allowlist. A quarantined adapter remains loaded for diagnostics only; it cannot
be selected by a request.

Configure NK1 before starting its Node server:

    export NEURO_NP_URL=http://127.0.0.1:8091/v1
    export NEURO_NP_MODEL="$NEURO_NP_MODEL_ID"
    export NEURO_NP_ADAPTER_ID=kurisu-reasoning-v1
    export NEURO_NP_API_TOKEN="<same-sidecar-token>"
    export NEURO_NP_PREFER=1

By default the sidecar is a separately managed local process, as shown above.
For an optional single-command lifecycle, set the Python interpreter to the
environment where the research requirements are installed and enable managed
startup before launching NK1:

    export NEURO_NP_PYTHON="$PWD/.venv-neural-prosthesis/bin/python"
    export NEURO_NP_AUTOSTART=1
    export NEURO_NP_AUTOSTART_TIMEOUT_MS=180000

NK1 then starts `python -m neural_prosthesis.service` from the repository root,
adds the research package to `PYTHONPATH`, waits for a loopback health-check and
stops only the child process it created during graceful shutdown. If a healthy
sidecar is already running, NK1 reuses it and does not claim ownership. Startup
failure is non-fatal: llama.cpp/Kobold/Gemini remain available as fallbacks. The
autostart flag is disabled by default and never downloads a model or installs
Python packages. `NEURO_NP_AUTOSTART_TIMEOUT_MS` is bounded to 1–600 seconds.

NK1 registers the optional neural-prosthesis profile with P40 Model Ecology.
The new profile starts with neutral quality/reliability priors rather than assuming an
unmeasured quality advantage. Set NEURO_NP_PREFER=1 only when the host explicitly wants
to prefer this configured local backend for an experiment; otherwise P40 uses its normal
measured model-ecology choice. If the sidecar is unavailable, the request fails, or the
adapter is quarantined, the request continues to the normal local/cloud fallbacks.
Nothing changes the llama.cpp model files.

When the sidecar returns consistent OpenAI-style token counters, NK1 carries the
validated `usage` object and `finishReason` through `RuntimeStep.language`.
The read-only `GET /api/organism/neural-prosthesis` diagnostic also retains only
the last sidecar token counters, finish reason and completion timestamp; prompt and
completion text are never copied into these diagnostics. Malformed or internally
inconsistent usage counters are ignored without rejecting the text response.

Read-only liveness at GET /health and GET /api/health is intentionally minimal.
The detailed status reports the effective max_context_tokens limit and the
sidecar supervisor's enabled/managed/ready state; token usage is returned on each
completion so the host can observe prompt/output budgets.
Detailed GET /neural-prosthesis/status and inference POST requests require the same
optional 32–512 character printable ASCII bearer token when NEURO_NP_API_TOKEN is set.
Host headers outside localhost/127.0.0.1 are rejected even though the service binds
to loopback. Keep the token only in server-side environment configuration.
NK1 exposes the configured backend projection at
GET /api/organism/neural-prosthesis.

## 6. Tests

From the repository root:

    npm --prefix runtime/neuro-kurisu run typecheck
    npm --prefix runtime/neuro-kurisu run test:neural-prosthesis
    npm --prefix runtime/neuro-kurisu run test:p40:model-ecology
    python -m unittest discover -s research/neural-prosthesis/tests -v

The Python regression suite uses a tiny in-memory Transformer-shaped fixture; it
does not download a model. The optional GitHub Actions workflow repeats the Node
contract/typecheck gates and Python CPU residual/artifact tests.

## Known compatibility boundary

This first implementation supports local Transformers causal-LM models whose
decoder layers expose tensor, tuple or list outputs with hidden states in position
zero. Models with a different layer layout need an explicit NEURO_NP_LAYER_PATH;
models with a different layer-output contract are rejected instead of patched
heuristically. Quantized GGUF/llama.cpp execution is deliberately outside this
backend and continues to use the existing provider.

The current sidecar loads non-quantized Transformers weights and uses FP32 on CPU,
or BF16/FP16 on supported GPU devices. Bitsandbytes 4-bit/8-bit, GPTQ, AWQ, GGUF,
and llama.cpp adapter injection are not enabled by this implementation and are not
claimed as compatible. Base-model quantization support needs its own layer-output,
dtype, memory and quality regression gate before it can be enabled.


## OmeStro #24 — Layer Force activation steering

Layer Force is an optional activation-steering controller layered into this same
sidecar. Unlike the learned residual bottlenecks above, it adds an operator-supplied
direction vector to selected decoder-layer hidden states at inference time. It
does not train or mutate base-model weights.

The controller is **disabled by default**. It loads no profile unless the operator
sets a local profile path and an allowlist containing the exact SHA-256 of the
profile's raw file bytes. The optional default profile ID explicitly opts that
profile into inference. Prompt text, client requests and P40 routing cannot enable
or replace a profile.

### Profile schema v1

Each profile is strict JSON plain data with exactly these top-level keys:

    {
      "schema_version": 1,
      "profile_id": "kurisu-reasoning-v1",
      "model": {
        "model_id": "your-org/your-model",
        "model_revision": "immutable-40-character-model-commit",
        "config_sha256": "64-character-model-config-sha256",
        "layer_path": "model.layers",
        "hidden_size": 4096
      },
      "layers": [
        {
          "index": 12,
          "direction": ["one finite number per hidden dimension"],
          "strength": 1.0
        }
      ],
      "max_delta_ratio": 0.05
    }

Replace the illustrative direction with exactly `hidden_size` finite numeric
values and use one to eight unique in-range decoder layer indexes. A direction
must be non-zero. Each per-layer strength must be finite and in [-1, 1].
`max_delta_ratio` must be positive and no greater than 0.10; 0.05 is the
recommended starting point, not a measured optimum. The model binding must match
the loaded model ID, immutable revision, config digest, layer path and width
exactly. Duplicate JSON keys, unknown fields, malformed numbers, symlinks and
model mismatches fail closed.

### Explicit operator opt-in

After preparing the profile offline, compute the SHA-256 of the exact file:

    sha256sum ./profiles/kurisu-reasoning-v1.json

Configure the local sidecar before startup:

    export NEURO_NP_LAYER_FORCE_PROFILE_PATHS_JSON='["/absolute/path/kurisu-reasoning-v1.json"]'
    export NEURO_NP_ALLOWED_LAYER_FORCE_PROFILES_JSON='["<raw-file-sha256>"]'
    export NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE=kurisu-reasoning-v1

To disable Layer Force, unset the default profile and set the profile paths to
an empty JSON array. With no configured profile paths, the runtime adds no
Layer Force hooks. A default profile without a configured local profile is
rejected. Profiles are never uploaded through an HTTP endpoint.

The controller uses request-local activation state, preserves auxiliary tuple
and list outputs, and caps each per-token steering delta at 10% of that token's
hidden-state norm. Detailed diagnostics expose profile IDs, raw-file digests,
selected layer indexes and aggregate hook/token counts only; they never expose
direction vectors, hidden states, prompts or completions.

Profile authoring/calibration, independent task-quality evaluation, model-specific
latency and memory measurement, and target-device soak remain research work.
No real-model improvement or production readiness is claimed by this feature.
