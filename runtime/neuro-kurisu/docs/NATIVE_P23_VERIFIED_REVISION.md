# NK1 native P23 signed-evidence revision provider

## What this enables

NK1 can optionally source a revision proposal from a protected local dataset of signed outcomes instead of requiring an external `NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE`. This is a candidate/revision input path, not a bypass around P23 learning governance. It remains opt-in and requires the independent host-owned evaluator module described below.

The native provider validates an immutable, signed outcome dataset, checks the authenticated `VerifiedOutcomeLedger` proposal gate, binds its baseline and source-candidate payloads to the canonical versioned skill store, and revalidates those identities across asynchronous evaluation. It cannot supply trusted baseline/source evaluation reports itself.

## Environment and exclusivity

Required for the native mode:

~~~dotenv
NEURO_COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH=/absolute/protected/path/p23-verified-proposal-dataset.json
NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE=/absolute/protected/path/independent-evaluation-host-config.mjs
NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON={...}
NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON={...}
~~~

- Do not set `NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE` at the same time as the native dataset path; the server fails closed on conflicting provider configurations.
- The signed dataset is schema-versioned and binds manifest rows, Ed25519-signed outcome artifacts, baseline/source methods and gate options. Verifier public keys come from `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON`, never from the dataset.
- The dataset must be a protected regular file outside the mutable `STATE_DIR`; symlinks, unsafe write permissions, oversized/mutated files and invalid signatures are rejected.
- The trusted lifecycle must have at least one trusted shadow verifier and one authenticated promotion approver. This does not mean the native provider can promote on its own.
- Background revision remains off unless `NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON` explicitly enables and schedules it. Configuring the native provider alone does not silently start a background learning loop.

## Independent host-owned evaluator

The host evaluator module is executable policy and must be a separate, protected regular file outside `STATE_DIR` and different from the revision-provider module. It exports `createIndependentEvaluationHostConfig({ stateDirectory })` (or a default factory) returning the fixed host plan and command configuration. Required fields include:

- `commands.executor`, `commands.verifier`, and `commands.safetyScanner` — three distinct host-owned executable commands. Each command uses an absolute executable and working directory, controlled run/survival roots, exactly one `{requestFile}` argument placeholder, bounded time/output, and no shell invocation.
- `tasksForRepair(repair)` and `environmentFingerprintForRepair(repair)` — the host defines evaluation tasks and a stable environment digest.
- `baselineMethod` and `sourceCandidateMethod` — distinct method labels; the revision method comes from the experiment authority returned by `experimentAuthorityForRepair(repair)`.
- `experimentAuthorityForRepair(repair)` — in production, it must return signed/ledger-backed validation and holdout plans containing all three distinct methods.

Host-side method identities and schedules are validated before use. The executor, verifier and safety scanner must be independent commands with distinct executable and storage identities; missing authority config causes startup/evaluation to fail closed. For production, `NODE_ENV=production` requires the full host-owned experiment authority and separate baseline/source/revision methods.

## What P23 now evaluates

For the native signed-dataset path, `withIndependentCandidateEvaluation` performs fresh independent evaluations of:

1. the canonical baseline payload from the versioned store;
2. the canonical source-candidate payload tied to the signed proposal;
3. the newly generated revision payload.

Each uses a distinct method on the fixed host-owned validation and holdout plans. The native provider rechecks the signed dataset and canonical store identities across asynchronous calls, so a changed baseline, source candidate, proposal or dataset aborts the revision flow. Provider-supplied empty placeholder reports are never accepted as baseline/source evidence.

GEPA/DSPy remains an optional candidate generator only (`NK1_GEPA_ENABLED=1`). Local llama.cpp is used by default. The optimizer cannot issue signed outcomes, independent-evaluation reports or promotion authority. P23 continues to require its normal evidence and authenticated approval gates.

## Validation

Run the focused suite from `runtime/neuro-kurisu`:

~~~bash
npm run test:p23:native-hermes-revision
npm run typecheck
~~~

The integration closure additionally tests the Mem0/Hexis paths, retrieval-dataset provenance, GEPA candidate-only and real loopback HTTP contract, the native three-arm evaluator, and the authenticated server smoke. Passing these tests validates integration contracts, not real-world learning uplift. The retrieval benchmark currently continues to report `promotion: not-promoted`; a live Mem0/GEPA service was not contacted by CI.