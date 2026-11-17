# Proof-Carrying Skills — design

Date: 2026-11-17
Branch: \`aspect/proof-carrying-skills-20261117\`
Base: \`workpass70-source\` at \`1e83a011fc677ff20f2348570322bd562181d9ff\`

## Intent

Make a learned skill carry independently verifiable evidence that it works within a narrow, explicitly declared operating envelope. “A successful trace exists” must not be interpreted as “this skill is competent for every tool, context, or environment.”

## Existing architecture and the gap

NK1 already has the canonical P23 versioned candidate store, signed/context-bound shadow receipts, an independent holdout evaluator, three-level skill evaluation reports, authenticated promotion approvals, atomic persistence and rollback. The legacy \`ProceduralSkillLibrary\` keeps heuristic experience/retrieval statistics; it is not an authorization authority.

The missing link is a single signed competence artifact that binds the exact skill candidate version and payload to its tool/capability, input/output contracts, runtime and environment identity, holdout evidence, shadow evidence, expiry, and allowed execution modes. \`ActionGateway\` already has a pre-execution \`ToolDefinition.competence\` boundary, but it does not enforce a first-class proof.

## Goals

- Define a version-bound, Ed25519-signed Skill Competence Proof with a canonical SHA-256 fingerprint.
- Require proof for explicitly marked proof-carrying candidates and tools; keep unrelated legacy tools behavior-compatible.
- Derive proof material only from a genuine P23 promotion proposal and signed shadow observations that the candidate store itself verifies against trusted run context.
- Bind proof to exact tool ID/capability/permission class, input/output schema fingerprints, runtime/environment fingerprints, holdout coverage/outcome summary, preconditions, constraints, validity window, and whether autonomous use is allowed.
- Fail closed before executor entry when proof is missing, malformed, unsigned, expired, outside its declared scope, or bound to stale code/data/contracts/runtime/environment.
- Keep attestor private keys outside NK1. Configure separate trusted public keys, distinct from shadow-verifier and promotion-approval authorities.
- Validate persistence shape and re-authenticate active proofs after restart.
- Add adversarial regression tests and a dedicated exact-head CI workflow.

## Non-goals

- No automatic promotion or autonomous permission grant from a model confidence score.
- No claim of general intelligence, measured learning uplift, or universal skill competence.
- No blanket breakage of legacy tools; migration is explicit.
- No replacement of the P23 candidate store, outcome ledger, independent evaluator, or rollback path.
- No claim that every existing tool is already certified.

## Approaches considered

1. Add proof fields to \`ProceduralSkillLibrary\` and let that heuristic library authorize actions. Rejected: it duplicates P23 versioning and cannot own authenticated promotion/shadow lifecycle.
2. Build a separate skill registry. Rejected: creates a second source of truth and risks disagreement with active P23 versions.
3. Extend the P23 versioned candidate lifecycle with signed proof and enforce it at the existing ActionGateway pre-execution gate. Chosen: preserves the canonical candidate lifecycle and puts admission at the side-effect boundary.

## Design decisions

- Proof schema v1 is immutable and signed by an externally held Ed25519 attestor key.
- The proof has subject bindings (candidate ID, skill ID/version, payload fingerprint, proposal/outcome fingerprints) and execution bindings (tool, capability, permission class, input/output schema digests, runtime/environment digests).
- Evidence includes exact holdout manifest/outcome/dataset fingerprints and paired task/seed/family summaries from the authentic P23 proposal, plus a digest of verified shadow receipts. The certificate records evidence; it does not replace the original signed artifacts.
- Preconditions and constraints are stable identifiers in the signed artifact. Gateway checks only declared runtime/tool bindings and requested execution mode; the host remains responsible for enforcing each named precondition/constraint and providing truthful runtime/environment identity.
- Proof validity is time-bounded. Expired or stale proofs require a new candidate/evaluation/attestation, not a silent renewal.
- A candidate opts into proof enforcement by carrying an explicit \`proofCarryingSkill: true\` contract marker. A registered tool opts in with \`requiresSkillCompetenceProof: true\`; a proof attached to an unmarked tool is still verified.
- Legacy \`ProceduralSkillLibrary\` statuses remain retrieval/learning hints and never grant tool authorization.

## Safety and migration

No proof is accepted without an explicitly configured trusted attestor key. Missing/malformed key configuration is default-deny for proof-carrying skills. Existing unmarked candidates retain the pre-existing promotion semantics; proof-carrying candidates cannot promote without a current proof. A newly added shadow receipt invalidates the prior proof because its evidence digest no longer describes the candidate's current evidence set. Rollback restores the prior version and its own proof.

## Acceptance criteria

- Missing proof on an opted-in tool is refused before its executor is entered.
- Signed matching proof authorizes only the exact declared tool/contracts/runtime/environment and allowed execution mode.
- Altered payload, contract, attestor, tool identity, scope, mode, or time window is denied.
- Proof cannot be attached to an untrusted proposal/candidate or derived from unauthenticated shadow rows.
- Active proof is revalidated on store restore; malformed/tampered persistence fails closed.
- Existing legacy tests remain green and new CI tests run on the exact PR head.
- Work remains in a Draft PR based on \`workpass70-source\`; no automatic merge or release.
