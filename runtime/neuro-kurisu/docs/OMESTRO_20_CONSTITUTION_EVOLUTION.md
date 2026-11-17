# OmeStro #20 — Constitution Evolution

## Goal

A controlled, versioned process for improving NK1 operating rules without allowing an agent or a proposal to rewrite foundational guarantees.

## Runtime ownership and persistence

`ConstitutionEvolutionEngine` is owned by `GovernanceSubsystemRuntime` and is exposed to the host only through `OrganismCore` methods. Its typed snapshot is written by both critical and hot paths in `PersistenceProjectionCoordinator` to `facets.advanced.constitutionEvolution`, then restored by `GovernanceSubsystemRuntime.restoreFromPersisted`. The feature uses the canonical organism checkpoint, not a second governance database.

Existing `P69ConstitutionalArbiter` remains the final runtime decision membrane and is not rewritten. Approved constitutional rules are governance metadata; they do not patch P69, ActionGateway, host policy, executable code, or permissions.

The main UI mounts `ConstitutionEvolutionConsole`. It reads the canonical server projection and exposes proposal, signed-review, ratification, activation, and rollback operations. Protected owner approval cards are rendered by the existing root-level `ActionApprovalCenter`.

## Protected baseline

The compiled baseline is SHA-256 anchored and contains ten deeply frozen invariants: safety/security, law and host policy, user authority and consent, privacy, evidence provenance, truthful reporting, evidence-bounded identity/consciousness claims, architectural layer separation, auditable rollback, and reviewer/approver independence.

Only five domains are mutable: `workflow`, `quality`, `performance`, `resource`, and `operations`. Rule IDs cannot enter the `core.` namespace. Proposal IDs are URL-safe. A conservative phrase detector rejects obvious attempts to weaken protected controls; this is defense in depth, not a semantic proof.

## Lifecycle and host API

The server routes are under `/api/organism/constitution`:

- `GET /api/organism/constitution` returns the active revision, protected baseline, bounded proposals/audit history, diagnostics, and trusted reviewer IDs (never PEM contents).
- `POST /api/organism/constitution/proposals` creates a candidate. The server stamps the author from the API authorization mode and stamps ingress time; caller-supplied author identity and submission timestamp are ignored.
- `POST /api/organism/constitution/proposals/:id/review` accepts only a detached Ed25519 reviewer artifact from a configured trusted key.
- `POST /api/organism/constitution/proposals/:id/ratify` creates an ActionGateway approval challenge, or consumes the approved ticket on the UI's single retry.
- `POST /api/organism/constitution/proposals/:id/activate` activates a ratified proposal after a fresh base-version check.
- `POST /api/organism/constitution/rollback` creates or consumes a separate one-shot owner approval ticket.

1. **Propose:** bind author, active base version, change kind, target rule, motivation, scope, counterexample, risk/mitigations, and test plan into the candidate digest.
2. **Review:** reviewer identity must differ from the author. Each review attestation is accepted only after Ed25519 signature verification against a configured public key, a freshness window, the exact proposal ID/digest, and the full test-plan cardinality. Approval requires every planned test to pass, protected-invariant checks, and at least one passing holdout. High/critical risk requires two distinct reviewers.
3. **Ratify:** the engine requests a one-shot ticket from the existing `ActionGateway`. The ticket is bound to the exact proposal ID and candidate digest, classed as a `system` operation, shown through the existing ActionApprovalCenter, resolved by the owner, and consumed atomically before the proposal can become ratified. A caller-supplied `explicitHumanApproval: true` or arbitrary approval reference is not authority.
4. **Activate:** the engine re-checks the base version and appends a new revision and audit event. Stale candidates cannot silently apply.
5. **Rollback:** a separate one-shot ActionGateway ticket is bound to the current version, target version, and rollback reason. Rollback appends a new revision pointing to the restored version; it does not erase superseded history.

## Independent review authority

Configure only reviewer *public* Ed25519 keys in the server environment:

```sh
NEURO_CONSTITUTION_REVIEW_KEYS_JSON='{"reviewer-1":"-----BEGIN PUBLIC KEY-----..."}'
```

