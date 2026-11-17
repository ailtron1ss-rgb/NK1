# P25 — Adaptive Synaptic Matrix

## Purpose

The matrix is an adapter-specialization layer, not another model-provider selector.
`P40ModelEcologyEngine` remains responsible for choosing a backend/provider. The
Adaptive Synaptic Matrix decides whether a validated task adapter may be applied
to the already configured base-model identity.

## Runtime contract

- `OrganismRuntime` owns the matrix and persists registry metadata to
  `<stateFile>.synaptic-matrix.json`.
- Both the user-response path (`language`) and cognitive-proposal path
  (`reasoning`) pass through the same selector.
- The base `LanguageInvoker` remains the authoritative fallback.
- A host must supply all three deployment facts before an adapter can be used:
  `synapticBaseModelId`, `synapticBaseModelRevisionSha256`, and
  `synapticAdapterInvoker`.
- Adapter activation additionally requires a host-owned
  `synapticAdapterManifestVerifier`. Without it, candidates stay inactive and
  restored active entries are quarantined.
- The host adapter invoker receives a single validated profile and a language
  request. It alone owns loading/applying the actual LoRA/QLoRA weights.
- Each specialist call has a configurable hard deadline (default 15 seconds,
  bounded to 100 ms–120 seconds) and receives an abort signal. A timeout, abort,
  malformed response, or failed execution receipt returns to the base invoker.
- Every adapter response must attest `modelId`, `modelRevisionSha256`, and
  `appliedAdapterSha256`. The runtime compares these with the configured base
  identity and registered artifact digest; a mismatch is treated as an execution
  failure.
- Every adapter response must attest `modelId`, `modelRevisionSha256`, and
  `appliedAdapterSha256`. The runtime compares these to the configured base
  identity and registered artifact digest; a mismatch is treated as an execution
  failure and the unchanged base invoker is called.

## Candidate and activation gates

A candidate records its artifact reference and SHA-256, format/rank, exact base
model identity/revision, task capabilities, competence scores, conflict group,
resource/context limits, maximum uncertainty, training dataset reference, and owner.

Activation requires a signed offline validation manifest. The matrix checks:
- the manifest matches the registered candidate and its artifact digest;
- training and holdout dataset references are distinct;
- at least five paired seeds are recorded;
- the candidate score beats the base-model score and the lower 95% delta is
  positive;
- there are no reported guardrail regressions;
- the deployment-provided verifier accepts the canonical manifest payload.

The verifier is a trust boundary: it must validate the signature against a key
whose owner is authorized to attest offline adapter evaluation. A callback that
always returns true is not a production verifier.

## Routing and fallback

Only one adapter is selected per request. Eligibility requires an exact match
for base model ID and revision, task support, request context limit, minimum
confidence, maximum uncertainty, maximum resource risk, a validated active
state, and an available adapter executor. Near-equal profiles in the same conflict group are treated
as ambiguous and route to the base model. The router does not stack adapters.

Two consecutive executor failures apply an escalating bounded cooldown. Six
consecutive failures quarantine the profile. Quarantine cannot be cleared by
replaying the same holdout report: an operator must submit a newly signed report
with a new report digest and pass the validation gates again. A successful adapter
call resets the consecutive-failure counter. An adapter exception or malformed
adapter response is recorded and the unchanged base invoker is called. An aborted
request is not retried after cancellation.

The real-runtime integration suite covers base fallback, signed activation,
specialized execution, wrong-base and wrong-weight attestation rejection,
adapter-error recovery, persistence across restart, explicit disablement, and
operator-authorized reactivation.

Online response completion is recorded only as executor availability/latency;
it does not update task competence. Competence changes require a new offline
validation manifest, so routing success cannot silently train or promote a
specialization.

## Non-goals in this increment

- No training, fine-tuning, LoRA/QLoRA generation, or weight files are included.
- No adapter is pre-activated.
- No changes are made to P40 provider selection or the canonical neural learner.
- No claims are made about measured quality improvement until independent
  holdout reports and deployed adapter artifacts exist.
