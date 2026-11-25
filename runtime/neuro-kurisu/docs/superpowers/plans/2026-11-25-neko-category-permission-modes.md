# N.E.K.O. Action Permission Modes Implementation Plan

> For agentic workers: use the native GitHub branch as the isolated workspace. Execute each task with test-first changes and focused commits.

**Goal:** Add N.E.K.O.-style category permission modes to the existing NK1 ActionGateway without creating a second execution authority.

**Architecture:** Extend the canonical ActionGateway permission snapshot with validated class modes, policy revision and process-local session grants. Keep exact request tickets as the one-shot mechanism; mode/session authorization is evaluated inside consumeDirectActionApproval.

**Tech Stack:** TypeScript, Node.js --experimental-strip-types, GitHub Actions.

**Spec:** runtime/neuro-kurisu/docs/superpowers/specs/2026-11-25-neko-category-permission-modes.md

## Global Constraints
- Keep workpass70-source @ 9008a8982a5173304456bee2c604bd0bc8665964 unchanged.
- Use ActionGateway as the only policy/execution authority.
- Host-supplied permissionSessionId is optional, bounded and included in approval fingerprints.
- Session grants are memory-only and never serialized.
- Existing approval APIs remain backward compatible; boolean approve maps to once.
- allow cannot bypass idempotency storage, verification, destructive dry-run, or Undo-First checks.
- Missing/corrupt policy snapshots fail closed or restore conservative auto defaults; never invent a wider permission.

## Review Focus
- Malformed mode values and unknown permission classes must not widen access.
- A stale approved ticket must not survive a stricter category mode.
- A session grant must not transfer to another session or survive process reconstruction.
- An unreadable/failed permission-state persist must not leave an in-memory grant active.
- A persistent allow setting must not bypass idempotency receipts or independent verification.

---

### Task 1: Specify permission behavior

**Files:**
- Create: runtime/neuro-kurisu/tests/neko-action-permission-modes.mjs
- Modify: runtime/neuro-kurisu/package.json
- Create: .github/workflows/nk1-neko-action-permission-modes.yml

**Interfaces:** Test public ActionGateway methods only; no test-only production hooks.
- Add a failing focused test for the default auto map, one-shot compatibility, and category-mode API.
- Run the test on unchanged implementation and confirm it fails because the API is absent.
- Add the test script and workflow trigger after the failing behavior is recorded.

### Task 2: Add mode state and validation

**Files:**
- Modify: runtime/neuro-kurisu/src/organism/system/ActionGateway.ts

**Interfaces:**
- ActionToolPermissionMode = auto | first_ask | always_ask | allow | deny.
- ActionToolPermissionChoice = always | session | once | deny.
- Add permissionSessionId? to ActionGatewayExecutionOptions.
- Add setToolPermissionMode(permissionClass, mode, expectedRevision?).
- Add resolveToolApprovalChoice(requestId, choice, actor?); keep resolveToolApproval(requestId, approved, actor?) as once/deny compatibility wrapper.
- Include mode/revision in ActionToolPermissionSnapshot; do not serialize session grants.

- Implement safe default resolution and snapshot validation.
- Keep permission ticket policyRevision bound to the current revision.
- Add bounded session-grant state keyed by class and validated host session ID.

### Task 3: Enforce decisions in ActionGateway

**Files:**
- Modify: runtime/neuro-kurisu/src/organism/system/ActionGateway.ts
- Test: runtime/neuro-kurisu/tests/neko-action-permission-modes.mjs

- Deny mode refuses before executor entry.
- Allow mode bypasses only the prompt, not receipts/verification/destructive/undo gates.
- First-ask mode supports exact once, host-session and persistent always choices.
- Always-ask mode offers only once/deny; session and always answers are refused.
- Tightening a policy revokes session grants and invalidates old approval tickets.
- Persist mode + decision atomically using the existing execution ledger persister; roll back on storage failure.

### Task 4: Verify and document

**Files:**
- Create: runtime/neuro-kurisu/docs/NEKO_ACTION_PERMISSION_MODES_RU.md
- Modify: runtime/neuro-kurisu/package.json
- Workflow: .github/workflows/nk1-neko-action-permission-modes.yml

- Run focused permission mode tests.
- Run action-gateway-idempotency-workpass37.mjs, action-gateway-restore-boundary-workpass647.mjs, action-gateway-audit-redaction.mjs, and existing approval tests.
- Run workflow exact-head; report cancelled/queued separately from pass/fail.
- Keep PR Draft and do not merge.