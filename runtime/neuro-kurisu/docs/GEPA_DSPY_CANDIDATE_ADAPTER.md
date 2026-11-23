# NK1 GEPA/DSPy reflective candidate sidecar

## Purpose and boundary

This is a narrow candidate-generation adapter inspired by the trace/diagnosis → candidate → independent evaluation lifecycle used by Hermes self-evolution with DSPy/GEPA. It is not the upstream GEPA HTTP API and does not install or run a second agent. It defines an NK1-specific JSON contract for an operator-managed sidecar.

The adapter is disabled by default. Without explicit configuration the application continues using the existing local llama.cpp skill generator. When enabled, it can return a changed candidate payload only. P23 still owns the verified proposal, exact-payload independent evaluation, signed shadow evidence, review/approval, promotion and rollback. Optimizer-provided score, confidence, pass/fail or activation fields are ignored.

Upstream design reference: https://github.com/NousResearch/hermes-agent-self-evolution. This integration reuses the separation between candidate generation and evaluation; it does not import the repository's runtime or its optimizer stack. Check component-level licences before deploying an optional sidecar.

## Configuration

Set secrets only in the process environment/secret manager:

~~~dotenv
NK1_GEPA_ENABLED=1
NK1_GEPA_ENDPOINT=https://your-controlled-sidecar.example/revise
NK1_GEPA_API_KEY=<secret>
NK1_GEPA_TIMEOUT_MS=120000
NK1_GEPA_MAX_REQUEST_BYTES=524288
NK1_GEPA_MAX_RESPONSE_BYTES=524288
~~~

The endpoint must use HTTPS, or HTTP on loopback for local development. Credentials are sent only to the configured endpoint; redirects are rejected. Do not enable this on an endpoint you do not control. The environment opt-in by itself does not start autonomous training. The existing P23 compound-repair provider module must still be explicitly configured and must call the supplied generateSkillRevision callback while retaining its real proposal/evaluator pipeline.

## Adapter wire contract

The adapter sends a bounded JSON object with schemaVersion: 1, adapter name nk1-gepa-revision-proposal, and purpose candidate-payload-only. The response expected by NK1 is:

~~~json
{
  "schemaVersion": 1,
  "candidatePayload": {
    "skill": "revised payload"
  }
}
~~~

The sidecar may include its own diagnostics in the response, but NK1 discards all fields other than candidatePayload. A candidate is bounded to 256 KiB and is re-evaluated by the existing P23 independent evaluator against the exact returned payload before it can be staged.

## Holdout and evidence firewall

The request may include the source payload, dataset fingerprint, bounded validation reports, evidence-linked revision targets, and one aggregate holdout delta. It must not include raw holdout reports, holdout task IDs, trial IDs, or per-case outcomes. The adapter enforces that a holdout-generalization target contains no task/trial IDs; other target IDs must be present in the supplied validation evidence.

The aggregate holdout delta is signed: negative values indicate a regression and are valid input to the revision planner. The value is an advisory signal only. Every generated payload requires a fresh independent evaluation; the adapter cannot set promotion status. Network, schema, UTF-8, response-size, timeout or identity-boundary failures fail closed and cannot produce a candidate.

## Verification

Run:

~~~bash
npm run test:gepa-reflective-candidate-generator
npm run typecheck
~~~

The mocked contract test covers disabled-by-default behavior, HTTPS/loopback transport policy, validation-only evidence, rejection of holdout IDs, payload/response bounds, discarded optimizer scores and server callback wiring. These tests do not contact a real GEPA service and do not establish candidate quality uplift.