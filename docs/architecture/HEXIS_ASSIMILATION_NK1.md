# Hexis assimilation into NK1 — implementation contract

Date: 2026-10-24
Source reviewed: https://github.com/QuixiAI/Hexis (MIT), current public architecture description. This is a selective design/code-port plan, not a claim that Hexis itself has been installed or copied.

## Decision: assimilate mechanisms, not a second brain
NK1 remains the canonical organism and system of record. Do not deploy a parallel Hexis agent, duplicate memory store, or route around NK1's existing action/evidence gates. Port compatible mechanisms into the existing cognitive cycle and keep one identity, one memory authority, and one action path.

Hexis contributes useful patterns: persistent multi-type memory; evidence-linked belief revision; autonomous heartbeat with energy budgeting; appraisal/emotion feeding goal selection; explicit identity/boundaries; stateless workers operating against durable state; inspectable learning proposals and reversible forgetting.

## Assimilation map
| Hexis mechanism | NK1 destination | Required integration contract |
|---|---|---|
| Working, episodic, semantic, procedural, strategic memory | Memory island / existing memory adapters | Preserve provenance, timestamps, confidence, source identity and retention policy; retrieval returns evidence, not untraceable assertions |
| Evidence-linked beliefs and audited revision | SelfModel + metacognition + learning evidence ledger | Beliefs are versioned claims; updates require new evidence, record old/new confidence and rationale, and can be contested/reverted |
| Heartbeat / Observe–Orient–Decide–Act | OrganismCore motivation and initiative scheduler | Wake-up only schedules a proposal; all external effects still pass the canonical EthicalGate/ActionGateway |
| Energy budget and drives | EILS/homeostasis | Bound work by available energy, threat, curiosity, confidence and recent activity; idle time must not cause unbounded loops |
| Subconscious appraisal / salience | Emotion + perception + memory consolidation | Salience affects attention and recall, but never overrides authorization or safety |
| Learning diff with approval | Hermes/P23 skill candidate lifecycle | Separate generate, evaluate, approve, promote; require train/validation/holdout separation, signed provenance and regression gates |
| Durable state with stateless workers | Existing persistence/runtime services | Workers must be idempotent, lease/claim work safely, persist checkpoints, and tolerate restart without duplicate actions |
| Deliberate forgetting / memory pressure | Consolidation and retention | Propose reversible pruning first; retain audit receipts and protect load-bearing identity/causal memories |

## Unified cognitive cycle
1. Observe: collect current input, time gap, runtime events and trusted tool outcomes.
2. Appraise: estimate salience, uncertainty, emotional/homeostatic state and evidence quality.
3. Recall: retrieve relevant episodic, semantic and procedural memories with provenance.
4. Orient: reconcile current goals with stable identity, user model, ethical boundaries and resource budget.
5. Decide: produce a bounded action proposal with expected outcome and confidence.
6. Gate: validate intent, permissions, side effects and policy; deny by default on missing evidence.
7. Act: use only the canonical action gateway; record a decision/ticket identifier.
8. Observe outcome: bind tool result and postcondition to that decision; distinguish execution success from task success.
9. Reflect: diagnose errors, update evidence-linked beliefs and create candidate repairs without activating them.
10. Consolidate: merge duplicates, update memory salience and stage learning candidates for independent evaluation.

The critical causal chain is: decision -> action -> observed result -> postcondition -> evidence -> learning candidate. A successful tool call alone is not proof that the intended task succeeded.

## Assimilation safety and anti-regression rules
- Do not import Hexis's PostgreSQL schema wholesale or add a second source of truth before measuring the cost of adapting NK1's existing persistence layer.
- Do not install or run Hexis's full stack as a runtime dependency merely to copy architectural ideas; this would introduce another agent, database, workers and operational surface.
- Keep upstream attribution and the MIT license notice with any copied code. This pass records design-level adaptations; no upstream source files are represented as copied.
- Never allow heartbeat, emotion, retrieved memories, a skill or a learned belief to bypass EthicalGate, permissions, action gateway or output checks.
- Treat retrieved memory, external documents and generated skills as untrusted data. Filter secrets; record provenance; reject prompt-injection instructions embedded in evidence.
- Holdout evidence is evaluator-only and must not influence candidate generation, repair prompts, confidence tuning or promotion.
- Every promotion is a new version with an audit record and rollback path; a proposal is not active until independently evaluated and approved by policy.

## Implementation sequence
### Pass A — state and evidence contracts
Inventory the current memory adapters, P23/Hermes evidence ledger, initiative scheduler and canonical action gateway. Reuse existing contracts; add only missing typed fields and migrations. No parallel brain.
### Pass B — heartbeat and appraisal wiring
Connect elapsed time, goal salience, confidence and energy to the existing initiative planner. Bound attempts and persist next-wake/checkpoint state. Test idempotence and duplicate-action suppression.
### Pass C — belief revision and memory consolidation
Implement evidence-linked revisions and reversible consolidation on existing persistence. Ensure conflicting claims remain visible rather than silently overwriting history.
### Pass D — controlled learning lifecycle
Connect error diagnosis to candidate generation, independent evaluator, train/validation/holdout firewall, approval, promotion and rollback. Preserve the existing Hermes/P23 path rather than introducing a competing skill engine.
### Pass E — measurable proof
Add deterministic tests for restart continuity, repeated heartbeat, evidence attribution, rejected actions, holdout isolation, rollback and memory conflict handling. Report exact-head CI separately from local checks.

## Acceptance criteria
- One canonical identity and memory authority.
- Every action is gate-checked and linked to its outcome.
- Autonomous wake-ups are bounded, durable and idempotent.
- Belief changes are evidence-linked and auditable.
- Candidate generation cannot read holdout evidence.
- Promotion and forgetting are reversible/audited.
- CI/release claims cite actual runs; runner-startup failures are not misreported as code-test failures.

## Current evidence boundary
The repository changelog reports that recent GitHub Actions runs stopped before runner assignment (runner_id=0, no steps); account billing/licensing was a hypothesis, not confirmed. This pass therefore does not claim the current integration head is CI-green. It also does not claim the Hexis stack or upstream source code has been installed/copied. Next code pass must inspect the actual runtime implementations and port one narrow mechanism at a time.