For high/critical proposals configure two or more distinct reviewer IDs backed by different Ed25519 public keys. The loader fingerprints canonical DER public keys and rejects aliases, so repeating one key under multiple IDs cannot satisfy the quorum. The private signing keys must remain with the external reviewer or signing service and must never be placed in NK1, the browser, the Release ZIP, or the server environment.

A signed artifact has this shape:

```json
{
  "payload": {
    "schemaVersion": 1,
    "proposalId": "constitution-...",
    "candidateDigest": "<64-char digest shown by the console>",
    "reviewerId": "reviewer-1",
    "decision": "approve",
    "invariantsPassed": true,
    "tests": {
      "planned": 2,
      "executed": 2,
      "passed": 2,
      "failed": 0,
      "holdoutCases": 3,
      "holdoutPassed": true
    },
    "evidenceRefs": ["ci://.../run", "holdout://.../artifact"],
    "rationale": "Independent review rationale",
    "at": 1800000000000
  },
  "signature": "<base64 Ed25519 signature>"
}
```

The signature covers canonical JSON: recursively sort object keys, preserve array order, and UTF-8 encode the resulting JSON string. Evidence references must be credential-free durable identifiers or safe run URLs: the authority rejects URL userinfo, signed-URL query parameters, access/API tokens, bearer/basic credentials, and control characters. Prefer immutable CI run IDs and opaque `ci://` / `holdout://` references; never paste a presigned download URL or secret-bearing link into the artifact. The canonicalization function is exported as `canonicalConstitutionReviewPayload`. The server route and `ConstitutionEvolutionEngine.review()` independently reject untrusted keys, altered payloads, stale/future timestamps, author self-review, failed planned tests, missing holdout evidence, and mismatched candidate digests. The engine accepts only a signed artifact; it never accepts a plain `ConstitutionReviewInput` DTO. This remains true for callers that bypass HTTP and use the Core facade directly. CI/reviewer systems must actually run the test plan and holdout before signing; the runtime verifies the attestation but does not execute arbitrary prose test plans or independently inspect external evidence URLs.

## Cryptographic integrity and host authority

Non-baseline mutation requires a host-controlled signing key of at least 32 bytes, supplied through `NEURO_CONSTITUTION_HMAC_KEY` (or explicit constructor injection for tests). Never commit the secret, place it in a Release ZIP, or log it. Production secret delivery remains a host/deployment responsibility.

The complete snapshot is HMAC-SHA-256 authenticated. Reviewer attestations, ratification receipts, and audit events have their own HMACs; audit entries form a bounded hash-linked chain with a persisted anchor when old events are compacted. Restore validates the protected baseline, active revision, complete revision lineage, bounded proposal/review structure, signed review/approval records, and audit chain. Missing key permits only the pristine compiled baseline; malformed or unauthenticated non-baseline state resets fail-closed to that baseline with a diagnostic.

The server's normal `authorizeApiRequest` gate applies to every constitution route. Proposal author identity is server-assigned. The ActionGateway resolver writes the host actor label; no route accepts an approver ID from request JSON. The ActionGateway is not itself an identity provider: remote deployments must configure `NEURO_API_TOKEN` and restrict the token to the authorized owner control plane. Local loopback mode retains the existing loopback trust boundary.

## Bounds and failure behaviour

Revision history is bounded to 32, proposals to 64, mutable rules to 128, reviewers per proposal to 4, credential-free evidence references per review to 12, and audit events to 256 (with an anchor digest across compaction). The signed checkpoint projection is memoized until the governance ledger changes, avoiding repeat full-state cloning and HMAC work on unchanged hot cycles. A stale proposal cannot activate against a changed base. Failed signature, missing host key, or corrupted persistence returns the engine to the compiled baseline rather than accepting partially trusted state.

## Validation

Focused CI runs runtime typecheck, lifecycle/invariant tests, independent reviewer signature tests, server API/ActionGateway end-to-end tests, runtime persistence/recovery tests, and the existing P69–P73 persistence regression. Only an Actions run on the exact current PR head counts as validation evidence.

## Boundary of this delivery

This feature provides a controlled constitutional version ledger and approval lifecycle, not unrestricted self-modification, legal compliance certification, semantic proof that every proposed rule is safe, or evidence of consciousness. Future consumers must explicitly interpret approved mutable domains and keep the protected baseline outside their control.
