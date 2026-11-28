# NK1 learning subprocess sensitive environment boundary
Date: 2026-11-26
Canonical base: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
Origin: existing PR #1183, transplanted onto current source without replacing the current unified runtime workflow.

## Contract
- Credential-shaped variables are denied in both inherited and explicit child environments unless the host supplies an exact per-run `allowSensitiveEnv` grant.
- A grant name must be valid, unique, classified as sensitive, and bound to a key actually present in that command's explicit or inherited environment.
- The sorted grant set participates in the command fingerprint, so runs with different authority envelopes do not share an execution identity.
- Granted values remain redacted from durable execution receipts.
- The trusted-shadow scheduler validates and preserves the grant list; invalid, duplicate, non-sensitive, or unbound grants are rejected.
- The host-owned teacher/student trainer grants only the exact local model/cache path selectors it needs.
- Ordinary `NODE_ENV` and normal non-sensitive configuration remain available.
- The focused workflow exercises the process boundary, trusted-shadow config parser, signed observation fixture and runtime typecheck.

## Scope and limitations
This is least-privilege environment filtering at the existing learning process boundary. It is not a filesystem, network, kernel, user, container or VM sandbox. The existing process runner continues to use `shell:false`, bounded output/time, process-group termination and redacted receipts. Untrusted learner code still requires a separate OS/container/VM sandbox.

## Verification notes
The original PR reported 12/12 exact-head checks on its older base. This transplant is on the current source and must pass its new exact-head checks before it is counted as accepted.
