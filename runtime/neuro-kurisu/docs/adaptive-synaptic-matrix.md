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
- The host adapter invoker receives a validated P25 candidate, the language
  request and the complete bounded P25 routing context. It never directly loads
  a model artifact; it delegates actual inference to the canonical Neuro-Plastic
  adapter registry and inference adapter (#23/#936).
- Each specialist call has a configurable response deadline (default 15 seconds,
  bounded to 100 ms–120 seconds) and receives an abort signal. The runtime stops
  waiting and falls back at the deadline; the host executor must honor the signal
  to stop underlying compute (the runtime cannot forcibly terminate an arbitrary
  callback). Caller cancellation is propagated without retrying the base model
  and is not counted as an adapter reliability failure. Adapter timeout or other
  execution failure does count as a failure and returns to the base invoker.
- Every applied-adapter response must attest `modelId`,
  `modelRevisionSha256`, and `appliedAdapterSha256`. A canonical base fallback
  explicitly returns `adapterApplied: false`, a null adapter digest and a bounded
  fallback reason. A P25 policy/registry mismatch is a safe base fallback, not an
  adapter execution failure; P25 does not call the base invoker a second time.

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
specialized execution, Unicode-safe context gating, caller cancellation without
failure-score penalties, timeout/abort, wrong-base and wrong-weight attestation
rejection, adapter-error recovery, persistence across restart, explicit disablement,
and operator-authorized reactivation.

Online response completion is recorded only as executor availability/latency;
it does not update task competence. Competence changes require a new offline
validation manifest, so routing success cannot silently train or promote a
specialization.

## Persistent single-use report ledger and rollback anchor

Every accepted validation report digest is recorded in a per-adapter ordered ledger. The ledger has a hard limit of 64 reports; entries are never evicted. A digest cannot be reused after activation, disable, cooldown recovery, quarantine recovery or process restart. Once the ledger reaches capacity, additional activation fails closed and requires a separately reviewed migration rather than dropping old evidence.

The local snapshot stores the ordered report digests, a monotonic count and a SHA-256 sequence commitment. This detects truncation, reordering, duplicate entries and accidental corruption. **It is not an authentication mechanism**: an attacker able to rewrite the complete local snapshot can recompute an unkeyed SHA-256 commitment. Legacy snapshots that contain activation evidence but lack a complete history are therefore restored quarantined and marked saturated.

For deployments that require protection against full-snapshot rollback, inject \`synapticReplayAnchorStore\` into \`OrganismRuntime\`. Its contract is:

- \`read(adapterId)\` returns the authoritative \`acceptedReportCount\` and \`acceptedReportHistorySha256\`, or \`null\` before the first accepted report;
- \`compareAndSwap(adapterId, expected, next)\` atomically accepts only the exact prior state and a single monotonic increment, recording the latest report digest;
- the implementation must live in a separately protected durable service (for example a transactional database with atomic compare-and-swap and backup/restore controls), not in another JSON file on the same writable disk.

Set \`synapticReplayAnchorRequired: true\` to make the external anchor mandatory for activation. If it is missing, unavailable, stale, rolled back or inconsistent with the local ledger, the adapter is quarantined and the unchanged base model remains authoritative. When the option is false and no store is injected, only local anti-replay is provided; full-snapshot rollback resistance is **not** claimed. The default is deliberately non-strict for existing installations, so production hosts must opt in explicitly.

The host adapter must make the CAS durable before returning success. If the local snapshot write then fails, the accepted report remains consumed in the external anchor; the next restore detects the mismatch and fails closed. A failed CAS never leaves an in-memory adapter active.

## Non-goals in this increment

- No training, fine-tuning, LoRA/QLoRA generation, or weight files are included.
- No adapter is pre-activated.
- No changes are made to P40 provider selection or the canonical neural learner.
- No claims are made about measured quality improvement until independent
  holdout reports and deployed adapter artifacts exist.


## Canonical Neuro-Plastic registry integration (#23 → #25)

P25 is a policy/routing layer only. It may nominate an adapter for a task, but its
own persisted `active` state is **not** authority to apply weights. The host
executor must resolve the same adapter ID from the canonical #936
`NeuroPlasticAdapterRegistry`, then pass it through
`NeuroPlasticInferenceAdapter` with `expectedAdapterId`. The canonical registry
rechecks its own current active status, independent evaluation receipt, signed
human approval, artifact integrity, exact backend, base model alias and
fingerprint before applying anything.

P25 and the canonical registry must agree on all of the following:

- exact adapter ID;
- base model ID and immutable SHA-256 fingerprint;
- artifact weights SHA-256;
- LoRA/QLoRA method;
- backend (`llama.cpp`) and base-model served alias.

If the P25 candidate is absent from #936, the registry has disabled/quarantined
it, another adapter wins canonical selection, or any binding differs, the host
returns the unchanged base-model result. It reports `adapterApplied: false`,
`appliedAdapterSha256: null` and a bounded `adapterFallbackReason`. P25 records
a canonical base fallback but does not penalize or disable a healthy candidate
and does not invoke a second base request. If the canonical artifact itself fails
integrity/inference, #936 owns the disable/rollback and base retry.

### Explicit host opt-in

The following settings are required before P25 can register a live adapter
executor. Without them the runtime remains on the base path:

    NEURO_PLASTIC_MODEL_ALIASES_ENABLED=1
    NEURO_PLASTIC_BASE_MODEL_ID=<immutable base model identity>
    NEURO_PLASTIC_BASE_MODEL_SHA256=<64 lowercase hex characters>
    NEURO_PLASTIC_P25_POLICY_SECRET=<at least 32 secret characters>
    NEURO_PLASTIC_P25_POLICY_KEY_ID=<host-registered signer key id>

The P25 policy manifest signature is an HMAC-SHA256 over the exact canonical
P25 manifest payload, using the configured host secret and key ID. The secret
must remain in server-side environment configuration; it is never returned by
runtime diagnostics or accepted from an inference request. The canonical #936
activation still requires its separate signed evaluation receipt, operator
approval, base-model binding and artifact verification; the P25 HMAC does not
replace or bypass those gates.

P25's own adapter candidate ID is intentionally pinned into canonical selection:
the canonical registry may not silently substitute a different active adapter
even when that other adapter is eligible for the same domain. This gives P25 a
single route-decision record and #936 a single canonical artifact authority.
