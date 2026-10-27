# CURRENT HANDOFF — 2026-10-27

> **Read first:** [NK1 canonical project goal and state map](docs/NK1_CANONICAL_PROJECT_STATE_RU.md). It supersedes this file's older checkpoint where dates, branches, validation, or next steps conflict. Do not assume historical PASS entries validate the latest commit.

**Current source base:** `workpass70-source`  
**Latest source-branch checkpoint inspected:** `62deb97c0a175245ebe9058e29e0f3f43b32f100` (fresh base includes WorkPass496; check exact-head CI before claiming any newer change validated).  
**Release:** latest published source archive remains the 2026-10-19 WorkPass70 Hotfix ZIP until a later asset is verified. Source changes alone do not update Release.

---

## Latest durable checkpoint — WorkPass272 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use live PR for current HEAD.
- WorkPass272 adds filesystem identity checks to the shared evaluator storage-root separation contract: lexical paths alone are not sufficient if distinct path strings point to the same device/inode; Windows path comparisons are case-insensitive.
- Unit-level separation-contract regressions are added. The production-style host-owned subprocess test is already referenced by WorkPass110, but successful execution/typecheck remains unverified because Actions has no accessible steps/logs.
- Keep learning scores unchanged. The mechanism improves evaluator isolation constraints but does not provide a real OS/container sandbox by itself.
- Next: restore actionable CI, trace external grounding/provenance callers, deploy independently controlled evaluation authorities, and measure held-out memory-to-action and transfer/forgetting results.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md), and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).

---

## Latest durable checkpoint — WorkPass271 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use the live PR for the current HEAD.
- WorkPass271 normalizes persisted trace IDs before restore reconciliation: exact duplicate rows are collapsed; conflicting records that collide under NFKC are quarantined and cannot be replayed/reintroduced by retry.
- Existing regressions now cover task/trace bounds, C0/DEL/C1 controls including string edges, same-ID changed-payload conflicts, exact duplicate restoration, conflicting normalized snapshot records and late duplicates after bounded eviction.
- Tests/typecheck remain unverified due to Actions jobs returning no steps/logs; keep learning estimates unchanged.
- Next: restore actionable CI, audit caller-owned grounding/provenance inputs, deploy independent evaluation authorities, and run frozen memory-to-action/transfer/forgetting experiments.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md) and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).

---

## Latest durable checkpoint — WorkPass270 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use the live PR for current HEAD.
- WorkPass270 removes the last pre-validation trim from external task IDs, ensuring boundary control characters reach the canonical ID validator.
- The identity regressions cover overlong values, embedded/leading/trailing C0/C1 controls, conflicting duplicate payloads, snapshot restoration, and late duplicates after bounded-record eviction.
- Tests/typecheck are still unverified because Actions jobs return no steps/logs. Keep scores unchanged and do not claim a pass.
- Next: restore actionable exact-head CI; map all external causal-ingestion call sites and the source of grounding claims; provision independent evaluator authorities; then run frozen memory-to-action and transfer/forgetting benchmarks.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md) and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).

---

## Latest durable checkpoint — WorkPass269 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use the live PR for the current HEAD.
- WorkPass269 rejects control characters before trimming task/trace IDs, closing the leading/trailing newline/tab normalization gap. Regression cases are added to the canonical causal-stream test.
- WorkPass266–268 additionally reject lossy IDs, conflicting duplicate payloads and late duplicates after bounded-row eviction.
- Current tests/typecheck are still unverified because Actions jobs provide no steps/logs. Do not claim a PASS and do not raise learning scores without independent evidence.
- Next: restore actionable exact-head CI, map all external causal-event call sites, verify grounding provenance, provision the true sandbox/verifier/scanner, and run independent memory-to-action/learning experiments.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md) and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).

---

## Latest durable checkpoint — WorkPass268 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use the live PR for the current SHA.
- WorkPass266–268 reject lossy/invalid causal IDs, detect conflicting payloads under a reused trace ID, and preserve idempotency when a duplicate's original row was evicted from bounded causal history.
- Regression code and CI path wiring exist; exact-head tests/typecheck remain unverified because available Actions jobs provide no steps or logs. Do not report a PASS without an actionable run.
- No new dependency was needed, and learning scores remain unchanged pending independent task evidence.
- Next code-first target: map all external causal intake call sites and replace any caller-asserted grounding/provenance used as authority with evidence from a canonical state transition/verifier, without breaking integrations before their contracts are mapped.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md), and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).

---

## Latest durable checkpoint — WorkPass267 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use the live PR to read current HEAD.
- WorkPass267 now distinguishes exact duplicate causal events from conflicting reuse of an existing trace identity, including after snapshot/restore; conflicting payloads fail closed without increasing outcomes.
- Focused regression code and CI wiring exist, but successful exact-head tests/typecheck are not yet confirmed because Actions lacks accessible step logs. Do not claim a test pass.
- Keep learning scores unchanged until independent task evidence demonstrates measurable transfer or memory-grounded action improvement.
- Next code-first target: map all external causal-event call sites and replace caller-asserted stateGrounded/provenance with canonical state-transition or verifier evidence without breaking contracts prematurely.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md), and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).

---

## Latest durable checkpoint — WorkPass266 (2026-10-22)

- Continue on workpass206-runtime-evaluator-wiring / draft PR #55; use the live PR for the current SHA.
- WorkPass266 fixes lossy causal task/trace identity truncation, adds invalid-input/restore regressions and wires causal-stream, Legacy-avatar and Live2D regressions into WorkPass110.
- The latest retrieved workflow job has failed without accessible step details/logs; retry requested, tests/typecheck not confirmed. Do not claim a pass from that result.
- Next code-first target: trace the external causal-event call graph and close caller-asserted grounding authority using canonical provenance; do not break integrations before mapping their contracts.
- Keep scores unchanged until independent task evidence demonstrates a repeatable transfer or memory-to-action gain.

