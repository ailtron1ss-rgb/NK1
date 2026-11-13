# NK1 GEPA/DSPy candidate sidecar — P23 contract

Status: optional protocol adapter in Draft PR #863. It is not a bundled or locally installed DSPy/GEPA optimizer.

## Why this exists

Historical NK1 work from 2026-10-28 contained a GEPA candidate-generator adapter. Its request included an aggregate holdout generalization delta. That is incompatible with the stricter current P23 requirement that the optimizer must not receive holdout direction, case identifiers, per-case results, gate reasons or gate feedback.

The new adapter reconstructs that integration around the current P23 contract:
- the sidecar receives source payload, a dataset fingerprint, allowlisted validation reports and fixed validation-derived directives;
- it receives no raw holdout reports, holdout task/trial identifiers, holdout score/delta, optimizer instruction text or copied fitness feedback;
- the candidate response is untrusted and must preserve the source payload's required top-level fields;
- optimizer scores, confidence, pass/fail, fitness, traces and `promote`/activation claims are discarded;
- P23 still performs exact-payload independent evaluation, verifies authenticated outcome evidence, stages the versioned candidate, runs shadow evaluation and controls approval, promotion and rollback.

## Opt-in

Use a trusted, operator-managed sidecar endpoint. The adapter is disabled unless `NK1_GEPA_ENABLED=1`.

```dotenv
NK1_GEPA_ENABLED=1
NK1_GEPA_ENDPOINT=https://your-controlled-sidecar.example/revise
NK1_GEPA_API_KEY=<secret>
NK1_GEPA_TIMEOUT_MS=120000
NK1_GEPA_MAX_REQUEST_BYTES=524288
NK1_GEPA_MAX_RESPONSE_BYTES=524288

# Existing application-level P23 trusted provider is also required:
NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE=/absolute/path/to/trusted-p23-provider.mjs
```

Local development may use plain HTTP only on loopback (`localhost`, `127.0.0.1`, `::1`). Remote cleartext HTTP, URL credentials, query strings, fragments and redirects are rejected. Secrets stay in process environment/secret manager; never commit keys.

When the GEPA flag is enabled but the endpoint/key or trusted P23 provider module is absent, startup fails explicitly. When GEPA is disabled, the existing local llama.cpp generator remains the default. When GEPA is enabled, sidecar failures are surfaced; they do not silently switch to another optimizer.

## Request/response contract

Request schema version 1 uses `adapter: nk1-gepa-validation-only`, `purpose: candidate-payload-only`, a bounded source payload, dataset fingerprint, bounded SkillLearnBench validation reports and allowlisted revision targets. The adapter rebuilds target directives from a fixed dimension map and validates every target task/trial ID against the validation records.

No arbitrary prompt text is sent. No holdout policy fields or holdout-derived values are serialized. The sidecar receives these hard constraints:
- `holdoutResultsIncluded: false`
- `holdoutCaseIdentifiersIncluded: false`
- `activationAuthority: NK1-P23`
- `independentReevaluationRequired: true`

The response must contain `schemaVersion: 1` and `candidatePayload`. All other response fields are ignored. Payload/source/request/response budgets are bounded. The transport is timed out and aborted, and invalid UTF-8/JSON or oversized responses fail closed.

## P23 holdout firewall

The P23 revision planner now builds generator-facing targets and rationale only from validation observations. The independent candidate gate may still use holdout to veto an improvement or block safety, but its scores, signs, family feedback, reason text and case identity do not enter the revision generator's plan. A regression test compares opposite holdout outcomes against identical validation data and requires byte-identical generator-facing plans.

The GEPA adapter also rejects an attempted `holdout-generalization` target or unexpected `holdoutGeneralization` request field. This means the sidecar cannot optimize against a holdout delta, even if an older trusted provider accidentally tries to pass one.

## Verification
```bash
npm run test:p23:revision-plan-holdout-isolation
npm run test:gepa-reflective-candidate-generator
npm run typecheck
```

The adapter's tests cover disabled/default behavior, HTTPS/loopback policy, redirects, validation-only projection, task/trial provenance, no holdout fields, payload/response bounds, source-field preservation, candidate-only return, and a real local HTTP roundtrip. Tests use a local fixture sidecar; they do not measure the quality of a live GEPA optimizer or prove an uplift on independent holdout.

## What is and is not integrated

Integrated:
- NK1-specific request/response adapter;
- server composition root and explicit opt-in configuration;
- local llama.cpp fallback when GEPA is disabled;
- P23 exact-payload evaluation and activation boundaries unchanged;
- CI path filters and focused regression tests.

Not yet done:
- a deployed or bundled DSPy/GEPA optimizer service;
- multi-candidate population search and per-example Pareto archive inside NK1;
- ablation against single-candidate P23 on a frozen benchmark with paired seeds and independent holdout;
- live-device memory/latency and restart/soak tests;
- release ZIP reconciliation.

This is a candidate-generation adapter inspired by GEPA, not a claim that full GEPA optimization is running inside NK1.
