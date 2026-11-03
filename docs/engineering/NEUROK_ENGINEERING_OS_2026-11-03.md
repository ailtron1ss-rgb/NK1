# NeuroK Engineering OS — architecture and rollout

**Status:** implementation foundation / not yet a deployed autonomous agent platform  
**Branch:** `aspect/neurok-engineering-os-20261103`  
**Base source SHA:** `eaf653d2229b8c032fe542ffb3215ff25ba69a93`

## Objective

Create a repository-native control plane that makes ChatGPT, Codex and specialist agents more effective by giving them a shared, auditable workflow—not by granting unrestricted access. The source of truth remains NK1 Git history, canonical runtime modules and exact-SHA CI artifacts.

## Architecture

1. **Repo Intelligence** — enumerate source tree, manifests, scripts, imports/call paths, branches, PRs, dependencies, licenses and asset provenance. A path/name inventory is not a call-graph proof; report static and runtime reachability separately.
2. **Agent Coordinator** — decompose work into independently testable tasks; assign one owner per file/contract; record dependencies and claims; prevent overlapping writes; require handoff notes and exact base SHA.
3. **Research & Integration Lab** — Firecrawl/TinyFish for primary-source discovery, Consensus for peer-reviewed literature, Context7 for versioned API docs. Each candidate records revision/date/license, mechanism, expected benefit, cost, risk, canonical owner, test and accept/reject decision.
4. **Universal Tool Bridge** — capability registry plus narrow adapters. Connector availability is not proof of account connection, permission, data access or runtime integration. Secrets stay in environment/secret manager; never in manifests, prompts, commits or evidence.
5. **Patch Sandbox** — accept immutable patch digest + base SHA; derive changed paths/line ranges from the patch itself; enforce protected-file/evolve-block policy; apply in an isolated worktree/container; run tests/typecheck/security checks; invoke a verifier that cannot be edited by the candidate; produce rollback receipt.
6. **Evidence & Progress Ledger** — every claim is labelled IMPLEMENTED / CONNECTED / TESTED / OBSERVED / PROVEN / RELEASED / UNKNOWN. Evidence binds to exact commit SHA, test command, environment, dataset/holdout, seed, artifact digest and timestamp. Never turn configured probes or synthetic CI into efficacy claims.
7. **Release Forge** — build from exact approved source SHA; generate ZIP + SHA-256 + SBOM + license report; require human redistribution approval and clean-machine smoke; compare final asset contents to source provenance; publish only when every gate passes.

## Operating protocol

- Start each task by refreshing live source HEAD, release metadata, open PRs and CI state. The published Release ZIP remains the deliverable; inspect it before claiming artifact parity.
- Keep work in aspect-specific branches. Never write directly to `main`; never assume an older checkpoint SHA is current.
- Each agent declares: task ID, base SHA, owned paths, forbidden paths, acceptance tests, expected output and stop conditions.
- A task may be merged only when its base is current or conflicts are resolved, regression tests pass, CI is green, review is complete and evidence references the exact head.
- Two agents must not concurrently edit the same file. Read-only research can run in parallel; write work is parallel only across disjoint ownership.
- External services are opt-in adapters. No database, paid service, secret, schema or production deployment is created without an explicit architecture and credential decision.
- Self-modification cannot alter its evaluator, sealed holdout, policy authority, release gate or rollback mechanism. Promotion requires independent verification and recoverability.

## Tool routing

