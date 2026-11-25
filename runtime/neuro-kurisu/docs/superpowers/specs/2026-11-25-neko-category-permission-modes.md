# N.E.K.O.-style action permission modes for NK1

## Intent
Bring the useful part of N.E.K.O.'s category-level permission model into NK1's canonical ActionGateway: users can choose whether a permission class asks every time, asks the first time and then accepts a remembered choice, is allowed, or is denied.

## Existing architecture
NK1 already classifies protected tools as web, device, filesystem, code, system, or self-modification. Every protected execution currently uses the durable ActionGateway approval ticket, bound to the exact tool, operation, request fingerprint, decision ID and expected output/precondition. The execution ledger persister stores the approval queue beside action receipts.

## Goals
- Add category-level modes auto, first_ask, always_ask, allow, and deny.
- Add choices always, session, once, and deny when effective mode is first_ask; always_ask offers only once and deny.
- Keep ActionGateway as the only execution/approval authority.
- Persist category settings in the existing permission snapshot and restore older snapshots safely.
- Keep session grants process-local, bound to a host-supplied session ID and one permission class; clear them when the class policy changes.
- Re-check current policy at execution time. A ticket created before a policy revision change cannot override a newer restriction.
- Keep approval previews redacted and never expose host session IDs or full request hashes.

## Non-goals
- Do not create a second executor or alternate tool gateway.
- Do not let model/plugin payloads mint session IDs or settings.
- Do not change ActionGateway idempotency, provider reconciliation, independent verification, undo-first or destructive-tool gates.
- Do not import N.E.K.O.'s Python permission gate or its full task-agent lineage/loan subsystem.
- Do not add per-MCP-server policy in this pass; N.E.K.O. plugin manifests already have their own host-reviewed adapter and allowlist.

## Safety defaults
Old snapshots without modes restore as auto. NK1's auto map is conservative: web/device use first_ask; filesystem/code/system/self-modification use always_ask. Explicit allow remains a user-owned persistent choice and cannot bypass the existing durable-receipt or verification requirements.

## Approaches considered
1. Replace ActionGateway with a separate permission gate: rejected because it creates a competing authority and widens the execution surface.
2. Add category policy to the existing ActionGateway approval state: selected because the existing ledger already persists one-shot approvals.
3. Copy N.E.K.O.'s Python PermissionStore/PermissionGate: rejected because it duplicates runtime, storage, category and task-session ownership.

## Verification
A focused Node regression suite will exercise defaults, mode changes, first-ask choices, always-ask restrictions, session isolation, process restart, policy tightening, persistence failures, exact request binding and backward-compatible restore. Existing ActionGateway permission/idempotency/restore tests remain required.