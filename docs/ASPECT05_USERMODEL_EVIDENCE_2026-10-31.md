# NK1 Aspect 05 — UserModel evidence boundary

Date: 2026-10-31
Branch: `work/aspect05-user-model-evidence-2026-10-31`

## Purpose

Provide a durable, correction-friendly model of low-risk interaction preferences without confusing explicit user statements with inferred behavior. This is separate from the organism's SelfModel and from social/relationship hypotheses.

## Evidence tiers

1. **Confirmed claim** — an explicitly stated, low-risk preference/boundary with a non-empty evidence reference.
2. **Unconfirmed candidate** — a repeated behavior pattern. Its confidence is capped at 0.65 and it is never automatically promoted.
3. **Disputed claim** — two explicit statements conflict. The old value is retained as provenance; downstream decision context excludes it from confirmed facts until `correctExplicit` is used.
4. **Rejected input** — sensitive or unclassified data, malformed values, missing provenance or replayed evidence.

## Runtime ownership

`SelfSubsystemRuntime` owns one `UserModelEvidenceModel` instance. Its snapshot is included in the Self subsystem snapshot and restored from `facets.advanced.userModelEvidence`. `PersistenceProjectionCoordinator` projects it alongside the unified self-state in the critical persistence group.

## Decision interface

- `confirmedValue(key, domain)` returns only a currently confirmed value.
- `decisionContext()` separates confirmed claims, disputed keys and unconfirmed hypotheses.
- Consumers must not treat hypotheses as facts or disputed claims as confirmed preferences.
- This first pass provides the read boundary; wiring the decision context into response-style selection, social reasoning and action arbitration is a follow-up integration slice.

## Privacy and provenance

The model intentionally supports only low-risk interaction-style, content-preference, accessibility-preference and explicit-boundary domains. Sensitive and unknown classifications fail closed. Values, keys, snapshots and replay references are bounded. Evidence references support traceability and deduplication; they are not cryptographic signatures or independent provider attestations.

## Validation

Run from `runtime/neuro-kurisu`:

```bash
npm run test:user-model-evidence
npm run test:user-model-runtime-persistence
npm run typecheck
```

The first two commands are wired into the WorkPass79 cognitive runtime regression workflow. Exact-head CI and runtime execution remain the acceptance gate; no device validation or Release ZIP publication is claimed.
