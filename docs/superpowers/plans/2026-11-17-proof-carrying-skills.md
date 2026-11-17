# Proof-Carrying Skills Implementation Plan

> **For agentic workers:** Execute task-by-task with the current-session implementation workflow. Each task owns its tests and should be committed independently.

**Goal:** Add a signed, version-bound competence certificate to NK1’s existing P23 skill lifecycle and require it at opted-in ActionGateway boundaries.

**Architecture:** P23 remains the single source of truth for versioned skills, authenticated outcome proposals, and signed/context-bound shadow evidence. A new proof artifact binds that evidence to an executable contract and is enforced before ActionGateway executor entry.

**Tech Stack:** TypeScript, Node.js 24, Ed25519 from \`node:crypto\`, existing \`stableJson\` / \`sha256Stable\`, Node test runner.

**Spec:** \`docs/superpowers/specs/2026-11-17-proof-carrying-skills-design.md\`

## Global Constraints

- Base exclusively on \`workpass70-source\` HEAD \`1e83a011fc677ff20f2348570322bd562181d9ff\`.
- Keep legacy unmarked skill behavior compatible; default-deny missing/invalid proof only for opted-in skills/tools.
- Attestor private keys stay outside runtime; trust distinct from shadow-verifier and promotion-approval keys.
- Do not make holdout samples available to revision generation or treat a report as a signature.
- Preserve candidate CAS, authenticated approvals, durable writes, rollback, and source-of-truth boundaries.
- No merge to source/main and no release creation.

## Review Focus

- Missing/expired proof must refuse before the external executor is entered.
- Proof for another tool/capability/permission class must not transfer.
- Contract, runtime, or environment drift must invalidate a proof.
- Caller-supplied or persisted unsigned proof data must never authorize.
- New shadow evidence must invalidate the previous proof; restart must reauthenticate the stored artifact.

---

### Task 1: Establish the missing admission behavior (RED)

**Files:**
- Create: \`runtime/neuro-kurisu/tests/p23-skill-competence-proof.mjs\`
- Create: \`.github/workflows/proof-carrying-skills.yml\`

**Interfaces:**
- Consumes: existing \`ActionGateway\` public registration and execution API.
- Produces: an exact-head CI test proving that an opted-in tool without a competence proof is rejected before executor entry.

- [ ] Add a test registering \`requiresSkillCompetenceProof: true\`, executing without proof, and asserting outcome \`competence-insufficient\` plus zero executor calls.
- [ ] Run Node 24 test on the first PR commit and record the expected behavioral failure (executor ran because the gate is missing).
- [ ] Do not add production behavior in this task.

### Task 2: Define and verify the proof artifact

**Files:**
- Create: \`runtime/neuro-kurisu/src/organism/learning/SkillCompetenceProof.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/learning/VersionedSkillCandidateStore.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/learning/VerifiedSkillLifecycleBootstrap.ts\`

**Interfaces:**
- Consumes: authentic \`VerifiedSkillPromotionProposal\`, \`VersionedSkillCandidate\`, trusted \`SkillShadowEvidenceVerifier\`.
- Produces: schema-v1 signed proof payload, SHA-256 artifact fingerprint, Ed25519 verifier, candidate-bound proof attachment and bootstrap-loaded attestor public keys.

- [ ] Test proof rejects forged/altered proposal, candidate/payload mismatch, unsigned or context-invalid shadow receipts, duplicate/incomplete evidence, malformed contracts, and invalid attestor keys.
- [ ] Run focused tests to observe those failures before implementation.
- [ ] Implement payload creation using only the candidate store's own shadow verifier and authentic proposal; include contract, tool identity, holdout summary, shadow digest, runtime/environment, expiry, constraints, preconditions and execution modes.
- [ ] Verify Ed25519 signature and every candidate/evidence binding; default deny if trust is absent.
- [ ] Add a separate \`NEURO_SKILL_COMPETENCE_ATTESTOR_KEYS_JSON\` public-key configuration and expose only key count/diagnostic status.

### Task 3: Enforce proof in the versioned lifecycle and durable store

**Files:**
- Modify: \`runtime/neuro-kurisu/src/organism/learning/VersionedSkillCandidateStore.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/learning/AtomicFileSkillStorePersistence.ts\`
- Test: \`runtime/neuro-kurisu/tests/p23-skill-competence-proof.mjs\`

**Interfaces:**
- Consumes: schema-v1 signed proof and the candidate's exact current verified shadow ledger.
- Produces: \`attachCompetenceProof(candidateId, artifact)\`; proof-required candidates cannot activate without it; active proofs are revalidated on restore.

- [ ] Test proof required on a proof-carrying candidate, and new shadow receipt invalidates an old proof.
- [ ] Test tampered proof persistence fails closed on reconstruction.
- [ ] Implement exact fingerprint/binding checks and strict nested shape validation; preserve rollback behavior and legacy opt-out.

### Task 4: Enforce proof at ActionGateway (GREEN)

**Files:**
- Modify: \`runtime/neuro-kurisu/src/organism/system/ActionGateway.ts\`
- Modify: \`runtime/neuro-kurisu/src/organism/learning/SkillCompetenceProof.ts\`
- Test: \`runtime/neuro-kurisu/tests/p23-skill-competence-proof.mjs\`

**Interfaces:**
- Consumes: \`ToolDefinition.skillCompetenceProof\`, \`requiresSkillCompetenceProof\`, current runtime/environment identity and configured trusted attestor keys.
- Produces: pre-execution competence refusal or authorization strictly for the signed scope and allowed execution mode.

- [ ] Test valid assisted call, autonomous denial/allowance, wrong tool/capability/permission, wrong contract digest, stale runtime/environment, expiry and bad signature.
- [ ] Verify every denial occurs before executor entry.
- [ ] Implement the default-deny gate before the registered executor, preserving existing policy/approval/idempotency checks.

### Task 5: Finish integration and verification

**Files:**
- Modify: \`runtime/neuro-kurisu/package.json\`
- Modify: \`.github/workflows/proof-carrying-skills.yml\`
- Modify: \`CHANGELOG.md\` and the current engineering handoff.

**Interfaces:**
- Consumes: proof/store/gateway implementation and regression suite.
- Produces: documented npm scripts, dedicated CI, source handoff, exact verification record.

- [ ] Run proof-specific tests, existing versioned-skill and lifecycle tests, bootstrap tests, runtime typecheck and relevant regression suite.
- [ ] Inspect commit diff and current PR head; rerun exact-head GitHub Actions and report each conclusion.
- [ ] Record implemented/connected/tested/released separately; leave PR Draft and do not publish a Release.
