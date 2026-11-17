# Layer Force Activation Steering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-approved, request-scoped activation-steering controller to the existing Neural Prosthesis Transformers sidecar without changing base-model weights.

**Architecture:** A dedicated `LayerForceBank` registers bounded forward hooks on the already validated decoder layer stack. The sidecar loads only exact-model-bound JSON profiles whose SHA-256 appears in an operator-owned allowlist, then applies the selected default profile within the existing serialized generation path. Neural Prosthesis residual adapters remain a separate owner.

**Tech Stack:** Python 3.11, PyTorch, existing Transformers sidecar, safetensors dependency unchanged, Python unittest.

**Spec:** `docs/superpowers/specs/2026-11-17-layer-force-activation-steering-design.md`

**Current status (2026-11-17):** controller, sidecar integration, focused tests, CI, operator documentation and changelog are implemented in Draft PR #931, stacked on #925. Exact-head verification on `9d70ef1ba54319cea4e350eba9ba1d6fe0d1e9d5`: push and pull-request workflows both passed their Python and Node jobs; related cadence and metrics workflows also passed. No base-model weights are modified. Real-model task quality, direction calibration, latency, memory, safety and target-device soak are not measured; do not promote or release on the synthetic fixture result alone.

## Global Constraints

- Use the existing Neural Prosthesis sidecar and P40 provider boundary; do not create a second runtime or provider.
- Base model weights remain immutable; steering modifies only request-time hidden-state outputs.
- No profile is active unless the operator explicitly configures a local path, SHA-256 of the exact raw profile file in the host allowlist, and default profile ID.
- Bind profiles to exact model ID, immutable model revision, model config digest, decoder layer path and hidden width; require per-layer finite strength in [-1, 1].
- Target no more than 8 decoder layers; per-token delta ratio is capped at 0.10, default 0.05.
- Strength must be finite and in [-1, 1].
- When disabled, output must be exactly unchanged.
- Persist no prompts, hidden states, vectors or model weights in diagnostics.
- Keep the child PR stacked on #925 until that parent is merged; never merge directly to main or claim release parity.

## Review Focus

- Profile digest or model-revision mismatch: reject before attaching a profile.
- Zero, NaN, infinite, wrong-width or sparse/malformed direction values: reject without partial registration.
- Tuple/list decoder outputs: modify only the first hidden-state tensor and preserve all auxiliary values.
- Failed generation or nested request context: always reset the active profile.
- Empty/unconfigured profile list: do not modify model outputs and do not require additional environment configuration.

---

### Task 1: Layer Force controller and profile admission

**Files:**
- Create: `research/neural-prosthesis/neural_prosthesis/layer_force.py`
- Create: `research/neural-prosthesis/tests/test_layer_force.py`

**Interfaces:**
- `LayerForceBank(model, *, model_id, model_revision, layer_path)`
- `load_profile(path, approved_profile_file_sha256) -> profile_id`
- `activate(profile_id, strength=1.0)` context manager
- `snapshot() -> redacted diagnostics`
- `close() -> None`

- [ ] **Step 1: Write the failing behavioral tests** for selected-layer activation changes with a 10% token-norm ceiling, exact no-op without activation, output tuple preservation and request-context reset.
- [ ] **Step 2: Verify RED** by running `python -m unittest research.neural-prosthesis.tests.test_layer_force -v`; expected failure is the missing `neural_prosthesis.layer_force` module/API, not a fixture/setup error.
- [ ] **Step 3: Add profile-admission tests** for unapproved digest, wrong model revision, wrong hidden width, duplicate JSON keys, non-finite/zero vectors, too many layers, tampered digest and symlink paths.
- [ ] **Step 4: Implement the minimum controller** with ContextVar-scoped profile selection, selected decoder forward hooks, normalized directions and per-token delta clipping.
- [ ] **Step 5: Verify GREEN** with the same focused unittest command, then run the whole Python sidecar test suite.

### Task 2: Sidecar runtime integration

**Files:**
- Modify: `research/neural-prosthesis/neural_prosthesis/service.py`
- Modify: `research/neural-prosthesis/tests/test_service.py`

**Interfaces:**
- Environment: `NEURO_NP_LAYER_FORCE_PROFILE_PATHS_JSON` (local profile paths, maximum 16).
- Environment: `NEURO_NP_ALLOWED_LAYER_FORCE_PROFILES_JSON` (exact SHA-256 digests of raw profile files).
- Environment: `NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE` (optional profile ID; empty means disabled).
- Runtime diagnostics: `status()["layer_force"]` with enabled flag, default profile ID and redacted loaded-profile metadata.

- [ ] **Step 1: Write failing service/configuration tests** for disabled-by-default behavior, default profile admission, and rejection of an unapproved or model-mismatched profile.
- [ ] **Step 2: Verify RED** using the focused service unittest command.
- [ ] **Step 3: Wire profile loading** to `TransformersRuntime`, preserving the existing generation lock and residual adapter context; apply steering only when the operator-selected default profile is loaded and allowlisted.
- [ ] **Step 4: Add redacted diagnostics and close-time hook cleanup.**
- [ ] **Step 5: Verify GREEN** using `python -m unittest discover -s research/neural-prosthesis/tests -v`.

### Task 3: CI, operator documentation and release boundary

**Files:**
- Create: `.github/workflows/layer-force.yml`
- Modify: `research/neural-prosthesis/README.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Add a workflow** for the Layer Force branch and stacked PR base; run Python sidecar tests, runtime typecheck and Neural Prosthesis integration/P40 regressions.
- [x] **Step 2: Document profile schema and operator opt-in** with model binding, raw-file digest calculation, allowlist and disable procedure.
- [x] **Step 3: Record the implementation status** as Draft/IMPLEMENTED and explicitly leave real-model evaluation, quality, latency, memory, safety and device soak unresolved.
- [x] **Step 4: Run the full applicable Python suite and Node runtime typecheck/integration/P40 tests in exact-head CI.** Local execution is not claimed.
- [x] **Step 5: Inspect the exact diff and maintain Draft PR #931 targeting the #925 branch; verified head: `9d70ef1ba54319cea4e350eba9ba1d6fe0d1e9d5`.**

## Verification Commands

- Focused: `python -m unittest research.neural-prosthesis.tests.test_layer_force -v`
- Sidecar: `python -m unittest discover -s research/neural-prosthesis/tests -v`
- Runtime: `npm ci --prefix runtime/neuro-kurisu --ignore-scripts --no-audit --no-fund`
- Runtime typecheck: `npm --prefix runtime/neuro-kurisu run typecheck`
- Existing regression: `npm --prefix runtime/neuro-kurisu run test:neural-prosthesis && npm --prefix runtime/neuro-kurisu run test:p40:model-ecology`