| Work | Preferred tools | Output |
|---|---|---|
| Source truth / PR / CI / release | GitHub | SHA-bound change and CI evidence |
| Local agent execution | Codex Coordinator, Replit only when a matching workspace is confirmed | bounded task receipts |
| Research / source extraction | Firecrawl, TinyFish, Consensus | source-intake records |
| Library APIs | Context7 | version-pinned usage notes |
| Architecture / code graph | Code Ontology Companion, Fallow, SonarQube, TypeScript compiler API | graph + static findings |
| Design / UI | Figma, Lumen UI, Maze, Lovable, Vibelets | reviewed design and user evidence |
| Voice / avatar / media / 3D | Twilio kit, HeyGen, Higgsfield, Runway, NVIDIA Skills, Game Development Studio | licensed, tested assets/adapters |
| Data stores | Redis, Supabase, MongoDB Atlas | isolated adapters after data/secret review |
| Delivery | codex-sdlc, AgentProof, TestFlight Release, Resolve AI | signed/hashed evidence and controlled rollout |

## Current connection truth

This manifest catalogs requested tools and their intended roles. It deliberately sets every provider to `connectionStatus: unverified`, `enabled: false`, and `runtimeIntegrated: false`. A tool being mentioned, installed as a skill, or callable in a ChatGPT session does not make it a production NK1 dependency. Update these fields only with verifiable account/permission/contract evidence.

## Workstreams and exit criteria

| Stream | Concrete deliverable | Exit criteria |
|---|---|---|
| OS-01 Repo Intelligence | deterministic inventory + TypeScript AST graph | path coverage and static/runtime reachability reported separately |
| OS-02 Coordinator | active claim board + conflict detector | no overlapping writes; restart-safe claims and handoffs |
| OS-03 Research Lab | provenance ledger + candidate evaluator | every promoted idea has license, baseline, ablation and measured gain |
| OS-04 Tool Bridge | capability interfaces + adapters | least privilege, timeout, retry, idempotency, audit and redaction tests |
| OS-05 Patch Sandbox | diff parser + isolated apply + rollback | changed lines derived, protected targets refused, verifier independent |
| OS-06 Evidence Ledger | exact-SHA evidence schema and scorecard | stale artifacts rejected; efficacy separate from artifact/test coverage |
| OS-07 Release Forge | deterministic ZIP/SBOM/license workflow | human redistribution approval, clean-machine smoke, hash verified |

## Initial implementation in this branch

- Machine-readable tool/capability registry with explicit unverified defaults.
- Offline CLI to validate the registry and print workstream plans.
- Lease-based single-writer task coordinator with base-SHA binding, current-checkout verification, path traversal rejection, parent/child conflict detection, expiry, idempotent renewal and owner-only release.
- Unified-diff preflight parser with SHA-256 digest, file status, hunk/changed-line ranges, binary/traversal rejection and human-approval/deny policy classification.
- Node test suite for registry safety, concurrent claims and patch-policy invariants.
- Research intake translating STORM, Co-Coder, CooperBench and OpenCollab into concrete coordination design decisions.

### Coordinator scope boundary

The initial patch sandbox is a read-only preflight: it parses and classifies a patch but does not apply it. Patch application must run in a separate disposable worktree/container with resource limits and rollback receipts. The initial claim store is a local filesystem lease store. Multiple agents can coordinate only when they share the same `NEUROK_OS_STATE_DIR`; independent devices/worktrees do not share state automatically. It is advisory: it does not intercept arbitrary filesystem writes or replace Git review. A later authenticated shared backend must use transactional compare-and-swap and be contract-tested before cross-device claims are enabled.

## Not included / not claimed

No external service has been connected by this change. No API keys or database schemas were created. No remote agent is running continuously. No self-modification pipeline, sandbox isolation, independent verifier, production dashboard or Release ZIP integration is claimed. Those are separate implementation gates.

## Next engineering passes

1. Add TypeScript AST/TypeChecker graph extraction and confidence/provenance classes.
2. Implement durable coordinator claims with leases and conflict detection.
3. Build the patch sandbox against the existing self-modification substrate, not as a parallel authority.
4. Bind evidence receipts to CI run IDs, artifact hashes and independent holdout manifests.
5. Integrate one external provider at a time behind a contract-tested adapter; begin with GitHub + local CLI, then research connectors, then optional storage.
6. Build a dashboard only after the underlying registry, evidence and ownership contracts are stable.