Read the [strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md) and [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md) before the next pass.

---

## Latest durable checkpoint — WorkPass265 strategic execution map (2026-10-22)

- Current source branch: workpass206-runtime-evaluator-wiring; draft PR #55 remains open/unmerged; implementation baseline reviewed before this documentation checkpoint: `58e9c6a00b5835096dac3758968f5b9ce0eb08d2`. Use the live PR link for the current HEAD.
- Read [strategic audit and execution blueprint](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [cross-source integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md), [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md) and the current PR/Actions before coding.
- WorkPass255–264 source changes are documented in the current branch, but exact-head successful tests/typechecks and deployment-shaped evaluator authorities remain unverified.
- P0: restore actionable exact-head CI; provision a real host sandbox and independently controlled verifier/scanner; complete matched evaluation → signed evidence → approved activation → restart/rollback.
- In parallel, prepare frozen RU/EN memory and memory-grounded-action benchmarks and the production browser/Live2D test path; keep MemoryOS2, P23 and ActionGateway as canonical owners.
- Track implementation, real-call-path integration, exact-head verification and external efficacy separately. Never claim consciousness or learning uplift from module counts or unrun tests.

---

## Latest durable checkpoint — WorkPass149 (2026-10-21)

- Added an offline approval-request CLI for deployments or external approval services: `runtime/neuro-kurisu/scripts/create-skill-promotion-approval-request.mjs`.
- The CLI does not trust an observation merely because it is present in candidate-store JSON. Before emitting the signable request, it verifies each shadow artifact with configured Ed25519 verifier keys and resolves run/task/seed/manifest/runtime from the independent trusted-run registry.
- Requests are bound to the exact candidate payload/version, proposal outcome, complete shadow-evidence digest, minimum shadow-run count and current active-version CAS. Non-shadow candidates, insufficient/failed observations, invalid signatures/context, stale base versions and missing/invalid trust configuration fail closed.
- Output is unsigned and cannot activate anything; the approver private key remains external. The existing server-side promotion path still verifies the detached approval signature and evidence again.
- Added regression coverage for valid signed evidence, tampered-signature rejection, payload binding, insufficient shadow runs, wrong lifecycle state and stale CAS; package/workflow wiring added, including the aggregate verified-skill lifecycle suite.
- **NOT VERIFIED:** no successful exact-head CI/typecheck is claimed yet. Production-managed verifier/approval key rotation, authenticated rollback flow, deployment-shaped end-to-end acceptance and measured learning uplift remain open.
- **Next P0:** obtain actionable exact-head test/typecheck results; provision independent verifier and approval authorities; test stage → real shadow → signed approval → activation → restart → rollback on a deployment-shaped environment; then measure holdout transfer/reset retention.

## Latest durable checkpoint — WorkPass148 (2026-10-21)

- **Promotion authority:** distinct Ed25519 public keys configured through `NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON`. The signed payload binds exact candidate ID/version/payload, proposal/outcome fingerprint, current base version, minimum shadow runs and a digest of all verified shadow observations. The signer private key must remain outside the NK1 application process.
- **Runtime API:** `GET /api/organism/learning/verified-skills` exposes the current candidate/active lifecycle under the existing API authorization gate; `POST .../skills/:candidateId/promotion-request` prepares a short-lived signable payload only for a configured approver and a candidate with at least three passing shadow observations; `POST .../skills/:candidateId/promote` verifies and applies the signed artifact through the Core-owned P23 store.
- **Restore integrity:** a persisted active skill is now matched to its exact active candidate and payload/version, then its signed approval plus all shadow observations are revalidated. New activation approvals must be recent; already-active signed approvals remain verifiable after the freshness window expires.
- Added Ed25519-authority, tampering, replay, and restore/freshness assertions to the candidate-store regression; bootstrap tests cover configured/malformed approval key sets. Existing default-deny behavior remains when approval keys are absent.
- **NOT VERIFIED:** tests/typecheck still lack successful exact-head runner evidence; current Actions runs have no usable step list/logs. Production managed approval keys/service, signed rollback authority, live runner evidence and measured learning uplift remain open.
- **Next P0:** run all affected tests/typecheck on an actionable runner; provision independent verifier + approval authorities with a documented rotation plan; add authenticated rollback request/apply flow; verify full deployment-shaped staging → shadow → approval → activation → restart/rollback and measure holdout/generalization.

## Latest durable checkpoint — WorkPass147 (2026-10-21)

- **Operational staging path:** `runtime/neuro-kurisu/scripts/stage-verified-skill-candidate.mjs` accepts a bounded `schemaVersion: 1` bundle of manifest + signed outcome artifacts + baseline/candidate method IDs + a policy skill payload.
- The command verifies every artifact with `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON`, binds it to the supplied manifest, creates the authentic proposal in-process and applies strict holdout evidence requirements before staging through Core. Non-Ed25519/malformed keys, an invalid signature, unknown fields, oversized or symlink bundle, rejected rows, and a failed evidence gate stop staging.
- Candidate-store persistence is separate from the live organism state file. The CLI does not hydrate/flush live state, activate/promote the skill, or create approval; its JSON result includes the candidate ID needed by an explicitly configured shadow scheduler.
- Added a regression for valid signed staging, durable readback from a fresh Core and rejection of tampered outcome evidence; registered it in package scripts and P23 workflow.
- **NOT VERIFIED:** current Actions still fail before exposing actionable steps/logs; no passing tests/typecheck or measured learning uplift is claimed. Deployable independent verifier keys, signed-shadow production execution and authenticated promotion approval remain outstanding.
- **Next P0:** exercise staging + scheduled signed shadow using deployment-managed verifier keys and an actual independent runner; add authenticated approval/rollback authority and audit all activation paths; obtain successful exact-head CI/typecheck, then measure holdout/transfer/reset retention.

## Latest durable checkpoint — WorkPass146 (2026-10-21)

- **Core API:** `OrganismCore.stageVerifiedSkillCandidate` delegates candidate staging to `P23LearningEngine`/`VersionedSkillCandidateStore`, which still accepts only authentic in-process proposals backed exclusively by signed/verified outcome evidence. Added a read-only `verifiedSkillCandidateSnapshot` for local trusted runtime components.
- **End-to-end path:** new `p23-runtime-signed-shadow-observation.mjs` constructs a real accepted proposal from Ed25519-signed holdout outcome artifacts, stages the candidate through Core, launches an actual child through `OrganismRuntime`, registers its run durably, signs one observation in the fresh run directory, and feeds it back through `Core.recordVerifiedSkillShadow`.
- The regression asserts signed evidence is accepted, run/task/seed/manifest/runtime and candidate version are bound, one observation is persisted, and the active-skill set remains empty. The fixture private key exists only in the test process and child; this is **not** a production key-handling pattern.
- **NOT VERIFIED:** exact-head GitHub Actions jobs currently fail before exposing steps/logs; no passing test/typecheck result is claimed. Real deployment key/configuration and authenticated promotion approval are still open.
- **Next P0:** make the intended deployment supply a real staged candidate, independent verifier and runner configuration; add an authenticated human/authority approval path without weakening default-deny; obtain actionable exact-head CI/typecheck, then measure transfer and reset retention.

## Latest durable checkpoint — WorkPass145 (2026-10-21)

- **Production call-site integration:** `runtime/neuro-kurisu/src/server/server.mjs` passes `NEURO_SKILL_SHADOW_SCHEDULER_JSON` through `parseTrustedShadowLearningScheduleConfig`. Missing config means no shadow process runs; malformed or incomplete enabled config fails at startup.
- **Signed evidence bridge:** an opt-in run can emit `verified-skill-shadow-observation.json` (or a configured safe basename) inside its run directory. Ingestion rejects symlinks/non-files, files above 1 MiB, malformed JSON and mismatched run IDs, then submits only the parsed artifact to `OrganismCore.recordVerifiedSkillShadow` and the configured candidate-store verifier. The child exit code/stdout never becomes evidence of correctness.
- Added a production config regression and wired it into `workpass110-continual-learning-metrics.yml`. The runtime-level test additionally verifies that a successful process with no signed observation remains `lastEvidenceStatus: missing`.
- **NOT VERIFIED:** no runner-backed successful CI/typecheck or passing signed-observation acceptance test has been observed yet; verifier deployment and authenticated promotion approval remain open. Do not merge this draft PR or claim learning uplift.
- **Next P0:** verify acceptance with a staged candidate plus a real signed observation from a configured trusted verifier; add an authenticated approval authority and audit all store activation paths; obtain actionable exact-head CI/typecheck evidence.

## Latest durable checkpoint — WorkPass144 (2026-10-21)

- **Real integration change:** the production `OrganismRuntime` now owns a dedicated `trusted-shadow-learning` runtime clock when `RuntimeConfig.trustedShadowLearning.enabled` is explicitly true. The clock calls `runTrustedShadowLearningOnce()`, which always routes via `OrganismCore.runTrustedSkillShadowLearningProcess()` and its durable registration-before-spawn boundary.
- Resource gates prevent scheduled child execution while asleep, under high RAM/thermal pressure, with low battery, or when the runtime cognitive budget is too low. No process runs unless operator configuration explicitly supplies the task identity, manifest/plan fingerprints and command.
- Run status is observable in runtime diagnostics and journal records. Shutdown drains in-flight shadow execution. The new integration regression exercises a real Core/runtime and real child process, then validates the trusted registry record.
- **NOT VERIFIED:** this source change/test have been committed, but actual test/typecheck execution remains dependent on a successful runner-backed CI. A completed process receipt is not a verified task outcome; signed observation ingestion, deployed verifier-key provisioning and authenticated approval remain open.
- **Next P0:** configure and validate the intended production task/runner so the clock is enabled only in the correct deployment; connect its signed observation output to `recordVerifiedSkillShadow` only after signature/context verification; wire authenticated skill-promotion approval; audit all activation routes and obtain exact-head CI/typecheck evidence.

## Latest durable checkpoint — WorkPass143 (2026-10-21)

- **Code change:** lifecycle bootstrap now cryptographically parses configured public keys and rejects non-Ed25519 keys, matching the signature algorithm used by `VerifiedSkillShadowEvidence`. This catches malformed deployment configuration at startup rather than silently configuring a verifier that cannot verify artifacts.
- Added regression coverage for valid Ed25519 keys, incompatible RSA keys, malformed PEM and the empty-key default-deny state.
- **Validation status:** source and test are committed on the existing PR branch; test/typecheck execution is not yet confirmed because the latest Actions runner failures occurred before steps started.
- **Next P0:** wire the real production scheduler to the Core-owned trusted run entry point; provision trusted verifier keys and authenticated approval authority; audit all candidate-store activation paths; obtain actionable exact-head CI/typecheck.

## Latest durable checkpoint — WorkPass142 (2026-10-21)

- **Code change:** `LearningProcessSupervisor.runLearningProcess` now refuses candidate/shadow runs unless trusted registration is provided, closing the direct-call bypass around the Core coordinator. Trusted registration is rejected for baseline/control and other non-shadow lanes.
- Added a regression that attempts a direct unregistered candidate/shadow launch and verifies the child marker is never created. The existing continual-learning workflow already includes this test.
- **Validation status:** source, regression and checkpoint are being committed to the existing WorkPass135–136 PR branch. GitHub Actions and typecheck still need actionable successful results; no local execution or learning uplift is claimed.
- **Next P0:** wire the deployed scheduler's real call site to the Core-owned entry point; configure verifier public keys and authenticated approval; audit candidate-store construction/activation paths; obtain exact-head tests/typecheck.

## Latest durable checkpoint — WorkPass135 (2026-10-21)

- Report: [WorkPass135 durable trusted shadow-run registry](docs/WORKPASS135_DURABLE_SHADOW_RUN_REGISTRY_2026-10-21.md).
- Added `AtomicFileTrustedSkillShadowRunRegistry` for trusted run/task context, with idempotent registration, conflicting-identity rejection, lock/temp-file/fsync/atomic-rename persistence and fail-closed corruption/lock behavior. Added regression source and learning-workflow wiring.
- **NOT VERIFIED:** test/typecheck/exact-head Actions have not yet been observed passing.
- P0s remain: wire registration into the actual execution supervisor and sole skill lifecycle bootstrap; provision trusted verifier keys and authenticated approval authority; audit every activation route; run real outcome-based transfer/retention experiments. PR #12 remains draft/unmerged; do not merge to `main`.


# NeuroCore — persistent project charter and resume contract

## Latest durable checkpoint — WorkPass133 (2026-10-21)

- Report: [WorkPass133 bootstrap sample isolation](docs/WORKPASS133_BOOTSTRAP_SAMPLE_ISOLATION_2026-10-21.md).
- Fixed a subtle reproducibility issue in `VerifiedOutcomeLedger.comparePairedBySeed`: incomplete seed IDs no longer influence the deterministic bootstrap stream for the complete paired sample. Added a regression comparing equal complete samples with/without extra incomplete seed records.
- Research intake refreshed with retention-bench's hard-process-reset distinction and AgentMemoryBench's online/replay/transfer/repair dimensions. Protocols only; no upstream code or datasets copied.
- **NOT VERIFIED:** runtime tests, typecheck and exact-head Actions are still unconfirmed. This pass improves evidence isolation, not measured learning quality.
- P0s unchanged: production trusted-run resolver/key registry/approval authority; complete activation-path audit; meaningful CI logs and actual runner-backed retention/transfer experiments. PR #12 remains draft/unmerged; do not merge to `main`.


## Latest durable checkpoint — WorkPass132 (2026-10-21)

- Report: [WorkPass132 bootstrap-backed learning gate](docs/WORKPASS132_BOOTSTRAP_LEARNING_GATE_2026-10-21.md).
- `VerifiedOutcomeLedger.ts` adds a deterministic 4,000-resample percentile interval over paired seed-level deltas; one-seed comparisons return no bootstrap interval.
- `VerifiedSkillPromotion.ts` now requires positive lower bounds from both the existing Student-t interval and bootstrap interval before an otherwise eligible candidate can pass the seed-clustered gain gate.
- Regressions updated for deterministic output, interval coverage, one-seed uncertainty and bootstrap-backed promotion. Research intake records the limited adaptation from SkillLearnBench, SkillsBench and a storage-aware replay evaluation protocol; no upstream code or benchmark data was copied.
- **NOT VERIFIED:** tests, runtime typecheck and exact-head Actions have not yet been confirmed. This tightens the evidence gate; it does not show learning uplift.
- Remaining P0s: production trusted-run resolver/key registry/approval authority, all store constructors and activation paths, successful exact-head test/typecheck/CI, and real transfer/retention evaluation. PR #12 remains draft/unmerged; do not merge to `main`.


**Canonical project name:** NeuroCore / нейроядро  
**Repository:** https://github.com/ailtron1ss-rgb/NK1  
**Active learning work branch:** `workpass124-learning-evidence-hardening` (draft PR #12, unmerged; stacked on WorkPass123)  
**Primary intent:** build one cohesive, genuinely functional, memory-rich, learning-capable, adaptive digital organism/personality, with Makise Kurisu as the intended identity/persona direction. The historic `Neuro-Kurisu` name in directory paths is lineage, not a separate project.  
**This document is the durable instruction for future work. Read it before starting a new pass.**


## Latest durable checkpoint — WorkPass130 (2026-10-21)

- Read [WorkPass130 trusted-context + restart regression report](docs/WORKPASS130_SHADOW_CONTEXT_RESTART_GUARD_2026-10-21.md).
- `VerifiedSkillShadowEvidence.ts` now exports `createContextBoundSkillShadowEvidenceVerifier`: it checks the signed receipt against the exact candidate, then compares manifest fingerprint and runtime version to an independently resolved trusted execution context; missing/throwing context fails closed.
- The candidate-store regression now covers durable receipt persistence across store reconstruction, rejection when the trusted manifest context differs, and acceptance when context matches.
- Code and regression are committed, but tests/typecheck have not been run successfully in this environment. Do not mark PASS until exact-head workflow logs prove it.
- Production bootstrap/key registry/context resolver wiring and the complete candidate activation call-graph audit remain OPEN. PR #12 stays draft; do not merge to `main`.

## Latest durable checkpoint — WorkPass129 (2026-10-21)

- Read [WorkPass129 signed shadow evidence report](docs/WORKPASS129_SIGNED_SHADOW_EVIDENCE_2026-10-21.md). Signed shadow receipts bind execution evidence to the exact candidate ID/version, payload and proposal fingerprints, run/task, manifest, seed, runtime version, outcome, verifier and timestamp. Candidate store defaults to denying shadow evidence and re-verifies persisted observations before promotion.
- New signed-evidence module/test, npm script and learning workflow step are committed. Tests/typecheck/exact-head CI were not executed successfully in this environment; do not mark them PASS.
- Production trusted-key registry/bootstrap wiring and full activation call-graph audit remain open. Keep PR #12 draft and do not merge to `main`.
- **Chat reconstruction requirement:** retain and operationalize the 2026-10-17 master plan “Нейро Курису — стратегия, архитектура, исходники, исследования и дорожная карта” (previously reported as 17,779 words / 42 pages / 25 sections / 100 P0–P3 tasks). Reconcile it against current NK1 code and WorkPass124–129; historical WorkPass51–54 and archive findings are context, not proof of current implementation. The repo checkpoint is not guaranteed to be a literal full chat transcript. See WorkPass129 report for scope and next steps.

## Previous durable checkpoint — WorkPass127 (2026-10-21)

- WorkPass127 report: `docs/WORKPASS127_PROMOTION_PROPOSAL_AUTHENTICITY_2026-10-21.md`. Candidate staging now requires the exact proposal object issued by the canonical proposal generator in the same process; copied or caller-fabricated public fields no longer satisfy admission.
- Code commits: `225903c6eff87ebe38b83032abff55d52c7bf7a6`, `27a267d541ab8ecfd654424ae3ed368f57c9d0a1`. Lifecycle regression fixtures now build successful proposals through signed, manifest-bound artifact ingestion; copied-object rejection regression: `399225fa696dbd1bb0dabac9efc69cfc0d0056bc`.
- This is an in-process issuance check, not a portable cryptographic proposal signature. Recreate/revalidate proposals after restart from authenticated artifacts. Test execution, typecheck, exact-head CI and the complete activation call-graph audit remain unverified/open. PR #12 remains draft; do not merge to `main`.

## Latest durable checkpoint — WorkPass126 (2026-10-21)

- WorkPass126 implementation report: `docs/WORKPASS126_SKILL_STORE_INTEGRITY_2026-10-21.md`. The durable skill-store adapter now rejects malformed nested active/candidate records, recomputes payload fingerprints/candidate identity, and validates CAS input. Regression cases were added for malformed records and stale payload fingerprints.
- Commits: `1f715143725186dc0c997c4126a2231833f04868`, `62c0d115f4575f745c5b1819dfd6c25bdc2e5aab`, `7351c578e951480c20981835e061798fec0c80ac`, `6d0ea3dc46df1057374fc8acb55cea1334233ba0`, report `be841c46cdf395d437c941aa8961f6c85c86d27a`. Implementation is committed; test/typecheck/CI status is not yet PASS.
- Run the owning failure-boundary test and runtime typecheck next, then resume the promotion-path/call-graph audit. No claim of learning uplift is justified by this persistence fix.

## Previous durable checkpoint — WorkPass125 (2026-10-21)

- Active learning branch: `workpass124-learning-evidence-hardening`; draft PR #12: https://github.com/ailtron1ss-rgb/NK1/pull/12. It is stacked on draft PR #11 / `workpass123-authenticated-skill-lifecycle`.
- Read `docs/WORKPASS126_SKILL_STORE_INTEGRITY_2026-10-21.md` first, then `docs/WORKPASS125_REPOSITORY_SYNC_AUDIT_2026-10-21.md`. It records exact branch heads, rollback anchors, canonical subsystem owners, CI evidence gaps and the safe integration sequence.
- The source stack is based on `workpass70-source`; `main` is a separate 12-path release/metadata branch. GitHub compare reports no common ancestor between `main` and the source stack. Do not merge the source stack directly into `main`.
- WorkPass124 head before this navigation refresh: `372c0bbb4d020901e1c935cf84fc63cff13c9f36`; PR #12 states that its failure-boundary regression has not yet passed CI. The synchronization-audit commit itself has no reported statuses or workflow runs; that is not a pass.
- Refresh the live branch head, stacked PR state and exact-head Actions status before continuing. Keep PRs draft until owning tests and typecheck pass.

## 1. North-star outcome

The goal is not to accumulate modules or produce an impressive architecture diagram. The goal is a single integrated runtime whose capabilities are connected and externally testable:

- A real language model provider path, prioritizing the configured local `llama.cpp` endpoint when healthy and reporting which provider actually generated each answer.
- Persistent autobiographical, episodic, semantic, procedural, social and identity-relevant memory with provenance, time validity, revision, conflict handling, selective forgetting and restart recovery.
- Learning that transfers to unseen tasks and changes future behavior only when supported by verified outcomes; anti-forgetting and interference must be measured.
- Bounded goal-directed behavior with explicit permissions, cost/risk limits, cancellation, action receipts, independently verified postconditions and restart-safe reconciliation.
- Stable behavioral/personality continuity across sessions without treating a persona prompt or self-report as evidence of inner experience.
- Real embodiment integration: UI, browser, voice/TTS interruption, Live2D, lifecycle/reconnect and target-device behavior.
- Maintainable packaging, dependency ownership, reproducible builds, security/privacy boundaries and recovery after process failure.

**Do not claim that consciousness, subjective experience, human-level intelligence, independent agency or a completed digital organism has been achieved without independent evidence.** The project may investigate these questions, but the honest status is UNKNOWN / UNRESOLVED until defensible criteria exist.

## 2. Hard engineering rules

1. **Code-first:** make a concrete change to the owning implementation, not a decorative facade. Every meaningful change needs a regression that would fail before the fix.
2. **One canonical owner per capability:** do not add a second memory store, action gateway, truth ledger, provider selector or duplicate function merely to avoid changing the owner.
3. **No fake progress:** module counts, generated text, deterministic fallback, synthetic fixture results and self-reported scores are not proof of learning or autonomy.
4. **Evidence before promotion:** use baselines, ablations, counterfactuals, independent holdouts, leakage checks, uncertainty intervals and recovery tests. Keep raw per-case outcomes.
5. **Preserve before deleting:** inspect imports, tests, workflows, package scripts, manifests, license/provenance, assets and restore paths. Archive candidates reversibly; never delete because names look similar.
6. **Fail safely:** bounded inputs/outputs, timeouts, cancellation, privacy minimization, deterministic degraded behavior and clear provider/error provenance.
7. **Use real target constraints:** the user's test machine is a Dell G3 laptop with Intel i5 and GTX 1650; mobile deployment must remain mindful of Poco M7 Pro 5G / 8 GB RAM and battery/thermal constraints. Do not claim performance without measuring it on the named device.
8. **Do not silently merge branches:** continue on `workpass79-cognitive-rebuild`; inspect branch history and CI before proposing a merge to `main`.
9. **Report exact evidence:** label findings `PROVEN`, `IMPLEMENTED`, `FUNCTIONAL INDICATOR`, `OBSERVED`, `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED` or `FAILED` accurately.
10. **Skip blockers intelligently:** continue independent work when a device, registry, secret, external service or hardware test is unavailable; record the blocker and exact reproduction steps instead of fabricating results.

## 2A. Research, upstream source and integration mandate

Research is a continuous engineering input, not a documentation-only activity. For each high-impact subsystem and for the organism as a whole, actively examine current and historical papers, benchmarks, open-source implementations, issue discussions, model cards, licenses, reproducible reports and experimental mechanisms—even when approaches appear incompatible.

For each candidate:
1. Record the canonical upstream URL/repository, commit or release, date checked, license, provenance, dependency footprint, hardware assumptions and exact files/functions worth studying.
2. Separate claims into reproduced results, author-reported results, implementation observations, hypotheses and unknowns. Do not treat a paper abstract, README, benchmark headline or source code presence as proof.
3. Compare against NeuroCore's actual owner and failure mode. Map the proposed mechanism to existing code paths, data contracts, state ownership and resource budgets before integrating it.
4. Prefer a minimal adapter or a reversible isolated experiment. Preserve attribution and licenses; do not paste large upstream code without license compatibility and provenance.
5. Write a regression/ablation that tests the hypothesized benefit and failure modes, including latency, memory, privacy, interference, forgetting, recovery and target-device constraints where relevant.
6. Promote only when the candidate beats a same-corpus/same-budget baseline under a declared threshold and does not break invariants. Reject or defer candidates with measured downsides; record why so later chats do not re-run the same dead end.
7. Study integration effects, not only components: memory ↔ learning, language ↔ evidence, planning ↔ action verification, identity continuity ↔ revision, embodiment ↔ timing, and runtime ↔ persistence/recovery.

Research intake is not limited to a predefined list of repositories or architectures. It may include relevant work on recurrent/state-space models, linear attention, fast weights, test-time training, associative memory, retrieval/reranking, continual learning, uncertainty/calibration, causal inference, active perception, planning, multi-agent interaction, event sourcing, durable agents, speech/viseme synchronization and mobile inference. These are search directions, not a mandate to implement every idea. Incompatible mechanisms may coexist as isolated candidates until a fair tournament decides which survives.

Maintain a source-intake ledger with these fields: candidate; upstream URL/revision; license; subsystem; proposed mechanism; expected benefit; known downside; adaptation boundary; test/ablation; result; resource cost; decision (integrate / adapt / research-only / reject); rationale. Keep the ledger linked from the current handover. Never let research volume substitute for functional integration.

## 3. Required start-of-chat protocol

At the start of every new work session, do not ask the user to restate the mission. Instead:

1. Read this file, `AGENTS.md`, current `README.md`, the latest WorkPass handover/evidence ledger, and the most recent relevant changelog entries.
2. Query GitHub for the current branch head and recent commits; do not assume the SHA written in an old handover is still current.
3. Check the latest Actions runs for the active branch and inspect failed job steps/logs before making claims about CI.
4. Read the unfinished-work list and audit its status against actual code, tests, workflow wiring and commits. Mark an item complete only with a verifiable artifact/test/run.
5. Pick the highest-impact, smallest testable unresolved defect; inspect its canonical owner and existing tests before editing.
6. Implement the fix and regression, run focused tests/typecheck and the cross-cutting workflow where possible.
7. Update this repository's handover/ledger with exact commits, tests, outcomes, limitations, rollback notes and the next 3–10 concrete tasks.
8. End a work session with a clean handover so another chat can continue without redoing discovery.

## 4. Canonical navigation and ownership

- `runtime/neuro-kurisu/`: primary organism/runtime implementation.
- `runtime/neuro-kurisu/src/server/server.mjs`: HTTP/server integration and language invocation path.
- `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs`: canonical local-language backend selection/circuit-breaker policy.
- `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`: canonical writable memory store and primary retrieval owner.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` and `MemoryRetrievalExperiment.ts`: offline retrieval evaluation; they must not silently mutate/promote live memory policy.
- `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts` (verify exact path against current tree before use): source of normalized independent postcondition evidence; caller booleans and tool ACKs are not proof.
- `runtime/neuro-kurisu/tests/`: regression and acceptance tests; ensure important tests are actually invoked by CI/package scripts.
- `app/`: client/UI shell; it must not grow a second canonical organism or memory owner.
- `research/`: isolated candidates; `legacy/`: preserved source/provenance; neither is automatically production-ready.
- `docs/WORKPASS75_REBUILD_AND_EVIDENCE_LEDGER_2026-10-19.md`: reconstruction strategy and scientific acceptance gates.
- `docs/RESEARCH_INTAKE_LEDGER.md`: upstream papers/repos, adaptation boundaries, evidence status and the next research tournament.
- `docs/LOCAL_LLM_SMOKE_GUIDE.md`: safe opt-in live `llama.cpp` smoke procedure for the Dell G3.
- `docs/WORKPASS78_HANDOVER_2026-10-20.md`: latest continuation snapshot with recent commits, CI evidence and prioritized unresolved work.
- `docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md`: latest repository surface inventory and unfinished work.

## 5. Acceptance gates — never collapse into one score

- **G0 Reproducible build:** clean install, typecheck, application build, runtime regressions, stable CI.
- **G1 Persistent life:** state survives process death; schema migration, backup/restore, malformed/corrupt state and interrupted writes are tested.
- **G2 Grounded memory:** labelled independent holdout; same-corpus baseline; recall/MRR, stale-fact use, conflict resolution, interference, selective forgetting, provenance and confidence intervals. Do not promote if uplift is zero or leakage is present.
- **G3 Learning:** verified outcomes change behavior; unseen tasks show transfer; no-learning and interference controls quantify forgetting; spoofed/late/duplicate evidence is rejected.
- **G4 Agency:** bounded goals/actions, policy/permission checks, cost/risk budgets, cancellation, external postcondition proof, ACK-loss handling and restart-safe reconciliation.
- **G5 Embodiment:** production browser/mobile E2E for voice, interruption, visibility changes, model assets and actual audio timing.
- **G6 Reliability/performance:** 24–72 h soak, repeated restart/recovery, memory/CPU/latency/error and thermal traces on declared hardware.
- **G7 Identity continuity:** longitudinal held-out behavior, stable preferences, explicit revision of beliefs, autobiographical recall and counterfactual controls.
- **G8 Consciousness:** UNKNOWN / UNRESOLVED absent independent scientific criteria and evidence.

## 6. Open work known at the WorkPass76 start

Treat this as a live queue. Verify branch head and Actions first; do not assume a status is current merely because it appears in this document.

### Recently closed / partially closed (verify exact CI head before relying on it)

- **IMPLEMENTED:** fixed the `invokeLanguage()` timestamp temporal-dead-zone defect; added a regression for timestamp order and actual-response backend attribution. The regression is in the active CI workflow.
- **PROVEN (CI on commit 57215aeda3):** WorkPass76 language-order regression, runtime typecheck and preceding core suite passed in run [39319636214](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319636214). This is not a live HTTP request or real-model inference.
- **PROVEN (CI on commit 23f9b534):** cold-memory residency regression passed in run [39319686397](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319686397).
- **PROVEN (CI on commit 268c127):** cold-memory regression wired into the core workflow and that run passed: [39319849208](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39319849208).
- **IMPLEMENTED:** added current-mode / historical-mode revision and bounded revision-history regressions to the core workflow in commit `b8f144348bb756639c02234f5eb2fd3869607b22`.
- **PROVEN (CI):** `tools/audit-runtime-test-coverage.mjs` passed in [run 39320207064](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320207064): 1,200 runnable test-shaped files, 1,124 directly referenced, 76 unreferenced candidates, 1,647 package scripts, 1,308 explicit references, zero missing paths. The 76 remain review candidates, not confirmed dead tests.
- **UNRESOLVED:** full live server/provider request, local model quality, independent memory uplift, learning transfer and consciousness remain unproven.

### Prioritized open queue

1. Confirm the latest workflow on the current branch head, including the end-to-end fake-provider HTTP test and coverage audit.
2. **IMPLEMENTED, CI PENDING:** `runtime/neuro-kurisu/tests/server-language-http-fake-provider.mjs` starts a real server and local fake provider, then checks actual chat HTTP response, backend attribution, latency and provider request identity. Record its final CI result before treating this path as proven.
3. Add an opt-in live `llama.cpp` smoke test with timeout/cancellation, bounded output and cold/warm latency; execute on Dell G3 when accessible.
4. Run independent RU/EN retrieval holdouts, same-corpus baseline, insertion-order/shuffle controls, leakage checks and uncertainty intervals. Previous `recallDelta=0` blocks uplift claims.
5. Run learning-transfer / anti-forgetting ablations and test fact revision, selective forgetting, interference and evidence provenance.
6. Trace one action end-to-end: accepted action → ACK loss/timeout → process restart → read-after-write → independent postcondition → verified learning credit, with duplicate replay.
7. Complete import/reference graphs for runtime source, tests, scripts, package manifests, assets and licenses; treat unreferenced candidates as review items, not deletion instructions.
8. Run production app build, browser/Live2D/TTS E2E, interruption races and actual audio timing.
9. Run 24–72 h soak and target-hardware measurements; current CI does not prove Dell/mobile performance.
10. Review dependency/license/security posture and ensure generated artifacts are not mistaken for canonical source.

## 7. Work-pass definition of done

A pass is complete only when it records:
- exact defect/hypothesis and why it matters;
- files changed and the canonical owner;
- tests added, including which old behavior they reject;
- focused test/typecheck/CI run links and final status;
- observed behavioral result (or explicit absence of measurement);
- unverified scope and environmental blockers;
- rollback/recovery approach;
- updated remaining-work queue.

**Never write “all tasks complete” while any acceptance gate is open.** Maximize real progress, not the appearance of completion.


## Strategic architecture and long-horizon execution (added 2026-10-20)

Read these living documents in this order after this charter:
1. [Master strategy, architecture interaction map, human-brain analogy, weaknesses, provisional scorecard and release gates](docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md).
2. [1,000-work-unit backlog](docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md). These are planned work units, not completed changes; choose by dependency/risk and split further when needed.
3. [Research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).
4. [Latest handover](docs/WORKPASS78_HANDOVER_2026-10-20.md), refreshed by each work pass.
5. [Repository surface audit](docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md).

### Expanded work mandate

Keep the goal broad and the implementation disciplined. Explore widely across ML, cognitive science, neuroscience, continual learning, memory, causal inference, planning, distributed systems, reliability, human-computer interaction, speech, security and systems engineering. Preserve space for novel hypotheses and incompatible prototypes, but isolate them from production until the evidence gate passes. Do not let a research list become an excuse to postpone integration.

At every session, first inspect the live branch head, current Actions runs, unfinished-work register and canonical source paths. Continue from the highest-impact unresolved item without asking the user to repeat the mission. Make code/test changes when possible; update docs as an audit trail, not as a substitute for implementation. Maintain one owner per mutable capability, require a regression for behavior changes, record negative results, and never claim a feature is release-ready from code presence alone.

The master strategy's scorecard is explicitly a triage estimate, not a benchmark. The 1,000-unit backlog is a planning decomposition, not permission to generate 1,000 modules or tickets without value. The complete live file list, call graph, dynamic test-runner graph, dependency/SBOM, license inventory and asset provenance still must be generated from the actual branch before claiming repository-wide exhaustiveness.

### User's continuation phrase

When the user says “работай над проектом”, “продолжай NeuroCore”, “@GitHub продолжай”, or equivalent: resume the existing NeuroCore mission from live GitHub state, check latest CI, inspect the current handover and backlog, select the next real blocker, implement and test it, commit the work, and update the handover/scorecard/source ledger. Never ask them to re-explain the long-term goal.


**Newest continuation handover:** [WorkPass78 — 2026-10-20](docs/WORKPASS78_HANDOVER_2026-10-20.md). Always check the live branch and Actions before relying on its snapshot.


## WorkPass129 — signed shadow evidence (2026-10-21)
- Report: `docs/WORKPASS129_SIGNED_SHADOW_EVIDENCE_2026-10-21.md`.
- Signed shadow receipt verifier and fail-closed store hooks added; focused regression registered in npm and learning workflow.
- Production trusted-key wiring, successful test/typecheck/CI evidence and activation call-graph audit remain open.

## WorkPass128 — promotion authority boundary (2026-10-21)
- `VersionedSkillCandidateStore` now defaults to deny promotion unless an injected `SkillPromotionApprovalVerifier` confirms an authenticated approval; audit-shaped caller fields alone are insufficient.
- Added a regression proving default-deny cannot mutate the active skill set and adjusted the learning-engine test to reject fabricated proposal objects.
- Report: `docs/WORKPASS128_PROMOTION_AUTHORITY_BOUNDARY_2026-10-21.md`.
- Runtime/typecheck validation and full activation-path audit remain open; do not treat this pass as release-cleared.


## WorkPass131 — upstream-inspired signed evidence binding (2026-10-21)

- **Code:** `VerifiedSkillShadowEvidence.ts` now binds signed shadow receipts to independently trusted `runId`, `taskId`, `seed`, `manifestFingerprint` and `runtimeVersion`, in addition to candidate/version/payload identity.
- **Regression:** durable restart/promotion test rejects mismatches for each of those five context fields; matching context remains the acceptance path.
- **Research adaptation:** narrow design adaptation from the [in-toto Attestation Statement](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) subject/predicate binding model and TUF freshness/rollback principles. No upstream code copied and no new dependency.
- **NOT VERIFIED:** tests/typecheck/CI have not been confirmed successful on the latest branch head.
- **P0 OPEN:** wire the resolver to a trusted supervisor/run ledger, configure the production verifier key registry, wire authenticated approval authority, and audit every store constructor plus every activation path.
- Report: [WorkPass131](docs/WORKPASS131_UPSTREAM_ATTESTATION_BINDING_2026-10-21.md).


## WorkPass136 — production bootstrap for verified skill lifecycle (2026-10-21)

- **Code wired:** `OrganismCore` now configures P23's verified-skill lifecycle during construction with durable candidate persistence and the independent trusted shadow-run registry.
- **Evidence boundary:** signed shadow evidence is checked against a registry record keyed by run/task, with seed, manifest fingerprint and runtime version compared to trusted stored values.
- **Key configuration:** `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON` accepts a JSON object mapping verifier IDs to PEM public keys. If absent, the trusted key set is empty and shadow evidence remains default-deny; malformed configured JSON/key shape fails closed.
- **Promotion:** still default-deny. This pass deliberately does not pretend `approvedBy` is authenticated; a real approval authority must be integrated before any promotion can activate.
- **Supervisor seam:** public internal `registerTrustedSkillShadowRun` and `recordVerifiedSkillShadow` methods now exist on `OrganismCore`. The actual execution supervisor still must call registration before it accepts/produces a shadow receipt; no live shadow runs are claimed.
- **Regression:** `test:p23:verified-skill-lifecycle-bootstrap` is registered in the continual-learning workflow.
- **Verification:** exact-head Actions runs fail before steps start; the jobs have no step output and the logs endpoint returns `BlobNotFound`. This is consistent with the known runner/infrastructure problem, but does **not** prove the code or tests pass. Local typecheck/test execution is unavailable in this pass.
- **Next P0:** connect the real learning/shadow supervisor to `registerTrustedSkillShadowRun` before receipt ingestion; provision trusted verifier keys; integrate authenticated approval; then get an actionable successful CI/typecheck run and audit every store creation/activation path.
