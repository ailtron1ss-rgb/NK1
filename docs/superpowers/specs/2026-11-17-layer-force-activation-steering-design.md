# Layer Force — activation steering design

**Date:** 2026-11-17  
**OmeStro concept:** #24 — Layer Force  
**Status:** implementation design for a stacked, opt-in aspect PR  
**Parent:** PR #925 / `aspect/neural-prosthesis-transformer-residual-20261117` at `8ae6445642f52f9eef06fb1a3070682129764558`

## Intent

Give NK1 a bounded way to steer selected hidden-state layers of a local Transformers model during inference, without changing base-model weights and without pretending that prompt metadata or a chat-template flag changed activations.

The feature is an extension of the existing optional Neural Prosthesis sidecar (#28), not a second model provider or a replacement for the P40 routing policy.

## Goals

- Attach a small, independently owned forward-hook controller to the same decoder layer stack already validated by Neural Prosthesis.
- Apply an explicitly loaded, host-approved direction vector to selected layers only.
- Bound every per-token steering delta by a configured fraction of that token's current hidden-state norm (hard ceiling 10%; conservative default 5%).
- Keep steering disabled unless an operator supplies a profile path, allowlists its exact SHA-256, and selects it as the default profile.
- Bind every profile to exact model ID, immutable model revision, model-config digest, decoder-layer path and hidden width.
- Preserve tuple/list layer outputs and all non-hidden-state outputs.
- Expose aggregate diagnostic metadata only; never expose prompts, hidden states, direction vectors or weights.
- Preserve exact no-op behavior when steering is disabled.

## Non-goals

- No modification or training of base-model weights.
- No automatic direction discovery, model download, remote activation capture or provider-side activation access.
- No claim of improved reasoning, factuality, style, learning or agency without independent task-level evaluation.
- No change to the canonical NK1 memory, goals, provider-selection or governance owners.
- No default activation and no public endpoint for uploading directions.

## Safety and compatibility invariants

- A profile must be JSON plain data with the exact schema; duplicate keys, unknown fields, non-finite values, symlinks, model-binding mismatch and oversized files fail closed.
- The SHA-256 of the exact raw profile file bytes must match a host-owned allowlist; the profile carries no self-declared digest.
- The profile must match the exact model/revision/config/layer path/hidden size used by the running sidecar.
- At most eight target layers are allowed; every direction vector must have exactly the model hidden width and finite non-zero values, with a separate finite per-layer strength in [-1, 1].
- The request-level and per-layer strengths are finite and bounded to [-1, 1]; the per-token delta norm is capped at 10% of the current activation norm.
- Steering is request-scoped through a ContextVar and reset in a finally block. Shared-model generation remains serialized by the existing sidecar lock.
- Errors do not silently fall through to an unbounded or partially applied profile. Invalid profiles prevent the service from starting with that configuration; no profile configured means the base model path remains untouched.

## Approaches considered

1. **Inject steering through chat-template kwargs.** Rejected: the existing #31 bridge only forwards advisory metadata and does not prove template consumption or actual hidden-state modification.
2. **Add another learned residual adapter.** Rejected for #24: #28 already owns learned residual bottlenecks; a second adapter bank would duplicate that capability and blur the boundary between activation steering and parameter adaptation.
3. **Add a dedicated bounded activation-hook controller to #28's existing sidecar.** Selected: it operates on actual hidden-state tensors, shares the already validated layer stack and model lifecycle, does not touch base weights, and remains independent from learned residual weights.

## Architecture

- New `LayerForceBank` module owns the activation directions, request-local activation context, decoder hooks, profile validation and redacted diagnostics. Profiles use schema v1: `schema_version`, `profile_id`, exact `model` binding, `layers` entries with `index`/`direction`/`strength`, and `max_delta_ratio`.
- Existing `TransformersRuntime` reads `NEURO_NP_LAYER_FORCE_PROFILE_PATHS_JSON`, `NEURO_NP_ALLOWED_LAYER_FORCE_PROFILES_JSON`, and optional `NEURO_NP_DEFAULT_LAYER_FORCE_PROFILE`; it checks the raw-file SHA-256 allowlist and applies only the operator-selected default profile under the existing generation lock.
- The existing `NeuralProsthesisBank` continues to own residual adapters; the two controllers compose in deterministic hook-registration order, without sharing weights or profile state.
- The existing P40 provider path and llama.cpp fallback are unchanged.

## Acceptance criteria

1. An approved profile alters the selected layer's hidden state and preserves the enclosing model output structure; its digest is the SHA-256 of the raw profile file.
2. The measured per-token steering delta never exceeds the configured cap.
3. No active profile yields bit-identical output to the unsteered model in a deterministic fixture.
4. A profile from another model revision, a tampered file, an unapproved raw-file digest, an invalid vector, or a symlink path is rejected.
5. Activation context is reset after success and exception; one request cannot leak steering into the next.
6. The existing Neural Prosthesis tests and runtime checks remain green.
7. Diagnostics disclose profile IDs/digests and bounded counters only.
8. Real model quality, latency, memory and safety impact remain unmeasured until a fresh independent evaluation and target-device soak are run.

## Integration boundary

This is a child aspect branch based on PR #925. It must remain Draft until exact-head CI, code review and a compatible rebase/merge sequence are complete. It must not merge directly into `main`, bypass PR #925, or claim inclusion in the published Release ZIP.
