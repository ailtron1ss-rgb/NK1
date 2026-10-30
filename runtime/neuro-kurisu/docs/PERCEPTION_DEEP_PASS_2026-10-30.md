# NK1 — Deep World Perception Pass (2026-10-30)

## Purpose

This pass deepens the previous World Perception integration. It does not introduce a second perception engine. `OrganismCore` remains the sole owner of the canonical event PerceptionEngine and the P41 semantic perception state; `OrganismRuntime` only observes the before/after canonical snapshot and publishes the exact resulting event ID into the runtime evidence bus.

The intent is to improve the reliability of the organism's *world model*, not to imply human-level vision or consciousness.

## Implemented in this pass

### 1. One canonical runtime perception owner

- Removed the extra `PerceptionEngine` instance from `OrganismRuntime`.
- Runtime ingress captures the Core perception snapshot, calls `core.observe()` exactly once, then reads the canonical post-observation event.
- The runtime evidence event carries that same Core event ID and an explicit `owner: OrganismCore` field.
- The multimodal workspace receives a bounded textual summary of the canonical event; it does not call a second perception engine or create a duplicate event.

**Why:** duplicate owners can drift, double-count the same observation, and disagree about event order, persistence, and sensor state.

### 2. Instance-aware object identity

- P41 entities now preserve an optional stable provider track key, cross-modal track aliases, and smoothed velocity.
- Camera/source namespace is included in vision IDs, preventing identical detector IDs from unrelated cameras/backends from colliding.
- Spatial nearest-neighbour association is allowed only when a coordinate-frame ID is explicitly declared and matches the previous observation; camera backends may provide this frame metadata, otherwise geometry is stored but not used to claim track continuity.
- Without a stable provider ID or a declared common frame, the system does not invent spatial continuity.
- Cross-modal association is conservative: a new modality ID is attached only when exactly one recent same-label candidate is available. Ambiguous repeated objects remain separate.
- A primary track ID is never overwritten by a secondary modality's alias.

**Why:** “two chairs” must remain two entities; the words “chair” alone are not an object identity. Coordinates from unrelated frames cannot be compared safely.

### 3. Time-bounded multimodal evidence coverage

- P41 records the last-seen timestamp independently for each modality on each entity.
- `crossModalEvidenceCoverage01` now measures the fraction of active entities with at least two modalities observing the same track inside a bounded freshness window; per-entity last-seen timestamps prevent old sensor history from inflating current coverage.
- Old modality history does not count as current cross-modal corroboration.
- A separate `outcomeAlignment01` stores action-outcome alignment; the legacy `crossModalAgreement01` field is retained for persisted-state compatibility and is no longer used as an estimate of modality agreement or confidence spread.
- Perceptual snapshot uncertainty and verification/rest biases use observable cross-modal evidence coverage rather than unrelated modality priors.

**Why:** a camera observation from minutes ago is not fresh confirmation from the current world model.

### 4. Reported quality, service success, and empirical accuracy

P41 now separates:
- `reportedQuality01`: the quality/confidence a detector or model reports;
- `serviceSuccess01`: whether the requested modality/service operation completed;
- `reliability01`: the empirical correctness estimate;
- calibration sample count, MAE, bias, and last verified timestamp.

Detector confidence updates reported quality only. Successful acquisition updates service success only. Empirical reliability and calibration statistics change only through the explicit human-annotation/independent-verifier observation method, with a bounded evidence-ID replay guard.

The Core exposes a narrow typed method for applying these calibration observations. It requires the exact matching `outcome` receipt to exist in the Core-owned RuntimeEvidenceBus snapshot, with a permitted source and matching modality/confidence/correctness payload. A model's own confidence or a successful transport response is not a correctness label.

**Why:** camera capture success, model confidence, and semantic correctness are different facts and must not train one another circularly.

### 5. Pending perception lifecycle

- `nextPerception(at)` expires old requests before selection.
- Fulfilment is accepted only for a currently pending request before its deadline.
- A later retry gets a new generation ID, so an expired predecessor cannot shadow or consume the new request.
- Tool completion updates service-success telemetry, not semantic accuracy.

**Why:** stale requests should not be replayed as active work and successful tool invocation should not self-certify semantic truth.

### 6. Epistemic evidence semantics

- Repeating an identical claim is corroboration only when the new claim comes from a different modality.
- Repeating a claim from the same modality does not create independent corroboration.
- A claim is counted as resolved only when an explicit `supersedes` edge points to an existing claim.
- Replaying an identical claim with the same deterministic receipt ID is idempotent and does not add another graph node.

**Why:** repetition, independent support, and contradiction resolution are distinct epistemic operations.

### 7. Backward compatibility

- P41 restore merges new nested reliability fields with defaults, so older saved states lacking calibration/tracking fields remain loadable.
- Legacy entities without track metadata remain readable; they gain current modality timestamps as new observations arrive.
- No old release tag or release asset is overwritten by this pass.

## Research and design inspirations

These are architecture inspirations, not third-party runtime dependencies or claims that research model weights have been integrated:

- Next-best-view literature motivates active sensing as an information-gain-versus-cost decision rather than indiscriminate camera activation. The implementation retains the current active-perception request gate and strengthens request expiry and evidence handling.
- Recent reviews of active visual perception emphasize uncertainty reduction and selection of observations that improve downstream tasks. This pass makes cross-modal evidence freshness explicit so future next-best-sensor policies can use trustworthy coverage.
- Object-centric 3D scene-graph work motivates stable entity identity and relations that persist across observations. P41 now has provider track IDs, aliases, explicit coordinate-frame metadata, and velocity fields.
- World-model research using predicted 3D scene flow motivates keeping spatial continuity distinct from semantic labels. This pass only estimates velocity when same-frame geometry exists; it does not introduce a heavyweight learned 3D world model.
- Event-camera research motivates a future low-latency asynchronous sensing adapter. No event-camera hardware or vendor SDK is claimed as integrated here.

## Validation commands

From `runtime/neuro-kurisu` with the repository-pinned Node 24 runtime:

```bash
npm run test:world-perception
npm run test:p41:integration
npm run test:p41:perceptual-integrity-deep-pass
npm run typecheck
```

The dedicated GitHub Actions workflow runs the world normalizer, sensor integrity, semantic delta, single-owner runtime wiring, real runtime ingress, P41 semantic regression, P41 instance/calibration/epistemic regression, P41 truthfulness regression, and the canonical runtime typecheck.

## Remaining gates

- Physical Android/Termux camera, motion, proximity, light, audio and sensor soak tests.
- Real camera backend validation proving stable tracker IDs and a declared coordinate frame in actual output.
- Independent human-labelled/independent-verifier calibration dataset; no empirical accuracy claim is made before such receipts exist.
- Long-horizon tests for identity continuity, occlusion, track re-identification, camera movement, multiple cameras, and scene transitions.
- Release ZIP packaging remains governed by the repository-wide source-provenance and licence review gate. This source pass does not publish or replace a Release ZIP.
