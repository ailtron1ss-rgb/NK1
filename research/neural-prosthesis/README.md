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
- The manifest binds the adapter to model ID, host-pinned model revision, model
  config digest, layer path, layer indexes, hidden width and weight-file digest.
  Loading fails closed on any mismatch or digest error.
- Newly loaded adapters remain in quarantine. A request can use an adapter only when
  the host allowlists its exact manifest SHA-256. There is no API to approve, train,
  promote, or execute arbitrary adapter artifacts.
- The service binds to 127.0.0.1 by default and refuses non-loopback bind addresses.
  Model downloads are disabled with local_files_only=True.
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
epoch losses, not the example text.

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
on the same examples. A minimum of five pairs and lower mean candidate loss only make
the artifact eligible for human review. The report explicitly records
independently_verified=false and promotion_allowed=false; this local report is not
a signed independent attestation and does not activate the adapter.

Loss is a training diagnostic, not proof of better factuality, reasoning, user value,
or safety. Run NK1's separate task-quality, multilingual, safety and regression
evaluations before considering activation.

## 5. Host-approve and start the sidecar

Copy the 64-character manifest_sha256 from the candidate's manifest.json into the
host-owned allowlist. Load only artifacts that have passed the review process:

    export NEURO_NP_ADAPTER_DIRS_JSON='["/absolute/path/to/artifacts/kurisu-reasoning-v1"]'
    export NEURO_NP_ALLOWED_MANIFESTS_JSON='["<reviewed-manifest-sha256>"]'
    export NEURO_NP_DEFAULT_ADAPTER=kurisu-reasoning-v1
    python -m neural_prosthesis.service

The service refuses to use an adapter whose manifest digest is absent from the
host allowlist. A quarantined adapter remains loaded for diagnostics only; it cannot
be selected by a request.

In another shell, configure NK1 before starting its Node server:

    export NEURO_NP_URL=http://127.0.0.1:8091/v1
    export NEURO_NP_MODEL="$NEURO_NP_MODEL_ID"
    export NEURO_NP_ADAPTER_ID=kurisu-reasoning-v1

NK1 registers the optional neural-prosthesis profile with P40 Model Ecology.
When selected, it uses the local Transformers sidecar. If the sidecar is unavailable,
the request fails, or the adapter is quarantined, the request continues to the normal
local/cloud fallbacks. Nothing changes the llama.cpp model files.

Read-only sidecar diagnostics are available at GET /health and
GET /neural-prosthesis/status. NK1 exposes the configured backend projection at
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
