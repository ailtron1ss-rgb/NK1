## WorkPass108 — collision-safe paired evaluation and manifest binding (2026-10-20)

- Replaced delimiter-concatenated paired-outcome identity with JSON tuple encoding for `[taskId, seed, attempt]`, so unusual task identifiers cannot accidentally merge independent evaluation cells.
- Added `VerifiedOutcomeLedger.manifestFingerprint()`: a stable SHA-256 digest over sorted, versioned task-manifest fields. It changes when task prompt fingerprints, versions, verifier IDs, family assignments or evaluation splits change, and is independent of manifest insertion order.
- Added regressions for separator-bearing task IDs, exact paired sample count, manifest order stability and digest invalidation after task/version/verifier/split/prompt changes. Wired both tests into the full P23 verified-outcomes suite and the WorkPass108 workflow.
- This digest provides a stable manifest binding token for future verifier-run artifacts. It is not a signature and does not authenticate who generated an artifact; trusted verifier execution, artifact retrieval and production learner integration remain open.
- No replay defaults or automatic promotion changed. Scores remain unchanged until outcome-based benchmark runs demonstrate task success, retention and transfer.

## WorkPass105 — verifier-grounded outcome ledger (2026-10-20)

- Added `VerifiedOutcomeLedger.ts`: versioned task manifests, normalized SHA-256 prompt fingerprints, cross-split duplicate-prompt leakage rejection, version/verifier/evidence provenance checks, self-report rejection, duplicate-attempt protection, and paired baseline/candidate comparisons.
- Paired summaries report sample size, pass rates, absolute gain, discordant wins, and approximate 95% intervals. Pairing is keyed by task, seed, and attempt to avoid comparing mismatched trials.
- Added `tests/p23-verified-outcome-ledger.mjs`, package script `test:p23:verified-outcomes`, and dedicated Node 24 Actions workflow.
- Synthetic fixtures validate the evaluator contract only; they are not evidence of NK1 task performance. The ledger is not yet wired to production training or persistence; no model weights, replay defaults, or skill promotion rules changed.
- Research adaptation: SkillLearnBench's separation of skill/trajectory/outcome evaluation and continual-learning benchmarks' same-sequence comparisons inspired the local verifier-first contract. No third-party code or datasets were copied.

## WorkPass104 — multi-seed replay proxy summary (2026-10-20)

- Expanded the reservoir comparator from five hand-picked seeds to 50 deterministic seeds and added mean, sample standard deviation, and approximate 95% intervals for selection-composition metrics.
- The summary includes historical/post-shift coverage, oldest-stream representation, context/action strata, and mean surprise. Assertions check the reported seed count and interval arithmetic.
- These intervals describe variation between this fixed set of sampler seeds only. They are not task-outcome confidence intervals and do not establish improved learning, retention, or transfer.
- No production policy/default changed; outcome-grounded same-stream evaluation remains the P0 gap.

## WorkPass103 — replay baseline robustness and CI repair (2026-10-20)

- Fixed WorkPass102 workflow setup: `actions/setup-node@v7` enables package-manager caching by default, but this repository has no root npm/yarn lockfile. Disabled package-manager caching for this dependency-free Node 24 harness rather than inventing a lockfile.
- Added a deterministic multi-seed inclusion-frequency regression for Algorithm R. Across 400 seeds it checks that no stream-position inclusion rate deviates grossly from expectation; this is a statistical sanity guard, not evidence of task-learning uplift.
- CI was rerun after the workflow fix; the exact-head run is pending/active at commit `71c3b6a0e631aead7305b8ac28eef66d884a9497` and must not be called PASS until completed.
- The reservoir remains an experimental baseline; no replay default or production training behavior changed.

## WorkPass101 — age-aware replay ablation (2026-10-20)

- Added optional logical-tick half-life discounting to historical surprise priority; the default remains unchanged.
- Made context/action stratum identity collision-safe with JSON tuple encoding and hardened tick ordering for non-finite values.
- Added regression cases for stale high-surprise vs recent moderate-surprise selection, invalid half-life fallback, deterministic output, and delimiter collisions.
- The existing shared selector is still the canonical owner used by runtime and benchmark; this is not a second implementation.
- Evidence boundary: the tests validate selection mechanics only. They do not establish higher task success, better transfer, or reduced forgetting. Keep age discount disabled until same-stream task-outcome ablations justify a setting.

## WorkPass100 — shared configurable continual-learning replay (2026-10-20)

- Extracted the P23 replay selection into `ReplaySelectionPolicy.ts` and wired the runtime to that shared implementation, eliminating the risk that benchmark logic and production selection drift apart.
- Added a typed runtime configuration seam for deterministic ablations. Defaults stay at 64 samples maximum / 32 recent; configured capacity is clamped to 1–64 and recent quota to 0–capacity.
- Added standalone regressions for selector invariants and runtime configuration; expanded the benchmark to compare recent-only, surprise-only, and multi-timescale selection with recent quotas 16, 32 and 48.
- Updated `docs/P23_CONTINUAL_LEARNING_SCORECARD_2026-10-20.md` with current engineering estimates, research comparisons and the evidence boundary.
- Research adaptation: ARB (AISTATS 2026) motivates future policy-alignment-aware replay, but it is not copied wholesale; adding it safely requires verified outcome provenance and controlled task-stream comparisons.
- **Exact tested code head CI PASS:** `891e56f58373377ea6a325552fe2d1e389f6d71b`. [Replay selector + 16/32/48 quota sweep](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421560741), [Node 24 + continual skill learning](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553511), [cognitive runtime regression](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553534), and [verification input binding](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553538) all passed on the same code head. Later scorecard/changelog commits are documentation-only.
- Evidence boundary: selector coverage and synthetic batch composition are implementation evidence only; no independent task-success, retention, transfer or production-learning uplift is claimed.

## WorkPass93 — harden core ownership exemption and add durable checkpoint (2026-10-20)

- Replaced the field-name-only constructor exemption with an exact field + constructor policy: `operationalMicroCycle:OperationalMicroCycleRuntime`.
- Added an executable adversarial regression guard to `audit-core-ownership.mjs`: only the exact documented pair is exempt; a mismatched constructor, renamed field or unrelated owner is counted.
- Added durable continuation/evidence report: [WorkPass93 checkpoint](docs/WORKPASS93_CHECKPOINT_2026-10-20.md).
- Code commits: `8bcffba1511e1327ae71f7500295d31ccffa3c73` (policy module), `ce804abde19ccd20868cd579032431550ca1c35a` (audit integration).
- Validation boundary: exact-head CI for WorkPass93 must be checked before marking this pass validated. The prior WorkPass92 CI run is a baseline only, not evidence for these changes.
- Remaining gates are unchanged: live llama.cpp on Dell G3, independent RU/EN retrieval uplift, learning transfer/anti-forgetting, restart-safe action proof, browser/Live2D/TTS E2E, soak, packaging and release security.

## WorkPass92 — enforce core ownership audit in CI (2026-10-20)

- Wired the existing audit:core-ownership into the regression workflow. The first run exposed a diagnostic defect: it printed PASS before applying the constructor ceiling, then failed. The report now computes the final status after all gates and lists the direct constructor owners.
- The audit showed six direct constructors, including the explicitly documented OperationalMicroCycleRuntime orchestration owner. The ceiling now counts the other five and names the single explicit exception; this is not a blanket increase of the limit.
- Exact-head CI PASS: https://github.com/ailtron1ss-rgb/NK1/actions/runs/39380982918, code head 04f16761704760a6c347a77e113a7a9221b661fe. CORE_OWNERSHIP=PASS errors=0 directConstructors=6 countedDirectConstructors=5 and all other workflow steps passed.
- This is architecture-boundary/integrity evidence, not proof of end-to-end cognitive quality. No global readiness score is increased by the audit alone.

## WorkPass91 — memory-to-action evidence path (2026-10-20)

- Added a deterministic sandbox integration regression that composes the canonical MemoryOS2 current retrieval/revision/snapshot-restore path with the production ActionGateway and its durable idempotency ledger.
- Scenarios cover an explicit preference correction, suppression of the superseded preference, retrieval after memory restore, missing evidence requiring clarification, grounded action arguments, a verified in-memory tool result, and no duplicate execution after restoring the action ledger.
- Wired the regression into the existing cognitive Actions workflow.
- First exact-head run exposed a test-oracle bug: the harness did not check whether the current query matched the memory's topic. The oracle now checks query-topic relevance, and the regression passes without weakening assertions.
- **Exact-head CI PASS:** [Actions run 39380460196](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39380460196), test commit `12ed8ee0029c9c62d5abaef1141d403d68fcc34e`. Log confirms corrected preference retrieved, superseded preference suppressed, snapshot restore works, missing evidence yields `clarify`, sandbox action verified, restored receipt preserves execution ID, and executor count remains 1.
- Evidence boundary: the scenario oracle is test-only, not proof that the live autonomous planner already performs this mapping correctly. All side effects are in-memory; no external tool is called. No retrieval uplift, learning gain, live LLM performance, or consciousness claim is made.

## WorkPass88 — reject silent benchmark-label truncation (2026-10-20)

- Retrieval benchmark reports now count source rows whose IDs, query text, or relevance labels exceed canonical bounds; bounded diagnostic execution is allowed, but `datasetIntegrity.validForPromotion` becomes false.
- Bumped benchmark report schema to v5 and added a regression with 25 relevance IDs, ensuring truncating the 25th label cannot silently authorize promotion.
- Synthetic fixture/harness-only change: no external-data quality uplift is claimed. Exact-head Actions verification is recorded in the handover below.

## WorkPass83 — проверка честности retrieval benchmark (2026-10-20)

- Добавлен `tests/workpass83-retrieval-benchmark-truth.mjs`: фиксированный двуязычный корпус из 12 воспоминаний, 4 train-запроса и 8 holdout-запросов, сопоставление метрик кандидата с Okapi BM25 и bootstrap-конфигурацией.
- Регрессия подтверждает, что offline benchmark не мутирует live MemoryOS2; train/holdout query leakage блокирует promotion; статус promotion согласован с набором gates.
- GitHub Actions run [39372815361](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372815361) — PASS: benchmark test, memory residency, provider policy/boundary, end-to-end cancellation и server HTTP smoke.
- Synthetic fixture получил Recall@3/MRR 1.0 у обеих сторон. Это только проверка harness и не независимое evidence retrieval uplift; наблюдаемая разница равна нулю, качество не повышено.
- Следующий gate — независимый, версионированный RU/EN holdout с заранее зафиксированными relevance labels и сравнением Recall@k/MRR; затем live llama.cpp на Dell G3, process restart/recovery, transfer/anti-forgetting и soak.

---

## WorkPass79 — локальная устойчивость языкового контура (2026-10-20)

- Добавлен отдельный регрессионный набор для канонического `LocalLanguageBackendPolicy`: локальный backend имеет приоритет, ошибка переводит его в cooldown, повторные ошибки увеличивают паузу по ограниченной экспоненте, посторонние сбои не приписываются llama.cpp, успешный ответ сбрасывает breaker.
- Добавлен тест реального интерфейса `OpenAICompatibleLocalChatProvider`: фактическая идентичность модели, bounded max_tokens/temperature, HTTP 503, malformed JSON, пустой ответ, лимит 2 MiB, timeout AbortSignal и запрет не-loopback endpoint/redirect.
- Подключены `test:workpass79:local-language-policy`, `test:workpass79:provider-boundary` и агрегирующий `test:workpass79` в runtime `package.json`.
- Добавлен GitHub Actions workflow `.github/workflows/workpass79-cognitive-regression.yml` для policy-регрессии, границ provider и HTTP smoke существующего серверного пути с контролируемым локальным провайдером.
- Первый Actions run подтвердил policy-тест, но выявил ошибку окружения workflow: Node 22.12 не экспортировал `node:sqlite`, который импортирует сервер. CI обновлён с жёсткого `22.12.0` на актуальную линию Node 22; это устраняет известную причину запуска, но повторный run ещё должен подтвердить результат.
- Это узкий reliability-pass, не заявление об улучшении качества генерации, когнитивном обучении или готовности организма к релизу.

---

## WorkPass72 — memory residency, verification-gated learning and source cleanup (2026-10-19)
- Fixed a candidate-budget off-by-one in revision/graph expansion: both now check the 192-item cap before insertion, with a fail-fast invariant and diagnostic-rich regression assertion.
- Fixed a resource/residency defect in `MemoryOS2.retrieve()`: cold candidates were assigned freshly rebuilt hash vectors and promoted to warm even though the hash similarity was not part of ranking.
- Removed the non-ranking hash-cosine computation from retrieval. The legacy persisted `semanticHits` field remains schema-compatible but is no longer incremented by that misleading proxy.
- Strengthened `p2697-mobile-residency.mjs` to require unchanged vector materialization and unchanged tier counts across a retrieval.
- Expanded GitHub Actions to run the memory retrieval, query-intent, residency, background-index and embedding-privacy regressions.
- Added `AGENTS.md` as the canonical working guide and an exact-hash cleanup inventory. Removed the 21 manifest-listed Live2D shadows from `app/public` after confirming SHA/size parity and automatic hash-verified hydration; 16,690,663 bytes of duplicate tracked payload removed. The remaining 18 exact duplicate groups (39 excess paths) are preserved pending individual reference/provenance review.
- Expanded CI exposed fixed-time fixture errors in numeric and fuzzy retrieval: both seeded 2033 timestamps while calling `temporalMode: 'current'`, which deliberately uses wall-clock time and ignores `asOfAt`. Both tests now use explicit point-in-time mode; a further CI pass is required.
- Gated adaptive memory-policy learning on independently verified delayed outcomes; unverified observations get zero policy reward and do not mutate adaptive policy state; the decision stays pending until independently verified evidence arrives, allowing delayed verification to learn from the original decision. Added separate attempt/resolution diagnostics and regression coverage. Restore discards legacy reward aggregates when snapshots lack verification provenance and safely normalizes malformed counters. CI now includes real semantic-embedding retrieval, cognition-facing semantic integration, delayed policy credit and organism-level policy decision flow.
- Follow-up provenance audit found that replay validation still accepted a caller-supplied `independentVerified: true`; a verifier-issued external-postcondition result is now required, with identity-bound capability checks, late-proof promotion and idempotent causal-credit upgrade. The new regression is committed and awaiting CI.
- This is a residency/resource correctness pass, not a retrieval-quality uplift or production approval. Independent labelled retrieval evidence remains open. The P2684 residency regression specifies that retrieval leaves cold records cold and explicit `get()` owns vector materialization.

---

## WorkPass71 — retrieval benchmark corpus parity (2026-10-19)
- Fixed an evaluation fairness defect: BM25 filtered malformed rows, while the MemoryOS2 candidate previously restored them. Invalid rows could occupy top-k positions in only the candidate arm. Candidate now restores the exact validated corpus used by BM25; malformed/truncated input still blocks promotion.
- Truncated input still fails the corpus-integrity/promotion gate; this change improves diagnostic comparability and does not make truncated evaluation eligible.
- Added regressions for a 1,601-row cap boundary and malformed-row parity, proving both arms see the same valid corpus.
- Added the retrieval experiment regression to WorkPass71 GitHub Actions validation.
- Added `docs/WORKPASS71_HANDOVER_2026-10-19.md` with current ownership/navigation, safe cleanup rules and next work queue.
- No recall uplift or release-readiness improvement is claimed; CI result and independent holdout remain required.

---

## WorkPass 70 hotfix 1 — grapheme timing and continuum timescales (2026-10-19)
- Fixed speech viseme segmentation to use grapheme clusters, while preserving the UTF-16 offsets emitted by browser SpeechSynthesis boundary events.
- Added an explicit exclusive end offset for each grapheme frame; boundary indices inside combining/ZWJ sequences now map to that grapheme rather than the following frame.
- Preserved the original UTF-16 positions across CR/LF/tab runs by replacing whitespace characters individually instead of collapsing the run.
- Fixed a continuum-memory expression precedence bug: nullish-coalescing previously captured the subtraction's right operand, so the expert used fast/medium values rather than the intended fast-minus-medium and medium-minus-slow differences.
- Added regression coverage for combining marks, regional-indicator flags, ZWJ emoji, whitespace offsets and the continuum timescale calculation.
- Scope remains an implementation hotfix. Real browser/Live2D playback timing, Android TTS timing, independent retrieval uplift and production release gates remain open.

---

## WorkPass 69 — keyed physical speech interruption and UI (2026-10-19)
- Removed the duplicate `android.speak` physical executor; legacy calls resolve to the single canonical `organism.device.speak` owner.
- Added `organism.device.speech.interrupt`, a target-bound, idempotency-keyed ActionGateway action. Ambiguous termination remains unknown; an accepted request explicitly does not prove that Android audio is silent.
- Exposed `POST /api/organism/voice/interrupt`, `neuroApi.voiceInterrupt`, and an `Interrupt speech` operator control.
- Extended controlled Termux process concurrency tests and actual server/UI smoke coverage. No-ticket direct speak/listen/turn requests retain approvalRequired behavior.
- Runtime `35.89.0`, schema `225`. Runtime typecheck, TTS tests, server-smoke and UI-smoke pass. Real Android audio, production app build/browser/Live2D E2E, live provider/device and independent retrieval uplift remain open; weighted roadmap stays 80.1%.

---

## WorkPass 70 — unified embodiment intent and speech timeline (2026-10-19)
- Replaced separate parent-to-viewer lipsync, expression and body postMessages with one protocol-versioned `kurisu_embodiment_intent` v1 envelope and a JSON schema. The contract carries stateVersion, speechEventId, audioClockId, phase, audioTimeMs, expression, mouth, gaze, body motion, priority and a target-bound cancellation token.
- Replaced one-word-at-a-time mouth pose changes with a Russian/English grapheme-viseme timeline sampled from one monotonic clock. `SpeechSynthesis` boundary `charIndex` re-anchors text timing, and boundary `elapsedTime` anchors the audio-time clock when available. This remains approximate because the browser API exposes no PCM/phoneme stream.
- Added viewer stateVersion rejection of stale messages, monotonic audio-clock protection, strict cancellation-token binding, and target model reset on ended/cancelled/unknown states.
- Added stale callback guards across new-turn, stop, voice selection changes and iframe remount; a fresh `live2d_ready` handshake replays the current embodiment state into the new viewer instance.
- Added nine regression tests for English/Russian pose classes and viewer message-handler state transitions, UTF-16 boundary indices, monotonic re-anchoring, clock sampling, strict intent validation, stale callback ownership, and schema/channel alignment. The helper passes strict TypeScript checking.
- Scope caveat: this is a deterministic browser speech timeline synchronized to available SpeechSynthesis boundary events, not phoneme-perfect PCM analysis. Production browser E2E, dependency-complete app build, actual Live2D model parameter timing and real Android/Termux audio clock remain open.

---

# Changelog

## WorkPass 67 — 2026-10-19
- Removed the unused direct dependency `@hookform/resolvers`: no active app source imports resolver functions, and the package introduced an unnecessary optional `ajv@^8` peer against the Ajv 6 line needed by ESLint.
- Removed only the resolver and its now-unreferenced `@standard-schema/utils` lock entries; kept ESLint's required Ajv 6 entries intact.
- Added a no-network dependency contract test covering package/lock alignment, absence of stale resolver entries, active-source import scan and SBOM consistency.
- Fixed `install:all` deadline enforcement: timed-out npm process groups are terminated as a unit (TERM, then KILL escalation), and the installer exits fail-fast instead of hanging on descendant-held streams. Added a regression proving the child process does not survive timeout.
- Regenerated SBOM/source provenance and runtime release/architecture/archive manifests for runtime `35.87.0`, persisted schema `225`.
- Registry DNS remains an external blocker for complete `npm ci` and production Vite build; browser/Live2D E2E and live provider/device acceptance remain open.

---

## WorkPass 65 — 2026-10-19
- Tightened archived receipt revision authorization: revision must preserve key/request/execution/tool identity and use a finite monotonic timestamp.
- A reconciled flag alone is no longer accepted as proof: revisions require a bounded provider receipt ID or the explicit authoritative `confirmed-not-executed` terminal state.
- Added regression coverage for evidence-free forged revisions; retained unresolved recovery and restart/replay coverage.
- Release gates remain open; no live provider/device or browser production build is claimed.

# WorkPass 64 — archived receipt reconciliation and recovery retention (2026-10-18)

- Stop spilling unresolved/unverified action outcomes out of the hot ActionGateway ledger. Verified results, explicit no-effect outcomes and authoritative provider-confirmed absence remain eligible for disk archive; if no safe victim exists, admission fails closed before another mutating adapter call.
- Add checksum-protected append-only archive revisions for authoritative reconciliation of a legacy archived unresolved receipt. Revision is permitted only with the same request hash, tool ID and execution ID, and only while the older outcome remains unresolved; verified terminal receipts and identity changes cannot be rewritten.
- Merge archived and hot-ledger metadata into the read-only redacted recovery count/snapshot so legacy unresolved entries remain visible and the newest archived revision overrides stale snapshots.
- Add `workpass64-archived-receipt-reconciliation.mjs` and preserve prior archive, WorkPass63 filesystem lost-ACK, WorkPass62 SIGKILL and WorkPass61 evidence-revision regressions. Bound child-process fault-test execution with process-group cleanup on timeout so a lost close/pipe event cannot hang audits indefinitely.
- Runtime typecheck and focused regression suites pass. This is an implementation pass, not release approval; live provider/device, production UI/browser/Live2D, independent retrieval quality, rollback/license review and soak remain open.

---

# WorkPass 63 — Action uncertainty firewall + real filesystem recovery (2026-10-18)

- Hardened ActionGateway so keyed mutating adapter exceptions and `ok:false` responses without explicit no-effect evidence keep the durable execution pending for read-only reconciliation; trusted adapters can explicitly report `failed-no-effect` or `executed-partial`.
- Unverified/contradicted/partial completed outcomes remain visible in the redacted read-only recovery queue. Reusable skill execution pauses on unresolved postconditions, blocks fallback mutations, and suppresses incorrect skill-repair/learning signals.
- Fixed reconciliation finalization split: a pending-first action with a later authoritative receipt creates one canonical action/outcome/evidence record; receipts arriving after an already-finalized outcome use the existing append-only evidence-revision path.
- Added `workpass63-filesystem-side-effect-recovery.mjs`: separate durable target and provider receipt files; lost ACK after actual target write; new child process restores runtime, reads the provider receipt without re-execution, independently reads target state, retains original `executionId`, and proves one external mutation after replay.
- Runtime typecheck, WorkPass63 uncertainty/skill tests, filesystem recovery E2E, WorkPass61 core-reconciliation regression and WorkPass62 two-SIGKILL suite pass.
- **Not release approval:** the test uses a temporary local filesystem target, not a real remote provider/device; production app dependencies could not be installed because npm registry DNS/network resolution is unavailable in this environment. Browser/Live2D E2E, independent memory holdout, rollback, license review, target GPU profiling and soak remain open.

---

## WorkPass 62 — process-kill recovery and visible ActionGateway recovery queue (2026-10-18)

- Added a read-only, redacted unresolved execution queue in `ActionGateway`, exposed through `OrganismCore`, an authorized API route and Runtime Atlas. It shows reconciliation availability and operation age without exposing raw inputs, key hashes, request fingerprints or provider payloads; it does not retry actions.
- Added a genuine child-process SIGKILL integration: simulated provider accepts a side effect and the process dies before ACK; after restart, read-only reconciliation confirms the state without executing twice.
- Added a second crash window after evidence finalization but before the completed receipt commits. The next process recovers the prior pending receipt, reuses the same execution identity, deduplicates the evidence revision, and eventually commits one completed receipt.
- Verification: runtime typecheck and `test:workpass62` pass. The app typecheck could not run because app dependencies are absent in this environment; production Vite/browser/Live2D E2E and real provider/device checks remain open.
- Runtime `35.82.0` / persisted schema `225`. WorkPass62 is **8/8 scoped code deliverables (100%)**; weighted roadmap rises from `79.3%` to `80.1%` (+0.8 p.p.). This is not release approval.

---

## WorkPass61 — authoritative provider receipt evidence revisions (2026-10-18)

- Added a bounded, append-only evidence revision ledger to OutcomeCognitionFabric for authoritative provider-found receipts; base execution/outcome fingerprint remains immutable.
- Added evidence-revision nodes and supersedes edges to CausalAccountabilityGraph.
- Added sanitized, persistent tool-reconciliation revision events to CognitiveEventFabric without rewriting the canonical action/outcome/evidence trio.
- Wired OrganismCore reconciliation finalization through the revision contract; exact replay deduplicates, changed payloads conflict, and provider side effects are not executed again.
- Preserved revision ledger and trace references across snapshot/restore and state migration.
- Verification: `npm run test:workpass61` PASS. Live provider/device, physical process restart, production UI E2E and remaining release gates stay open.

# WorkPass 61 — 2026-10-18

- Added a dedicated append-only `OutcomeProjectionEvidenceRevision` for authoritative provider-found receipts. A new receipt strengthens or disputes knowledge for the same `executionId` without changing the immutable original outcome fingerprint or receipt record.
- `CausalAccountabilityGraph` now adds deterministic `evidence-revision` nodes and explicit `supersedes` edges; replay of the same provider receipt maps to the existing revision, while the same receipt ID with changed evidence is rejected.
- `CognitiveEventFabric` appends a sanitized `tool-reconciliation` evidence revision parented by the original canonical outcome. The original `tool-action` / `tool-outcome` / `tool-evidence` event IDs and projection hash remain immutable. Revision IDs and events survive snapshot/restore; the bounded revision ledger fails closed rather than evicting idempotency references.
- `OrganismCore.finalizeToolOutcome` routes authoritative provider receipt results through the revision contract rather than calling `OutcomeCognitionFabric.project` with a conflicting changed fingerprint. Provider receipt IDs are stored as hashes in cognition/CEF revision records.
- Added direct replay/conflict/migration coverage and an integration test that starts with an executor failure, reconciles an authoritative `found` receipt, verifies no duplicate execution, and checks durable revision state.
- Runtime bumped to `35.81.0`; schema remains `225`. WorkPass61 closes the previously open code-level provider-found finalization gap. Real provider/device restart E2E and all remaining release gates remain open.
- **WorkPass61: 8/8 scoped code deliverables (100%).** Overall weighted roadmap rises from `78.8%` to `79.3%` for code-path completion only; this does not count as live adapter validation or release approval.

---

# WorkPass 60 — 2026-10-17

- `AutonomousProjectExecutor` now persists a versioned active project-step checkpoint containing project/step/tool identity, request fingerprint, stable operation key, `decisionId`, stage and correlation data. Snapshot schema moved from v6 to v7 with compatibility restore for v6 snapshots.
- `OrganismCore.executeProjectTool` reuses the checkpoint identity on resume, blocks payload changes while a prior side effect is unresolved, and attempts read-only provider reconciliation instead of dispatching the action again.
- Project status exposes a redacted active-operation state without returning the secret-like operation key or request fingerprint.
- `ActionGateway` can request provider reconciliation for a previously completed-but-unverified receipt. Unknown provider status preserves `reconciliation-required`; it is not treated as proof that no side effect occurred.
- Added focused checkpoint and reconciliation-resume tests, WorkPass60 script aliases, current status, progress scorecard, handover and release metadata.
- **Known blocker:** a later authoritative `found` receipt still collides with `OutcomeCognitionFabric`'s changed-fingerprint guard for the same `executionId`. The runtime fails closed; a first-class append-only evidence revision/supersession contract and real provider/device restart E2E remain open.
- WorkPass60 implementation progress: **8/8 scoped code deliverables (100%)**. Official weighted roadmap: **78.8%**. This pass is not release approval.

# WorkPass 59 — 2026-10-17

- Added one shared `wasToolExecutorEntered` contract for outcome classification.
- Pre-execution gate results (`approval-required`, `unavailable`, `policy-refused`, key/receipt failures and uncertain reconciliation) stay in the ActionGateway audit trail without creating false action/outcome cognition, external-trust updates or competence learning.
- Reusable skill repair/aggregate learning is now gated by actual executor entry; unavailable/ambiguous steps create a visible paused trace and do not demote skill competence. Partial replay followed by a blocked step no longer masquerades as a complete replay.
- Project executor failure counters and action benchmark samples are now updated only when the tool executor was actually entered; non-execution blocks are logged separately.
- Runtime bumped to 35.79.0; persisted schema remains 225. WorkPass58 release gates remain open; weighted roadmap score is not inflated.

# WorkPass 58 — composite execution preflight and action lineage (2026-10-17)

- `OrganismCore.executeReusableSkill()` now preflights the full primary/repair/fallback tool candidate set before the first step. A missing or malformed parent idempotency key fails closed before any partial work.
- Stable parent-bound step idempotency keys and per-step `decisionId` values are propagated with host-supplied autonomous attribution, expected output keys and exact resolved execution metadata into the canonical finalizer.
- `executeProjectTool()` validates mutation key requirements before spending project budget and carries normalized execution options through ActionGateway and approval continuation.
- External HTTP project endpoints no longer trust client-supplied `autonomous=true`; preflight rejection is surfaced explicitly rather than implied success.
- Added core integration coverage for preflight, no partial execution, persisted step receipts, stable lineage, keyed replay and no budget spend on rejection. Replaced timer-based memory-index test synchronization with a deterministic provider barrier.
- Added shared `idempotencyPreflightHttpStatus`: an explicitly malformed key returns HTTP 400; an omitted required key returns HTTP 428; unrelated endpoint result codes are left unchanged.
- Runtime is `35.78.0` / schema `225`. WorkPass58 is 100% complete against its 8 scoped deliverables; official weighted roadmap remains 78.0%. Production browser E2E, live provider/device postconditions, independent retrieval uplift, target inference, rollback, nested-source license review and soak remain open.

---

## WorkPass 57 — external outcome truth, durable action keys and late-evidence recovery (2026-10-17)

- **P0 — external evidence:** an `external-postcondition` only counts as verified success when a bounded external observation ID and explicit expected/observed postconditions match. A credible mismatch is preserved as an explicit contradiction and returns `executed-contradicted`; a missing/incomplete postcondition remains unknown. `tool-contract` can never be relabelled as world evidence.
- **P0 — action durability:** derive durable-idempotency requirements from action identity/capability and protected operation class, not only from a legacy `requiresIdempotencyKey` opt-in. Reject unkeyed mutation-like actions before invoking the executor.
- **P0/P1 — causal integrity:** `OutcomeCognitionFabric` stores bounded executionId/fingerprint receipts and deduplicates repeated projections. `CausalAccountabilityGraph` keeps a bounded stable outcome receipt directory so delayed observations can rehydrate the exact outcome after the recent graph ring evicts it. Persist and migrate both indexes.
- **P1 — learning integrity:** permission/approval/unavailable/receipt-infrastructure outcomes are not treated as tool incompetence; unknown late evidence is recorded without negative credit; one contradiction stays as prediction-error evidence, while negative learning requires two distinct high-confidence independence keys.
- **Compatibility:** stale receipt/reconciliation tests now mint exact one-time approvals under the WorkPass53–56 policy before invoking protected actions. Added tests for contradictory postconditions, late evidence after ring eviction/state migration, and replay deduplication.
- **Release metadata:** synchronized `VERSION.json`, `RELEASE_MANIFEST.json`, `ReleaseContract.ts`, root `SUPER_VERSION.json` and the archive manifest to WorkPass57/runtime `35.77.0`/schema `225`. Removed stale nonstandard `scripts` metadata from `package-lock.json`; zero runtime dependencies remain.
- **Evidence:** runtime TypeScript `tsc` typecheck passes; focused WorkPass57, action crash reconciliation, tool receipt integration (9/9), provider reconciliation (5 scenarios), evidence/retired-receipt, background memory indexing and embedding privacy tests pass.
- **Not claimed:** no general memory retrieval uplift (`recallDelta=0`, not promoted); no production Vite/browser E2E or live provider/device-side-effect validation; no clean-room rollback, complete nested-license sign-off or soak. This is an implementation pass, not release approval.

## WorkPass 56 — deferred semantic-index maintenance and provider serialization (2026-10-17)

- Added opt-in, bounded background embedding maintenance inside the existing MemoryFabric maintenance cycle; canonical MemoryOS2 writes never wait for indexing.
- Validates vector count/dimensions/finiteness/nonzero norm, rejects stale content via content hashes, bounds the derived-vector cache, and applies per-memory exponential retry backoff capped at five minutes. Failure leaves canonical lexical/fuzzy retrieval available.
- Serializes background indexing, live cognitive embedding retrieval and explicit Memory Inspector semantic queries through the same provider lane; busy foreground cognition wins, and low-priority maintenance skips active recall windows. Multiple queued inspector queries do not fan out concurrent local model calls.
- Adds redacted aggregate maintenance telemetry to the existing Memory Inspector endpoint/panel.
- Sanitizes common credentials, bearer/API tokens, private keys, email, phone-like values, credentialed URLs and long numeric IDs inside the embedding adapter before caching/transmitting text; this is targeted heuristic minimization, not a universal PII classifier.
- **Source-derived:** adapted the deferred batched-worker/retry pattern from retained Hexis MIT `services/memory_embeddings.py`; no second canonical memory store or SQL backend copied.
- **Open:** local embedding provider and target-host perf not run; broad independent retrieval still `recallDelta=0`; production build/browser E2E, live provider/device receipt loop, exact audio lip-sync, clean-room rollback, full nested-source license review and soak remain open.

## WorkPass 55 — bilingual memory concept bridge and safe orphan approval recovery (2026-10-17)

- Added a safe recovery view to the global Action Approval Center: server-persisted pending tickets without an in-tab continuation are discoverable after load/refresh and can be explicitly declined. Raw original request bodies are never persisted or replayed from an orphan ticket.
- Extended canonical MemoryOS2 retrieval with pre-tokenized English/Russian domain concept groups, typed intent for curiosity/personality/goal/reason questions, and balanced low-weight concept expansion across multiple active topics. Existing original tokens, temporal/epistemic guards, and MemoryOS2/MemoryFabric ownership remain authoritative.
- Improved controlled cross-language paraphrase retrieval and removed repeated alias tokenization from the candidate path. Fixed the candidate-coverage fixture to use explicit historical `at` semantics rather than a wall-clock `current` mode.
- **Not claimed:** the small broad holdout still reports `recallDelta=0`; no general memory-retrieval uplift or algorithm promotion. Production Vite/browser E2E, live provider/device receipts, accurate audio lip-sync, rollback, full nested-source license review and soak remain open. Readiness remains 78.0%.

## WorkPass54 — app-wide approval continuation (2026-10-17)

- Added a global root-level `ActionApprovalCenter` and in-tab continuation broker that waits for owner choice, resolves the canonical ActionGateway ticket, and retries the exact captured JSON-object request once with `approvalId`.
- Sensitive request bodies remain in a closure in the current tab; no local/session storage was added. Decline, expiry, duplicate ticket and failed resolve do not trigger an automatic retry. Malformed/out-of-contract TTLs and non-replayable request bodies are not offered for auto-continuation.
- Removed competing Runtime Atlas resolve controls; adapted the fail-closed approval principle from the retained Hexis MIT source without copying its implicit chat approval exception.
- App/root version 35.0.0-super-workpass54; runtime 35.75.0; schema 225.
- Release status remains implementation-workpass; app build and live browser E2E are not claimed.

## WorkPass 54 — app-wide exact-request approval continuation (2026-10-17)

- **DONE — real UI integration:** added a global Action Approval Center in the root route. Any POST API request that returns a structured `approvalRequired` challenge can suspend its original promise, show only the canonical safe preview, and wait for owner resolution.
- **DONE — exact continuation:** after approval the client calls the canonical permission resolver, then retries the original path and JSON body once with the one-use `approvalId`; changed inputs are not reconstructed from the preview and the body is never persisted to browser storage. Decline or expiry rejects the original call without retrying the side effect.
- **DONE — single resolver UI:** Runtime Atlas remains the read-only server-side queue/history. Removed its competing approve/decline buttons so it cannot resolve a ticket while the originating action is suspended in the global center. Orphaned tickets after refresh are explicitly treated as non-resumable and should expire rather than be approved from stale UI.
- **SOURCE-DERIVED DESIGN:** adapted the fail-closed “no approver means no consent” principle from the retained Hexis `core/tools/policy.py` and `tests/core/test_approval_gate.py` into the existing canonical ActionGateway/client surface; intentionally did not copy Hexis’s implicit CHAT approval exception. Source remains under `legacy/input-archives/hexis-main-2026-10-08/` with its MIT license.
- **PRESERVED:** server remains the only durable permission owner; raw body and request hash are never exposed in approval cards or persisted in localStorage/sessionStorage. Existing IntegrationConsole/ResearchDock can still handle errors if automatic continuation is unavailable.
- **OPEN:** real installed Vite build and interactive browser E2E remain blocked by absent app dependencies in this environment; external provider/device receipts, exact audio lipsync, independent recall uplift, clean-room rollback, complete nested source license review and soak remain open. Overall roadmap stays 78.0%.

## WorkPass 53 — persisted explicit action approvals across execution and direct adapters (2026-10-16)

- Added a canonical ActionGateway approval lifecycle: exact tool/input/operation binding, five-minute expiry, durable pending/approved/consumed state, serialized admission/consumption and one-time replay prevention.
- Protected direct voice speak/listen/turn, chat speech, both modern and legacy outbound transport endpoints, and standalone research bridge subprocess probes. The research bridge fails closed when the runtime approval gateway is unavailable.
- Added an owner-facing Operator Console approval card that shows only a redacted parameter preview and can approve then resubmit the exact captured operation once; Runtime Atlas keeps the cross-surface review queue.
- Extended redaction for bearer tokens, secret query parameters, URL userinfo, email and phone-like values in approval previews.
- Verified focused ActionGateway, bridge unit and live local runtime + Python bridge E2E flows. Production Vite/browser E2E and real provider/device side-effect validation remain open.

## WorkPass 52 — qualified project execution and progress observability (2026-10-16)

- **DONE — project progress integrity:** `AutonomousProjectExecutor.completeToolStep` now reserves an outcome ID only after project/tool/step and research-gate checks pass. Verified tool execution alone is not step completion.
- **DONE — real qualifying attempts:** added persisted `qualifyingAttempts`; only relevant outcomes meeting the required evidence threshold count toward `minAttemptsBeforePromotion`. This prevents a weak result plus one strong result from silently satisfying a two-confirmation rule after restart.
- **DONE — no false progress:** incomplete/underqualified results now return `null` to the `OrganismCore` progression path, so they cannot advance project progress or promote a compound skill. Weak evidence applies bounded backoff and can eventually block the step instead of spinning.
- **DONE — honest learning score:** unqualified outcomes no longer raise project execution fitness or skill-promotion readiness.
- **DONE — persisted state upgrade:** internal project-executor state version is now `6`; old snapshots restore with `qualifyingAttempts=0`, so historical success counters cannot masquerade as independent evidence. Outer organism schema remains `225`.
- **SOURCE-DERIVED GOVERNANCE:** adapts the probation/independent-evidence principle documented in the included NOMEGA Pass16 `skill_governance_v1.py` to the existing TypeScript executor; no second Python runtime or parallel skill governor was added.
- **DONE — runtime visibility:** existing `/api/organism/projects/active` includes a sanitized read-only execution plan with per-step status, required evidence, qualifying attempts, dependencies, blockers and retry tick; `RuntimeAtlas` renders this as a progress panel. No tool inputs/URLs are exposed in this panel.
- **EVIDENCE:** runtime typecheck; qualified-attempt/persistence, receipt idempotency, research gates, compound project DAG and autonomous project-life tests pass.
- **OPEN:** production app build/browser E2E, live provider/device execution, true audio-buffer/phoneme lipsync, broad memory recall uplift (still zero), clean-room rollback, full upstream-license sign-off and soak. Official weighted roadmap stays at 78.0%.

## WorkPass 51 — causal credit, verified episodic outcomes and intent-aware memory retrieval (2026-10-16)

- **DONE — temporal attribution:** n-step temporal return now excludes outcomes explicitly targeted to another `decisionId`; capacity overflow explicitly expires the oldest unresolved decision with zero learning eligibility/confidence rather than silently dropping it. Core application skips expired assignments.
- **DONE — evidence integrity:** positive Reafference requires a declared independent source and `supported`/`corroborated` reconciliation; high model confidence cannot stand in for independence.
- **DONE — memory integration:** independently reconciled exact-decision, non-replayed external outcomes now become provenance-linked episodic facts in the single canonical MemoryOS2 and idempotently update P33 interest evidence. The episode preserves decision/execution/observation links, lineage and expected-vs-observed outcome.
- **DONE — retrieval:** MemoryOS2 adds bounded Russian/English intent-kind/context ranking for event recall, how-to, identity/preferences, goals, causal reasons and factual questions. Controlled identical-lexical fixtures pass.
- **MEASURED LIMITATION:** broad memory benchmark still returns `recallDelta=0`; no retrieval candidate was promoted and no general recall improvement is claimed.
- **EVIDENCE:** runtime typecheck and targeted temporal-targeting, Reafference codec/integration, restart-persistence and query-intent tests pass.
- **OPEN:** real provider/device receipt loop, production Vite/browser/Live2D E2E, phoneme/audio lipsync, target-host inference, independent retrieval holdout uplift, clean-room rollback, nested-source license review and soak. Official weighted roadmap remains 78.0%.

## WorkPass 50 — interest continuity, autonomous runtime loop and embodied dialogue (2026-10-16)

- **DONE — code:** connected P33's sole interest-profile owner to active goals, retained evidence-backed memories, self-authored goals, selected initiatives and explicit thread-linked responses. Positive/engaged feedback gently raises the relevant domain; negative feedback applies a small domain-local correction and never overwrites canonical traits. Feedback evidence IDs are idempotent and persisted with profile provenance.
- **DONE — runtime fix:** autonomous social quiet time and reciprocity now use the user conversation channel rather than treating every cognitive/sensory cycle as an incoming chat turn. This closes a control-flow issue that could keep a spontaneous initiative from reaching generation.
- **DONE — integration path:** a test drives the real `OrganismRuntime` background scheduler through a deterministic provider seam, staged text, UI acknowledgement, explicit user feedback, durable flush and process restart without redelivery. This is a real runtime path test, not a live external-provider test.
- **IMPLEMENTED — body/voice:** `AvatarStage` has opt-in browser/system speech, language/voice selection, cancellation on turn/toggle/unmount and word-boundary-driven approximate mouth shapes. Live2D receives actual mouth form/open, gaze, emotion, thinking/gesture and per-turn motion signals. This is not phoneme-perfect lipsync and awaits production-browser verification.
- **PRESERVED:** canonical MemoryOS2/P33/AutonomousSocialInitiativeEngine owners, schema 225, legacy assets and the four original source archives. No competing personality, memory or scheduler was introduced.
- **OPEN:** production Vite build/browser/Live2D E2E, configured live provider long-idle run, audio-buffer/phoneme synchronization, independent retrieval uplift (still zero), target-host inference, external device receipts, clean-room rollback, full nested-source license review and soak. Weighted release roadmap remains 78.0%; no claim of release readiness or proven subjective consciousness is made.

## WorkPass 49 — unified provider-context privacy boundary (2026-10-16)

- **DONE — code:** applied the same safe-recall filter to persisted recent memories, known-entity facts and world-facts before normal cognitive, self-initiated dialogue and cognitive-proposal prompts. Safe evidence remains available; unsafe stored facts are omitted whole rather than partially rewritten. Direct user input remains a separate explicit interaction channel.
- **DONE — code:** restoration now strips unsafe topics/messages from persisted social initiative state and defers pending work that fails the privacy gate; an unsafe generated unsolicited message cannot be staged for UI delivery and leaves the pending queue.
- **DONE — tests:** expanded queue and prompt regressions cover credentials/email-like data in recalled memory, entity facts, world facts, restored pending initiatives and generated outbound messages; positive controls confirm safe context is retained. Runtime TypeScript typecheck passes.
- **PRESERVED:** canonical MemoryOS2 owner, existing `AutonomousSocialInitiativeEngine`, existing language context budget, schema 225, user source archives, Legacy and Live2D. No new memory owner or parallel privacy subsystem.
- **OPEN:** the filter is still heuristic and does not replace data-classification policy or user consent for cloud providers. Production Vite build/browser E2E, real provider/device loop, audio/viseme synchronization, target-host inference, independent retrieval holdout, clean-room rollback, complete source-license sign-off and soak remain release gates. Official weighted roadmap remains 78.0%; this pass does not claim consciousness or release readiness.

## WorkPass 48 — initiative grounded in memory, goals and current affect (2026-10-16)

- **DONE — code:** extended the existing `AutonomousSocialInitiativeEngine` to rank candidate discussion topics by salience, freshness and source. `OrganismCore` supplies current active goals and evidence-backed consolidated learning memories (pattern, goal-learning and self-model), along with live curiosity/reflection candidates; no separate personality or memory owner was introduced.
- **DONE — code:** connected the existing emotion appraisal snapshot to a bounded, transient conversational tone hint. `LanguageOrgan` uses it only to modulate expression naturally; stable `KurisuCanonProfile` and the existing safety/tool boundaries remain authoritative.
- **DONE — code:** added 14-day semantic near-duplicate topic suppression and removed repeated generic fallback when all supplied topics are stale/duplicates. The engine waits for a genuinely eligible candidate rather than pretending the same topic is a new thought.
- **DONE — prompt privacy gate:** one shared sanitizer rejects credential/medical-secret-like topics, email-addresses and phone/long-number patterns before candidate selection and autonomous recollection enters the language prompt. This is targeted filtering, not a universal PII detector.
- **DONE — social semantics:** UI delivery acknowledgement no longer changes `reciprocity01`. Delivery proves receipt by the client, not that the user reciprocated or liked the message.
- **DONE — test fixes:** extended direct queue/prompt regressions and corrected the legacy personhood test to use valid timestamps and account for the documented `recovery-after-process-gap` narrative episode. Release schema remains 225.
- **EVIDENCE:** runtime TypeScript typecheck; WorkPass48 queue, prompt and trait-salience tests; personhood/runtime-restore integration; social consolidation; server import and UI/API linkage audits; release metadata contract tests pass.
- **OPEN:** provider-backed idle run, app dependency install/Vite production build, browser UI/Live2D E2E, real-device audio/viseme synchronization, provider/device receipts, external retrieval holdout, clean-room rollback, manual license sign-off and soak are not established by this pass. Official weighted roadmap remains 78.0%; this does not assert consciousness or release readiness.

## WorkPass 47 — endogenous dialogue reaches the user-facing chat (2026-10-16)

- **DONE — code:** expanded the existing `AutonomousSocialInitiativeEngine` from a latent social-pressure signal into a durable conversational intent queue. It selects specific topics from active goals and cognitive reflection, tracks quiet-time/cooldown, avoids fake `ambient-network` contacts, and migrates older entries safely.
- **DONE — code:** added a Kurisu-persona, context-budgeted prompt for self-initiated thoughts. The language result is staged as a durable pending message; a small authorized API exposes it and acknowledges delivery exactly once.
- **DONE — UI:** the canonical chat store polls the pending queue at most every five seconds, inserts each message with a stable id, saves it to the browser chat cache, then sends the acknowledgement. Spontaneous messages do not request voice output or activate tools/search.
- **DONE — upstream-informed personality integration:** adapted WILL's graded trait-salience / two-channel concept (source archive license: Apache-2.0) into a small deterministic projection of existing B270 learned traits. Numeric bias remains owned by B270; the same evidence-gated shift is surfaced as a top-K verbal self-observation in normal, autonomous, and cognitive-proposal prompts. Tiny/unsupported drift is excluded; no second persona engine and no state-schema migration.
- **DONE — first embodied response mapping:** avatar gaze/head tilt follow mapped cognitive/emotional state, and per-utterance motion tokens trigger an existing Live2D `Special` movement. Phoneme-level speech synchronization and browser/device E2E remain open.
- **DONE — requirements:** added `docs/NEURO_KURISU_VISION_AND_66_DECISIONS_WORKPASS47.md`, covering all 66 requirements and distinguishing the user's explicit answers from proposed default decisions for unanswered items.
- **DONE — library:** preserved original user source archives byte-for-byte as `/Нейро Курису/Исходники/{one,two,three,four}.7z`.
- **DONE — metadata:** runtime 35.68.0 / schema 225; persisted schema unchanged.
- **OPEN:** real UI/Vite browser run, actual local/host inference, live unsolicited-dialogue observation over a long idle period, state restart E2E, and full device/Live2D E2E have not been verified in this pass. This feature does not establish subjective consciousness.

## WorkPass 46 — deterministic offline Live2D runtime (2026-10-16)

- Removed unpinned CDN script fallbacks from the active app Live2D viewer. Pixi, Cubism Core and pixi-live2d-display now load only from the versioned local assets shipped in the archive. A missing asset becomes a visible Live2D-unavailable condition and preserves the existing Legacy sprite fallback rather than silently executing remote code.
- Added `docs/NEURO_KURISU_66_PROJECT_QUESTIONS_WORKPASS46.md`: 66 distinct, plain-language requirements questions across personality, memory, cognition, autonomy, UI/Live2D and target-device/integration strategy. Answers are intended to guide code priorities, not create a parallel architecture.
- Aligned root/runtime release metadata to WorkPass46 / runtime 35.67.0 / schema 225.
- Scope note: this pass does not claim production Vite build, interactive browser E2E, real-device receipts, target-host inference or release readiness.

## WorkPass 45 — provider reconciliation and canonical physical camera receipts (2026-10-15)

- Added a read-only `ActionGateway.reconcileToolExecution` protocol with explicit `found`, authoritative `not-found`, and `unknown` outcomes. Reconciliation never executes the tool; `unknown` preserves the pending receipt and never becomes negative competence evidence. Concurrent lookups coalesce, and finalization/commit remain owned by the existing ActionGateway receipt flow.
- Added a durable Termux camera receipt sidecar with atomic exclusive creation, strict local permissions, operation/key binding, replay under the same key, conflict rejection, and retained-image SHA-256 verification. A missing local receipt after an ambiguous hardware side effect remains `unknown`, never fabricated as `confirmed-not-executed`.
- Removed camera bypasses: `organism.device.capture` is the canonical `ActionGateway` owner and requires an idempotency key; legacy `android.capture_camera` calls normalize to the canonical ID, while raw `EmbodimentRuntime.captureCamera` fails closed. Autonomous embodied execution and cognition capture both route through the canonical gateway.
- Hardened `/api/organism/vision/capture` to return HTTP 400 before invocation if `Idempotency-Key` is missing. `/api/organism/vision/capture-if-useful` either skips safely or returns an explicit key-required response. The live Node server smoke now covers these HTTP contracts.
- Fixed a pre-existing release-contract mismatch (embedded `35.64.0` vs canonical package `35.65.0`) by aligning runtime package/lock, `ReleaseContract`, `VERSION.json`, `RELEASE_MANIFEST.json`, root `SUPER_VERSION.json`, and `contracts/integration-manifest.json` to runtime `35.66.0`, WorkPass45, schema 225.
- Preserved historical source blobs, single ActionGateway side-effect ownership, MemoryOS2/MemoryFabric memory ownership, Legacy, and Live2D. No retrieval candidate is promoted; measured retrieval uplift remains zero.
- Release gates remain open: the Termux camera is not tested on a real device (receipt tests use synthetic fixtures), and a process crash after camera capture but before local receipt persistence remains unresolved unless the platform exposes authoritative receipt lookup. Dependency-installed Vite build, interactive browser E2E, external provider replay/reconnect, target-host inference, independent retrieval holdout, clean-room rollback, source-license sign-off, and soak remain open.

## WorkPass 44 — replay-safe external evidence and action reconciliation (2026-10-15)

- Made keyed action execution expose a deterministic `executionId`, `decisionId`, and SHA-256-derived provider-facing idempotency token through `ToolExecutionContext`; a pending/uncertain receipt remains reconciliation-required and is never blindly re-executed. This enables compatible adapters to forward stable idempotency to providers but does not prove every provider honors it.
- Changed causal semantics so missing verification is `unknown`, not `contradicted`; only an explicit failed postcondition creates negative evidence. `OutcomeCognitionFabric` keeps original tool outcomes immutable and projects later external evidence separately.
- Connected `OrganismCore.ingestExternalObservation` into `CognitiveEventFabric` as deterministic `external-evidence` nodes with an exact parent outcome, stable observation identity, sanitized/hash-only payload, and restore validation. Conflicting reuse of an execution/observation ID fails closed.
- Added replay protection to temporal credit assignment, external observation assessment/source reliability, external evidence trust, P84 autobiography and behavior-continuity updates, and P83 grounded belief continuity; identical external evidence no longer inflates confidence/reward/revisions after replay or restore.
- Added MemoryFabric Bloom tombstones for retired keys beyond its exact 512-receipt hot ledger; possible reuse of an aged-out mutation key requires reconciliation instead of silently applying a duplicate write. A corrupted tombstone filter fails closed for unknown keys.
- Added crash-injection/restart regressions for pre-effect persistence failure, post-effect/finalizer uncertainty, completed-ledger persist failure, stable executor context, exact replay and key conflict. Typecheck and focused regressions pass individually.
- Preserved one ActionGateway side-effect owner, one MemoryOS2/MemoryFabric write owner, canonical CEF/temporal credit/trust/P84 owners, Legacy/Live2D, and historical source blobs. Root/runtime release metadata aligned to WorkPass44 / runtime 35.65.0 / schema 225.
- Preserved byte-exact pre-WorkPass44 bytes for the three evolved historical source files in SHA-256 content-addressed blobs and redirected 12 compact-manifest/snapshot references; compact archive and historical snapshot checks returned to 8,512/8,512 and 10,427/10,427 after the in-pass mismatch was found.
- Release gates intentionally remain open: real external adapters must prove provider-side idempotency and receipt reconciliation; dependency-installed Vite build/browser Live2D E2E, target-host model inference, independent temporal retrieval holdout (current uplift zero; candidate not promoted), clean-room rollback, manual license sign-off and soak are not certified. Official weighted roadmap score stays 78.0%.

## WorkPass 43 — durable autonomous action receipts and causal restore (2026-10-15)

- Closed the autonomous resource-tool execution bypass: `OrganismCore` now routes the planner through its canonical `executeTool` method and ActionGateway's keyed durable receipt/finalizer path, using a stable per-tick/per-tool intention key.
- Added keyed `tool-action → tool-outcome → tool-evidence` projections to the existing `CognitiveEventFabric`. Replays return original IDs while those nodes are retained; snapshots preserve sanitized receipt nodes beyond the ordinary 96-event window and restore rejects mismatched/dangling replay guards.
- Added failure-closed behavior: unresolved receipts block new autonomous calls and unknown execution state is not learned as a failed capability. Autonomous accounting is deduplicated by `executionId` to repair the checkpoint gap without double-counting.
- External observation correlation now requires the exact `executionId`; tool-name fallback is rejected. `ActionGateway.registerTool` rejects duplicate IDs instead of silently replacing an executor.
- Hardened AvatarStage and Live2D iframe messaging with exact same-origin/source checks, structured payload validation, expression/motion allowlists, bounded numbers and guarded localStorage access.
- Focused WorkPass43 receipt/causal/restore tests: 8/8; runtime typecheck, smoke/restart and prior idempotency/archive regressions recorded in the pass report. App build/browser E2E remain unverified in this environment; the long autonomy suite timed out and is not counted as a pass.
- Runtime release contract aligned to 35.64.0 / schema 225; root release line is 35.0.0-super-workpass43. Weighted release score remains 78.0% because external provider/device receipts, real provider inference, independent temporal retrieval holdout, clean-room rollback, license sign-off and soak remain open.

## WorkPass 41 — 2026-10-14


## WorkPass 42 — source-first archive cleanup (2026-10-14)

- Removed 21 byte-identical app/public Live2D shadows from the compact source tree; dev/build hash-verifies and materializes them from `runtime/neuro-kurisu/public/live2d`, and `assets:clean` removes only unchanged generated copies. App-specific viewer/vendor assets remain.
- Removed two byte-identical Lumina/Letta ZIP aliases while retaining the canonical raw-source archives.
- Removed 27 identical same-relative-path source copies shared by Kurisu v9/v56 and 27 identical forensic/history report copies. The generic path restoration manifest now contains 56 exact-hash entries; the existing 3,873-entry Legacy manifest is preserved.
- Moved 68 historical root reports under `docs/history/workpasses/root-reports/` without changing their bytes; added an indexed file map and one canonical archive-optimization runbook.
- Rebound historical source manifests to exact matching canonical files or immutable blobs; 8,512/8,512 compact-source members and 10,427/10,427 historical snapshot records verify. Ten evolved historical snapshot entries use eight content-addressed old-version blobs.
- Added fail-closed cleanup/restoration commands and tests; changed path deduplication is reversible and refuses symlinks, hash drift and overwrites.
- Release roadmap remains 78.0%. Production Vite build, interactive browser/Live2D E2E, actual external receipts, independent labelled retrieval holdout, clean-room rollback, license sign-off and soak remain open.
- Fix cycle-local causal verification: `CognitiveEventFabric.verifyOperationalCycle` verifies six operational stages by exact ID, stage, same tick and required parent edges; stale dangling links caused by bounded-buffer eviction can no longer poison current-cycle verification.
- Normalize restored cognitive events; ignore duplicate IDs, unknown stages, malformed ticks and non-object payloads, preserving valid historical event IDs and fail-closed causal verification.
- Fix `MemoryRetentionEconomy` decision baseline so net utility, harm/redundancy and provenance directly affect admission even without byte pressure; byte-pressure value-per-byte remains an additional adjustment.
- Add 10 focused cycle-lineage/snapshot assertions and 5 retention-net-value assertions; existing big-pass 162/164, adaptive-memory 2888/2894, memory-substrate equivalence and runtime typecheck pass.
- Align release metadata to root 35.0.0-super-workpass41, runtime 35.63.0, state schema 225. Preserve WorkPass40 and all older records as history.
- Release blockers remain: dependency-installed Vite build and browser Live2D E2E, actual target-model inference, real provider/device receipts and replay, independent temporal retrieval holdout, clean-room fault-injected rollback, nested-source license sign-off and soak.

- Final reconciliation: embedded runtime release contract fixed at 35.63.0 / schema 225, version and phase are covered by regression checks.
- Consolidated 5 identical historical content blobs across snapshot/source archive manifests into a single immutable payload each (31,893 raw bytes).
- Final checks: 8,512/8,512 source members; 10,427/10,427 snapshot records; app scripts 218/218; 34/34 release metadata; 6/6 contract; architecture 0 missing/cycles/Legacy leakage.

## WorkPass 40 — 2026-10-14
- Harden `restoreBackup`: atomically claim `organism-runtime.lock`, verify staged bytes, reject symlink backup members, replace the complete supported state-file set, and roll back staged state after failed commit; regressions cover exact set, path traversal, symlink rejection and lock release.
- Add `tools/super-sbom.mjs` CycloneDX 1.5 inventory for 464 locked npm components and ten embedded source archives; record hashes, declared licenses, archive member counts and repository NOTICE/LICENSE evidence without treating inventory as legal sign-off.
- Add opt-in loopback-only OpenAI-compatible `llama.cpp` chat provider to existing P40 Model Ecology; old snapshots gain the provider profile without replacing user profiles. No model weights bundled and no target-hardware inference claimed.
- Align root/version metadata, runtime package/lock, `ReleaseContract`, `VERSION.json`, `RELEASE_MANIFEST.json`, `SUPER_VERSION.json`, and `contracts/integration-manifest.json` to runtime 35.62.0 / schema 225 / WorkPass40.
- Current WorkPass40 validation: state backup 8/8; SBOM/provenance 1/1; local chat provider/migration tests; runtime typecheck. Production UI build, live llama.cpp inference, real provider receipts and clean-room fault-injected restore remain release blockers.


## WorkPass39 — 2026-10-14
- `ExternalObserverFabric`, `ExternalEvidenceTrust`, and `EvidenceFirewall`: SHA-256 IDs for new evidence while preserving existing stored identifiers.
- `CognitiveNetworkBus`: confidence- and energy-aware utility, invalid/duplicate/restored-signal normalization, bounded affect action prior.
- `OrganismCore`: real emotion/feeling/interoception inputs compete for global attention; salience evidence fusion prevents evidence loss; stale broadcasts cannot affect actions with network disabled.
- `CognitiveArchitectureMap` and Runtime Atlas: read-only 14-system / 22-flow map and live health surface.
- Repaired historical source manifests to immutable SHA-addressed WorkPass38 byte blobs; preserved restoration after current code changes.
- Added upstream reuse review (14 projects/docs); no external code download is claimed because registry/Git DNS failed.
- Runtime 35.61.0 / schema 225. Retrieval candidate remains not-promoted (`recallDelta=0`); Vite build remains blocked by `EAI_AGAIN registry.npmjs.org`.

## WorkPass 39 — cognitive architecture and evidence hardening (2026-10-14)

- Runtime version 35.61.0 / schema 225.
- Added the read-only CognitiveArchitectureMap for 14 existing brain-like systems and 22 directed feedforward/feedback/governance/provenance flows; exposed owners and live composed-system health through `/api/organism/cognitive-architecture` and a readable Runtime Atlas panel.
- New external evidence identities in ExternalObserverFabric, ExternalEvidenceTrust and EvidenceFirewall use SHA-256 over canonical serialized payloads; legacy persisted identifiers are retained on matching records.
- CognitiveNetworkBus utility now incorporates bounded confidence and energy cost instead of merely carrying those fields.
- Added public upstream review for 14 projects/docs and explicit integration/non-promotion decisions; no direct upstream source cloning claimed.
- Focused runtime typecheck and four WorkPass39 tests pass. Production Vite/interactive Live2D E2E, real provider receipts, independent retrieval holdout, clean-room rollback and soak remain open.

# WorkPass 38 — 2026-10-14: indexed durable action archive

- Added an append-only, SHA-256-checked JSONL archive for completed ActionGateway receipts. Each record is fsync'd before hot-ledger capacity is reclaimed; replay loads a receipt from disk by offset while the in-memory index retains only key/request hashes, offsets and record lengths.
- Integrated the archive with file-backed OrganismCore through a validated FileStateStore sibling path and load-before-restore ordering.
- Keyed side effects fail closed when no durable persister exists. Same-key requests reserve their in-flight slot before asynchronous archive lookup; capacity admission is serialized across different keys.
- Removed silent receipt eviction and restore-time snapshot slicing. Conflicting duplicate keys fail closed; incomplete trailing writes are truncated and complete-record corruption is rejected.
- Focused ActionGateway + archive tests: 17/17 pass; runtime TypeScript typecheck passes. Real remote provider receipts, app production build/Live2D browser E2E, labeled retrieval holdout, clean-room rollback and soak remain open.

---

# WorkPass 37 — durable action receipts and verified reafference — 2026-10-13

- Runtime release contract aligned to **35.59.0 / schema 225**; schema 223 and 224 migration regressions cover initialization and receipt preservation.
- ActionGateway now persists idempotency receipts and blocks uncertain replay after an action when durable completion cannot be committed.
- Reusable skill steps and project execution APIs use stable deterministic idempotency keys; key conflict, restore, concurrency and bounded response cases covered by 13 focused tests.
- Verified independent postconditions pass through the canonical ExternalObserverFabric. Temporal credit uses only the exact caller-supplied pending decision ID.
- Retrieval benchmark time semantics are corrected; measured synthetic uplift remains zero and promotion stays disabled.
- Focused runtime typecheck, 13/13 ActionGateway suite, 17/17 WILL suite and schema migration alignment pass. Production Vite/browser Live2D E2E, real provider evidence, independent retrieval holdout, clean-room rollback and soak remain open.
- Full details: `docs/WORKPASS37_REPORT_2026-10-13.md`; source disposition: `docs/INTEGRATION_MATRIX_WORKPASS37_2026-10-13.md`.

---

# WorkPass 36 — consolidation of runtime primitives and immutable source lineage — 2026-10-13

- Reconciled stale `ReleaseContract` metadata with the canonical runtime package/integration manifest (35.58.0, schema 224); schema-223 snapshot migration and metadata agreement are covered by a dedicated regression test.
- Added `UnicodeTokenizer` for Lumina/Conscio with explicit compatibility options: Unicode NFKC, locale-lowercasing and minimum token length stay shared while underscore/hyphen behavior remains layer-specific.
- Consolidated repeated FNV-1a/cosine calculations and identical action-cost constants into shared canonical modules without collapsing non-equivalent distance metrics or experiment-specific costs.
- Consolidated stable serialization and SHA-256 adapter code across WILL, Letta, Lumina, Hexis and Conscio while preserving the legacy fingerprint byte format for persisted identities.
- Bounded MemoryOS2 per-memory revision history to 64 events, sanitized old snapshots and included revision bytes in memory budgeting; preserved legacy source associations as provenance rather than unresolved canonical links.
- Optimized duplicate relation discovery in the memory compatibility coordinator using token postings and exact-content lookup, checked against the prior search behavior.
- Fixed a source-archive provenance bug: mutable active paths are no longer used as the only source of historical bytes. Historical members now restore from immutable SHA-256-addressed blobs, and source archives/snapshot/legacy de-dup manifests verify without missing or changed files.
- Tests at this pass: runtime typecheck PASS; WorkPass36 targeted shared primitives/action costs/indexed memory/revision history/lineage/serialization/tokenizer tests PASS; WILL agency suite 17/17; app script suite 212/212 and release metadata 6/6 at earlier checkpoint; source archive verification 8,512/8,512; historical snapshot 10,427 entries; legacy dedup map 3,873 entries.
- Progress for this implementation pass: 90/100. Weighted release readiness remains 72.9%; full app dependency-installed typecheck/build, browser/Live2D E2E, real model/provider behavior, labelled temporal retrieval holdout and high semantic-function evidence remain open.

---

# WorkPass 35 — WILL pre-arbitration integration and reproducible legacy dedup — 2026-10-13
- WILL competence теперь обучается только на подтверждённых исходах (`verifiedUses`); неподтверждённый `success` не повышает success rate/confidence, а legacy snapshots без verified ledger восстанавливаются нейтрально. Добавлены regressions; WILL bridge suite 17/17, runtime typecheck и organism smoke PASS.

- Moved the bounded WILL agency ranking step before `P69ConstitutionalArbiter.arbitrate()`, fixing the prior ordering where P69 had already selected a candidate before WILL scores were adjusted. P69 still owns final selection and veto policy; WILL has no independent final authority.
- Limited WILL score delta to ±0.04, aligned utility/confidence updates, and corrected diagnostics to retain the true pre-adjustment `base01` and actual applied `delta01`.
- Added an integration regression for baseline/delta semantics and bounded influence. Dedicated WILL bridge suite passes 17/17; runtime TypeScript typecheck passes.
- Removed byte-identical expanded WILL and Neuro-Kurisu 35.30 trees plus exact duplicate dated Lumina/Letta ZIPs. Original source ZIPs are retained. `tools/materialize_legacy_archive.py` checks archive SHA-256 before restoring both trees; restored payloads matched 606/606 and 4,022/4,022 files. Final package is about 200.4 MB versus 230.6 MB for WorkPass34 (about 13.1% smaller).
- Aligned root/runtime version and release metadata to WorkPass35 / runtime 35.58.0 / schema 224. Active application UI, runtime, legacy avatar rendering and Live2D paths were not removed.
- Readiness remains 72.9%; actual local model execution, independent temporal holdout, production browser/Live2D E2E, clean-room recovery/rollback and soak remain open.

---

# WorkPass 32 — typo-tolerant hybrid retrieval for canonical MemoryOS2 — 2026-10-13

- Added a bounded token-level character-trigram index, maintained during encode, forget, capacity eviction and snapshot restore. Query token variants can discover candidates through shared n-grams instead of requiring an exact token posting.
- Replaced the two-list BM25 + hashed-token-vector rank fusion with weighted RRF across BM25, query-token coverage, fuzzy character similarity, entity overlap and graph/temporal relationship support. Zero-score channels no longer assign arbitrary ID-ordered ranks.
- Removed the hashed-token projection from final ranking and redistributed the unavailable semantic channel's fusion weight to real retrieval match quality. Diagnostics explicitly report that no true embedding provider is configured.
- Added English spelling-variant and Russian inflection/spelling regressions, including index maintenance and snapshot restore. Retrieval score fusion passes the existing controlled comparison (8/8 for the fused profile vs 6/7 for the legacy lexical-only alias); the offline multi-seed synthetic experiment remains `not-promoted` and is not evidence of production uplift.
- Runtime TypeScript, fuzzy retrieval, candidate coverage, numeric retrieval, multi-seed experiment, WorkPass31 lifecycle replay, WorkPass30 provenance lineage and HTTP server smoke pass. Independent temporal holdout, true embedding inference, frontend production build and browser/Live2D E2E remain open.

---

# WorkPass 31 — unified canonical memory lifecycle gateway — 2026-10-13

- Routed canonical memory writes, revision/status changes, signal/context updates and forgetting through `MemoryFabric.applyLifecycleCommand`; `MemoryOS2` remains the only writable store.
- Added a bounded, persisted 512-entry mutation receipt journal. Exact retries skip mutation and duplicate events; reusing a command ID for a different payload throws a typed conflict.
- Added stable command receipts for legacy/multi-timescale compatibility ingestion and restore, then routed Hexis and external-research write paths through the same gateway.
- Patched `StateMigrations` to retain and sanitize valid receipts through the normal persisted-state normalization path; malformed receipts are discarded.
- Added `memory-lifecycle-command-workpass31.mjs` covering retry/restore, changed-payload conflicts, compatibility consolidation, no-op updates, forgetting and the journal cap.
- Typecheck, WorkPass29/30 source/lineage regressions and the WorkPass31 lifecycle/migration scenario pass. Release audit, retrieval benchmark, UI build/browser E2E and release durability remain separate/open; no release readiness or retrieval uplift is claimed.

# WorkPass 30 — unified independent-source provenance inside canonical MemoryOS2 — 2026-10-13

- Integrated a bounded `MemoryEvidenceSource` trail into the single canonical MemoryOS2 record: up to 8 visible independent lineage entries plus a 32-key replay guard, included in persistence normalization and memory byte estimation.
- Connected the real `OrganismCore.integrateExternalResearchMemory` path to the EvidenceFirewall/ProjectResearchSession-derived `sourceLineageKey`; publisher/host stays provenance, but syndicated mirrors sharing one lineage count as one source vote.
- Canonical duplicate content from a genuinely independent lineage merges into the existing record; repeated or mirrored ingestion cannot ratchet confidence upward. External material remains hypothesis-only and capped.
- Added an end-to-end runtime integration regression for publisher/mirror/independent source rows, snapshot/restore, bounded evidence history, source-vote accounting, Runtime Atlas inspection and byte-estimate stability.
- Runtime 35.53.0 / schema 224; the existing retrieval benchmark remains at synthetic Recall@5 parity with BM25. This is provenance integration, not a measured retrieval uplift or release sign-off.
- Still open: independent labelled temporal holdout, dependency-complete UI production build/browser Live2D E2E, real pretrained NLI inference and live provider run, clean-room restore/rollback, soak and final RC sign-off.

# WorkPass 27 — MemoryOS2 candidate coverage + true BM25 baseline — 2026-10-13

- Removed the arbitrary 96-ID per-token posting-list cap while retaining the existing 1600-memory corpus bound and 192-candidate query bound. Candidate selection now uses IDF support, matched-term coverage, exact phrase, temporal validity, revision priority, recency/value signals and stable ID tie-breaks.
- Corrected hashed-vector cosine similarity so orthogonal or negatively similar vectors do not receive a free 0.5 semantic score.
- Replaced the benchmark's binary token-overlap comparator with corpus-scoped Okapi BM25 (`k1=1.2`, `b=0.75`). Reports include exact baseline configuration and SHA-256; multi-seed report signatures now bind that fingerprint.
- New 260-record candidate coverage/order-permutation regression passes; runtime typecheck, temporal inspector, R15/R16 memory behaviors, retrieval benchmark, multi-seed experiment and real HTTP server smoke pass.
- Important result: the small synthetic retrieval fixture shows candidate Recall@5 delta -0.25 against BM25 (paired interval [-0.75, 0.25]). Candidate stays **not-promoted**; independent labelled temporal holdout, further ranking improvements and frontend/browser release gates remain open.

---

# WorkPass 26 — temporal MemoryOS2 inspector closure — 2026-10-13

- Fixed `temporalMode=all` to preserve expired/superseded revisions; corrected absent/null `asOfAt` so it defaults to current time rather than Unix epoch.
- Added an isolated, side-effect-free `MemoryOS2`/`MemoryFabric` preview path and routed inspector queries through it.
- Exposed memory query, current/as-of/all-revisions mode, point-in-time and bounded record count in Runtime Atlas; added focused regression coverage.
- Runtime typecheck and targeted memory suites pass. Independent temporal holdout/BM25 comparison, React/Vite build, browser/Live2D E2E and release gates remain open.

---

# WorkPass 25 — version-bound NLI temperature calibration — 2026-10-11

- Added `tools/fit_research_nli_calibration.py`: deterministic scalar temperature scaling over a dedicated labelled calibration JSONL; requires >=50 examples/class, a deterministic group-disjoint train/validation split, explicit dataset source and labeling protocol, fixed dataset SHA-256 and exact serving model identity; output excludes sample text, is private (0600), atomic, and refuses overwrite by default.
- Added strict `KURISU_NLI_CALIBRATION_FILE` loading: artifact schema, class balance, source/label provenance, temperature bounds, NLL improvement eligibility, unpromoted state, model ID and immutable revision must all match. The serving process applies temperature scaling only on explicit opt-in; otherwise scores remain raw.
- Propagated calibration method, dataset hash, sample count and temperature through HTTP response, NLI result, claim atoms/quotes and aggregate model provenance. Mixed calibration identity during one assessment fails closed; restore rejects tampered/inconsistent calibration metadata. Overall claim `calibratedProbability` remains null because class calibration is not a real-world truth probability.
- Added calibration CLI, service artifact, malformed-response, private-output/no-overwrite and restore-tampering regressions; updated WorkPass 25 scripts and aligned root/runtime versions.
- The calibration fitter and contract were tested with a loopback mock service only. Registry DNS prevented downloading/running the pinned pretrained weights, so no real NLI calibration or model uplift is claimed. UI build, browser E2E, temporal memory holdout and release gates remain open.

---

# WorkPass 22 — optional local semantic NLI + claim-level gating — 2026-10-11

- Added an opt-in HTTP cross-encoder NLI backend in canonical runtime with strict endpoint validation, HTTPS requirement outside loopback, redirect refusal, request/response bounds, timeout, no-store behavior and explicit failure-to-unknown handling. The path is disabled unless `KURISU_RESEARCH_NLI_ENDPOINT` is configured.
- Added `tools/research_nli_server.py`, an optional local Python service using `cross-encoder/nli-deberta-v3-xsmall`, plus a separate `research/requirements-nli.txt`; model weights are not bundled with the project and research text is not logged by the service. Scores remain explicitly uncalibrated.
- Added conservative atomic-claim splitting and top-sentence selection. Partial support across a compound claim remains `unknown`; mixed/contradicted claim evidence blocks positive project progress credit. When model-assisted verification is active, positive credit requires at least two independent model-scored lineage families.
- Persisted model identity, raw score triplets, quote offsets and atom assessments with strict restore validation. Added mocked-backend runtime cases, isolated local service contract tests, and a real OrganismCore→HTTP NLI integration fixture covering independent support, mixed evidence and complete service outage.
- Validation: runtime TypeScript; claim evidence (20); lineage (8); semantic NLI path (20, mocked backend); NLI service contract (3, mocked model stack); executor idempotency (5); project research gates. The actual pretrained weights/inference, score calibration and independent holdout have **not** been run here.
- Still open: labelled/adversarial NLI holdout, confidence calibration, live research providers, independent MemoryOS2 temporal holdout, dependency-complete Vite production build/browser E2E, clean-room restore/rollback, soak and release sign-off.

---


## WorkPass 21 — source lineage, syndication control and canonical memory dedup (2026-10-11)

- Added bounded research-source lineage matching: canonical URL normalization, exact extracted-content identity and conservative near-duplicate detection using 5-token shingles with minimum text length and overlap thresholds. Short topical snippets are not merged by subject overlap alone.
- `ProjectResearchSession` reconstructs source lineages on restore rather than trusting persisted labels; the evidence session reports the count of duplicate lineages.
- `EvidenceFirewall` now counts connected publisher↔story-lineage families for external corroboration, blocking multiple domains that republish one story from manufacturing a second independent source. Same-document content-version conflict detection remains intact.
- Canonical MemoryOS2 stores one hypothesis note per source lineage and retains bounded mirror URLs as provenance. Evidence stays hypothesis-only; no semantic entailment or world-truth claim is introduced.
- Added eight source-lineage cases and extended the real `OrganismCore` project-research integration scenario. Runtime TypeScript, claim evidence, lineage, project-research gates and outcome idempotency tests pass.
- Still open: true NLI/semantic entailment, automatic atomic-claim extraction, broader press-release/source genealogy, independent temporal memory holdout, live external provider run, dependency-complete UI build/browser E2E and final release durability gates.

# WorkPass 20 — claim evidence + action receipt integration — 2026-10-11

- Fixed research action mapping so `ActionGateway` no longer drops publisher identity, serving host, fetch timestamp or explicit claim before project-step verification.
- Added claim-scoped exact-text evidence records with stable claim identifiers, support/refute/mixed/unknown verdicts, quote offsets, URL/document identity, page hash, normalized publisher key and retrieval time. The module explicitly refuses to represent exact string matching as calibrated semantic entailment.
- Bound research sessions and MemoryOS2 notes to the canonical claim hash; independent direct support/refute anchors become a visible mixed state. Mixed text evidence now quarantines prior related hypotheses in canonical MemoryOS2 even if different document URLs prevent document-level conflict detection. All unverified external material remains hypothesis-only.
- Fixed autonomous project outcome replay: executor state v5 keeps a bounded persisted 512-ID ledger and associates receipts with exact `executionId`/`stepId`, preventing duplicate and stale outcomes from completing later steps that call the same tool.
- Added an end-to-end Core integration scenario for one-source unknown, two-source textual support, mixed-source quarantine and claim provenance, plus five outcome replay/restart scenarios.
- Aligned root release metadata to `20.0.0-super-final6` and runtime `35.42.0`, synchronized the runtime lockfile, added `audit:workpass20`, and refreshed the normalized task inventory and scorecard.
- Runtime TypeScript, claim evidence cases, external transport/research/firewall/persistence, executor lifecycle/recovery and idempotency suites pass. React/Vite app build, live-provider research, semantic NLI, independent retrieval holdout, browser E2E, rollback drill and soak remain open.

---

# WorkPass 13 — release metadata contract + unified project progress — 2026-10-10

- Aligned root `package.json` version with `SUPER_VERSION.json` (`20.0.0-super-final3`) while preserving implementation-workpass release status.
- Added a root-level `audit:workpass12` alias and a repeatable `audit:workpass13` command.
- Corrected broken install instructions (`npm --prefix app ci`); README and runbook now invoke `npm run install:all`, which runs `npm ci` with the app directory as the actual working directory. Extended the metadata contract test to keep this fix from regressing.
- Added `tools/verify-release-metadata.mjs` to validate version alignment, app/runtime lockfile root identity and dependency consistency, runtime/schema metadata, workpass lineage, changelog/task-list presence and non-release-ready status.
- Added node:test contract tests for a valid fixture, root version mismatch and lockfile drift.
- Reviewed WorkPass 7 scorecard and WorkPass 8–12 reports/tasklists; created normalized, non-duplicated 40-deliverable status inventory: 23 DONE, 8 PARTIAL, 9 TODO.
- Recomputed the fixed-weight implementation scorecard from 63.55% to 67.80% by updating only Memory 2.0 (45%→60%) and transport/replay (20%→40%); this is implementation progress, not release readiness.
- Attempted clean `npm ci` for the UI. It could not complete because registry lookup failed with `EAI_AGAIN`; no dependency-complete UI build or browser E2E is claimed.
- No real-corpus MemoryOS2 uplift or release-ready status is claimed.

# WorkPass 12 — Memory 2.0 confidence-aware review gates — 2026-10-10

- Added an MRR bootstrap non-inferiority gate in addition to the recall-uplift gate; a favorable point estimate is insufficient when uncertainty permits an unacceptable MRR regression.
- Applied the same MRR lower-bound requirement independently to every seed in the multi-seed sensitivity report.
- Exposed an explicit per-gate promotion decision and per-seed failures so reviewers can see all failed conditions. Invalid explicit bootstrap seed values now block candidate eligibility and the effective seed is recorded honestly.
- Made offline JSON report publication atomic and exclusive: flush temp file, publish without overwrite, clean temporary outputs on handled failures.
- Added tests for MRR uncertainty rejection, invalid seeds, CLI report cleanup, no-overwrite, and added `audit:workpass12`.
- Verification: benchmark regression, experiment CLI/regression, runtime typecheck, server import audit (10 checked/0 missing), UI/API linkage (124 routes/48 Atlas surfaces/0 missing) and server smoke all PASS.
- No real-corpus uplift or release readiness is claimed; independent labeled temporal holdout, full UI/browser E2E and clean-room release gates remain open.

# WorkPass 10 — WILL transport contract + channel replay hardening — 2026-10-10

- Bound envelope IDs to canonical request fingerprints; exact repeats return the existing envelope while same-ID/different-request collisions fail explicitly.
- Added a bounded persisted idempotency index and migration-safe snapshot backfill; queue/pending pressure now applies backpressure instead of silently dropping pending deliveries.
- Rejected ACKs for unknown envelopes; detected conflicting ACK outcomes; removed ACKed work from both queue and pending; made replay idempotent and non-recursive.
- Strengthened the Lumina→Will inbound endpoint to validate prior result payloads before replay. Changed-content key reuse and uncommitted/unknown prior outcome now fail closed with HTTP 409.
- Added real HTTP regressions and repeatable `audit:workpass10`. Runtime typecheck, transport/adapter/server smoke, UI/API linkage, import audit, Memory benchmark regression and asset audit passed.
- Does not claim exactly-once remote delivery or release readiness; remote receipts, browser E2E, complete UI build, clean-room recovery and soak remain open.

# WorkPass 9 — external message idempotency contract — 2026-10-10

- Hardened the canonical Conscio peer-message queue: reusing an idempotency key with the same sender, recipient, space, and canonical payload replays the original message; using the same key for a different logical message returns an explicit conflict and does not enqueue a duplicate.
- Hardened the Hexis outbox: blank idempotency keys are rejected, key reuse with changed kind/channel/payload returns an explicit conflict, and existing keys remain deduplicated even after a failed terminal attempt to avoid retry-after-uncertain-delivery duplicates.
- Exposed HTTP 409 for idempotency-key conflicts and HTTP 400 for missing Hexis outbox keys; persisted conflict counters in each existing adapter state.
- Added adapter and real HTTP regressions for canonical JSON key ordering, same-key/different-payload conflicts, missing keys, and replay behavior. Added `audit:workpass9` so this package can be rerun consistently.
- Scope is limited to existing Conscio/Hexis owners; no extra transport, outbox, or delivery owner was introduced.

# WorkPass 8 — memory benchmark evidence integrity — 2026-10-10

- Hardened the existing MemoryOS2-vs-lexical benchmark: duplicate example IDs, repeated normalized queries, train/holdout overlap, duplicated gold labels, unknown relevant memory IDs, malformed examples, and truncated request sets now block candidate eligibility.
- Added explicit dataset provenance (`datasetId`, version, source reference and labeling protocol) as a required evidence gate before a benchmark can mark a candidate eligible for separate review.
- Made dataset/corpus fingerprints and paired query ordering deterministic; added seeded bootstrap confidence intervals for recall@k and MRR.
- Connected bounded seed/sample/provenance options through the existing HTTP endpoint and expanded benchmark/server-smoke regressions. The endpoint remains read-only and does not auto-promote candidates.
- Validation: benchmark regression and runtime TypeScript typecheck pass. Synthetic fixtures are harness tests only; a real labeled multi-seed holdout, complete UI build/browser E2E, recovery and soak remain open.

# WorkPass 6 — agency evidence + reafference — 2026-10-09

- Added a WILL-inspired, bounded `AffordanceField` projection to canonical `OrganismDecisionTrace`; the trace explicitly records that the layer does not influence selection and that `OrganismCore` remains the selector owner.
- Added `ReafferenceEvidenceCodec` to link externally observed postconditions to one exact pending canonical decision; evidence gates distinguish confirmed outcomes from independently corroborated contradiction. Feedback returns through existing `CanonicalTemporalCreditAuthority` and `adaptivePolicy` only.
- Fixed target-specific temporal-credit resolution so a provided `decisionId` cannot credit unrelated pending decisions in the same temporal window.
- Fixed directional contradiction strength for explicit same-field conflicts, preventing lexical mismatch from erasing strong contrary evidence.
- Added five regression tests; they cover candidate projection, exact credit targeting, contradiction accounting, evidence gates and a real core integration including state snapshot/migration/restart persistence.
- Runtime typecheck, integration-workpass, server smoke, WILL 9/9, WILL surfaces 3/3, Lumina 3/3, Hexis, Letta and Conscio targeted integration gates pass.
- Weighted roadmap score updated to 60.0% (+3.0 percentage points); this is implementation progress, not release readiness. Full app build/browser E2E, Memory 2.0 holdout, recovery/rollback and soak remain open.

# WorkPass 5 — agency execution contract — 2026-10-09

- Added a versioned MotorSchema contract with bounded steps, safe identifiers, validated action kinds, prior-step-only bindings, declared output checks, bounded attempts/resource cost and verified-only execution.
- Connected MotorSchema compilation to the existing `ProceduralSkillLibrary`; it does not introduce a second skill database or executor. Execution still uses the canonical `ActionGateway`, postcondition verification and existing procedural-skill promotion rules.
- Extended `ActionGateway` with optional fail-closed availability and competence gates and explicit outcome classes: `unavailable`, `competence-insufficient`, `policy-refused`, `execution-failed`, `executed-unverified`, `executed-verified`.
- Kept policy refusal separate from competence and execution results in the action audit; `OutcomeCognitionFabric` now persists the class for normal, compound-skill and project tool calls. The MotorSchema input validator uses real UTF-8 byte counts, canonical JSON normalization, and fail-closed handling for cycles/non-plain objects. Added `npm run audit:workpass5` plus targeted regression coverage.
- Overall roadmap score is now 57.0% on the weighted scorecard; this is implementation progress, not release readiness. Full typecheck/app build, browser E2E, benchmark holdout, clean-room recovery and soak remain open.

# Hotfix — 2026-10-09

- Fixed a production chat failure where synchronous WILL language-completion telemetry returned `undefined`, but the server attempted to await `.catch()` on that value. Attribution now remains best-effort and cannot invalidate a successful chat response.
- Extended the real HTTP server smoke test to POST `/api/organism/chat` and assert a valid language response.


## 2026-10-08 — Hexis integration

- Added Hexis evidence-based belief revision, source-independence accounting and temporal memory projections.
- Added learning review, retention/forgetting governance and fidelity receipts.
- Added guarded HMX 1.7 portable subject staging/export/import against canonical MemoryOS.
- Added transactional outbox and connector policy/rate/approval gates.
- Added risk-aware execution placement and persistent integration state.
- Added active Hexis Control Center; all current 41 integration API methods have UI coverage with no missing routes or unused methods.
- Excluded credential-bearing Hexis `.env.local` and Gmail OAuth secret JSON from provenance.
- Kept full Hexis PostgreSQL/Agent/Memory/Identity stack out of canonical runtime to preserve single-owner architecture.

# Changelog — 2026-10-08

## WILL integration Pass 2 / project hardening

- Completed the dedicated WILL integration block at 17/17 mechanisms while keeping Neuro-Kurisu as the single canonical organism owner.
- Reworked deterministic vector retrieval into a deterministic HNSW-style graph adapter with measured distance-comparison counts and explicit recall/reduction promotion evidence.
- Added provider/model completion attribution to the persistent WILL integration state.
- Added provider-neutral subject SDK semantics, MCP-compatible JSON-RPC tools/resources, and isolated Discord/WhatsApp/HTTP/MCP/generic channel mapping.
- Added transport replay re-feed, idempotent ACK accounting and tamper-evident record-chain verification.
- Moved WILL integration ownership into OrganismSystemFabric so OrganismCore keeps the canonical ownership boundary.
- Hardened HTTP surface with request rate limiting, payload size enforcement, malformed JSON handling and explicit timeout configuration.
- Expanded server smoke coverage to the WILL SDK/MCP/integrity surfaces.
- Added a version matrix and Pass 2 integration report documenting available Library archives/checksums and the exact source baseline used.
- Restored the live `canonicalSelfAgencyAuthority` bridge expected by the existing self-agency integration test without creating another authority instance.
- Serialized concurrent `FileStateStore` writes per store and corrected the concurrency/P7 test cleanup to await the durable runtime stop boundary.

## Validation

- Runtime TypeScript typecheck: PASS.
- WILL integration tests: 9/9 PASS.
- WILL SDK/MCP/channel surface tests: 3/3 PASS.
- Server smoke: PASS.
- Organism smoke: PASS.
- Integrity audit: PASS.
- Architecture audit: PASS (cycles=0, legacyLeakage=0).
- Core ownership audit: PASS (directConstructors=5).
- Release contract, source-truth and hygiene audits: PASS.
- Full UI dependency/browser gates remain environment-blocked by absent `app/node_modules`; no false PASS is claimed for those release gates.

# Changelog — 2026-10-06

## SUPER internal optimization / integration hardening

- Restored the complete original Grok Workspace `.grok` reference/skills tree in `app/.grok`.
- Reworked canonical UI normalization to remove synthetic zero-filled inner-world and empty embedding projections.
- Wired UI identity traits directly to canonical `neuralGerminalOrganismB270.traitValues`.
- Replaced the Live2D error-state portrait label with an explicit unavailable state; no procedural avatar fallback remains.
- Renamed legacy outfit logic as visual-profile compatibility and restricted it to the 32 real sprite assets.
- Removed an unreachable duplicate `sum3` symbolic expert branch.
- Added repeatable inventory/asset-audit tooling and refreshed integration/version contracts.
- Release excludes generated runtime state, caches, bytecode and dependency trees.

# Changelog — 2026-10-05

## SUPER merge

- Established Neuro-Kurisu 35.40.0 as the single canonical writable organism runtime.
- Converted the Grok Workspace browser organism into archived reference code; the UI now consumes canonical runtime state over HTTP.
- Added canonical `/api/organism/ui-snapshot` integration and backend-driven chat state.
- Added Live2D messaging/embodiment synchronization and local vendor-first loader with CDN fallback.
- Integrated 32 Kurisu v9 sprite frames plus the v9 sprite resolver/outfit catalog and v56 crossfade presentation pattern.
- Reworked Labs to show canonical semantic-world metrics rather than maintain a second browser brain.
- Added P33 identity trait display to the HUD.
- Added a research bridge for NeuroCore V143, NOMEGA Pass20 and DeepCode v21.
- Added ownership and integration manifests plus branch comparison evidence.
- Fixed P38 replication-consistency semantics in Neuro-Kurisu.
- Fixed DeepCode RSSM reshape, Option-Critic batch shape, and BYOL burn-in/action sequence alignment.
- Fixed DeepCode gradient audit timing so gradients are measured before optimizer clearing.
- Added `app/.grok/app-env.json` to restore the Workspace's documented auth-off template contract without introducing secrets.
- Preserved uploaded source archives under `legacy/input-archives/` for provenance.

## Validation

- Neuro-Kurisu runtime typecheck: PASS.
- Neuro-Kurisu smoke/server/P34/P25/P26/P38 and core-ownership audits: PASS.
- NOMEGA selected Pass20/consolidation/evidence tests: 16 PASS.
- NeuroCore V143 tests: 8 PASS.
- DeepCode 300-step CPU smoke: PASS.
- Independent Workspace utility test subset: 189/197 PASS; the remaining failures depend on hidden `.grok/skills/og` reference fixtures that were not present in the source archive.
- Full UI typecheck/build remains environment-blocked by unavailable `app/node_modules` in this execution environment.


## 2026-10-08 — final hardening v2

- Added byte-accurate API body limits and correct 413/400 semantics.
- Added Runtime Atlas read-only UI surface and expanded client wiring audit.
- Removed generated Python bytecode from shipped provenance tree.
- Added release tooling: doctor, install, backup/restore, migrate, schema/version/config migration, SBOM, freeze and final verification.
- Added operational alert thresholds and runtime health guard.
- Added rollback parent metadata and reverse-apply rollback patch.
- Revalidated WILL/Lumina/Hexis integration, persistence recovery and R22/R23/R26 targeted neural/world/memory regression suites.
## FINAL3 — Letta governance + release hardening

- Added Letta-derived source-branch state boundaries: canonical/research/legacy/provenance-only.
- Added configurable telemetry policy with local-only/redaction/export controls.
- Added generated-artifact provenance and human-review promotion gate.
- Added credential-bearing provenance path audit.
- Preserved `letta-main-2026-10-08.zip` as provenance-only source; no Letta runtime/database imported.
- Fixed the final release runner to include Letta governance and HTTP hardening tests.
- Increased input-hardening readiness window to accommodate canonical runtime startup.
- Re-generated archive manifest after all release metadata changes.
- Runtime typecheck and targeted integration/recovery gates pass.


## FINAL4 — 2026-10-08 — Conscio 4.8.2 integration

- Added Conscio-derived FTS5/BM25/trigram/RRF retrieval as an index over canonical MemoryOS data.
- Added evidence-gated skill federation: quarantine → trial → review → promotion, with post-review immutability.
- Added source-state boundaries and provenance-only protection for external branches.
- Added liaison peer pairing, trust/revoke, queued messages, ACK and idempotency-key support.
- Added confidence observations, Brier/ECE calibration and evidence-required supported claims.
- Added Conscio metabolic context advisory layer without granting it action authority.
- Added Conscio HTTP APIs and an active UI Control Console; every Conscio API method is directly reachable from UI.
- Extended the global UI wiring audit to include Letta and Conscio surfaces.
- Hardened global server-smoke with request-level timeout protection and revalidated SERVER_SMOKE=PASS.
- Hardened source-boundary classification so `input-archives` resolves to provenance-only before legacy matching.
- Preserved Conscio source and external-branch provenance under `legacy/input-archives/external-sources`.
- Verified runtime typecheck, WILL/Lumina/Hexis/Conscio integrations, persistence, restart, memory, concurrency and server smoke.

## FINAL4 — Conscio integration and release closure

- Added source archive registry with raw safe archives and sanitized Hexis provenance.
- Added Conscio integration contract and FINAL4 source coverage/release reports.
- Added Conscio UI controls for source boundaries, skill reject/promotion, peer revoke/ACK and claim/calibration operations.
- Hardened Conscio FTS5 query construction against malformed MATCH expressions.
- Hardened Conscio source classification so provenance paths cannot be mistaken for canonical/legacy paths.
- Hardened Conscio skill lifecycle and peer ACK/idempotency behavior.
- Hardened global server-smoke request timeouts to prevent an individual hanging endpoint from stalling the entire smoke suite.

## 2026-10-09 — Canonical HOTFIX_CHAT v20 integration workpass

- Used the supplied `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_HOTFIX_CHAT_v20_2026-10-09.zip` as the base. Changes were ported selectively; older WorkPass trees were not overlaid wholesale.
- Integrated `AdaptiveMemoryStrategyReadout` with canonical MemoryOS retrieval and `PolicyAuthorityLedger` as an evidence-gated advisory signal (absolute action bias capped at 0.03); state and migration support are persisted in the canonical organism state.
- Added read-only `PortableSubjectFidelity` diagnostics over the existing portable-subject contract. The API explicitly does not assert behavioral equivalence.
- Added `ContextBudgetLedger` to both normal and proposal prompt builders, routed external user text through the budgeted user section, and exposed content-free omission receipts via the canonical runtime API.
- Added read-only `/api/organism/memory-strategy`, `/api/organism/subject-fidelity`, and `/api/organism/context-budget`; connected all three to the shared API client and Runtime Atlas. Corrected the sensorium API client/Atlas path to `/api/organism/sensorium/status`.
- Added portable output-path resolution to NeuroCore V143 benchmarks using `NK_NEUROCORE_V143_OUTPUT_DIR`, with project-local evidence as the default.
- Unified backup/restore wrappers around a shared SHA-256-verified helper; restore requires explicit confirmation and will not overwrite while the runtime lock is active.
- Added server-import and API/UI linkage audits, regression tests, root/runtime npm scripts, a server smoke covering the real chat path and new routes, and an updated task list.

### WorkPass 4 verification status

- Passed: integration workpass audit bundle, real HTTP server smoke, organism smoke, WILL integration/surface tests, Lumina, Hexis, Letta governance, Conscio adaptation/UI/server smoke, and NeuroCore portable-path tests.
- Not claimed: complete React/Vite production build, full root typecheck, browser E2E, clean-room upgrade/rollback, long-duration soak, or release-candidate sign-off. The root typecheck is currently blocked by missing `@types/node` and `vite/client` dependencies in this environment.



## 2026-10-09 — WorkPass 7: KnownEntityDossier + Memory retrieval benchmark

- Added `KnownEntityDossier` as a read-only, source-linked projection across the existing WILL bridge, canonical B288 social state, and MemoryOS2; no separate identity, social, or memory owner was introduced.
- Added conservative known-entity prompt context to normal and cognitive-proposal flows via `ContextBudgetLedger`, bounded by freshness/confidence/source-authority and marked as untrusted data rather than instructions.
- Added matched baseline-vs-MemoryOS2 retrieval benchmark with isolated snapshot clones, explicit train/holdout labels, retrieval quality/safety measures, dataset/corpus fingerprints and a non-automatic promotion gate.
- Added bounded `/api/organism/known-entities` and `/api/organism/memory-benchmark` surfaces, frontend client methods, Runtime Atlas linkage and regression tests.
- Verification: `audit:workpass7`, runtime typecheck, targeted regressions, server imports, UI/API linkage, HTTP server smoke and `audit:quick` PASS. The synthetic benchmark fixture validates the harness only; no production MemoryOS uplift or release readiness is claimed.


## WorkPass 11 — MemoryOS2 retrieval experiment reproducibility (2026-10-10)

- Fixed corpus fingerprint coverage: all canonical memory-row fields now affect the SHA-256 fingerprint; rank-affecting policy state has a separate retrieval-configuration fingerprint.
- Removed insertion-order bias at the 192-candidate cutoff: query-term inverse-document-frequency support and stable ID tie-breaks choose the bounded candidate pool; fallback and revision expansion are ordered deterministically. RRF tie-breaking is also stable by memory ID.
- Added corpus integrity checks for malformed rows, duplicate memory IDs and corpus truncation; ambiguous corpus state blocks independent-review eligibility.
- Extended benchmark safety metrics for future-valid, dormant and unsupported epistemic-status results, with fail-closed eligibility gates.
- Added a bounded offline experiment runner for up to 512 independently labelled JSONL examples and multiple paired-bootstrap seeds. It records confidence-bound sensitivity and requires stable retrieval metrics/fingerprints across runs.
- Added CLI regression tests, a reproducible command, and the dataset/provenance/labeling protocol. No real production corpus or uplift is claimed, and candidates are never auto-promoted.


## WorkPass 14 — UI regression isolation and browser baseline enforcement (2026-10-10)

- Isolated app PWA/share-card tests from the real workspace's `site.json` and `public/` assets; all 202 app script tests now pass.
- Browser smoke baseline comparison now detects new error signatures and increased repeated occurrences, even if the baseline already contained unrelated errors.
- Explicit baseline divergence now returns exit code 3; navigation failures (1) and runtime console/page errors (2) retain priority.
- Added root `test:app:scripts` and `audit:workpass14`; release metadata contract resolves current status/scorecard from the active WorkPass build lineage.
- UI dependency installation, React/Vite build, actual Playwright E2E and release recovery remain blocked/unverified in the current environment.

## WorkPass 15 — bounded evidence bus and fail-closed outcome verification (2026-10-10)

- Replaced random RuntimeEvidenceBus event suffixes with monotonic sequence-based IDs and persisted the sequence compatibly.
- Validated evidence kind/tick, normalized causal parent links, detached payloads from callers, and bounded payload depth, key count, array size, string length and total budget.
- Hardened snapshot restore against malformed rows, duplicate IDs, invalid counters and invalid confidence values. Lifetime counters now remain distinct from buffered-window counters in diagnostics.
- Hardened OutcomeVerificationService by giving registered verifiers an isolated immutable copy of action inputs/results, requiring a non-empty receipt ID for external verified observations, rejecting unsupported bases, bounding returned note/postcondition text and failing closed on exceptions/non-serializable context.
- Fixed server-smoke startup polling to use a bounded global deadline, 1s per-probe timeout, child-exit detection and bounded process cleanup; added deterministic poll unit tests.
- Added focused regression suites and root/runtime `audit:workpass15` commands; retained WorkPass 14 and prior historical evidence.
- Verification: runtime tsc, evidence-bus/outcome/reafference/agency/memory regressions, server import audit, static UI/API linkage and Live2D/sprite reference audit pass. Full React/Vite build and actual browser E2E remain blocked by unavailable UI dependencies/network.


- WorkPass 15 follow-up: server-smoke locates the runtime package from `import.meta.url` rather than assuming the shell starts inside the runtime directory; verified from the repository root.

## WorkPass 16 — browser release gate hardening (2026-10-10)

- Browser smoke now fails on required `BRAND WARNING:` items and actual dev/build auth divergence; utility `BRAND NOTE` remains advisory and indeterminate auth probes are explicitly recorded.
- Validates `BROWSER_SMOKE_TIMEOUT_MS` as an integer from 1000 to 180000 ms before launching Chromium.
- Publishes browser smoke JSON verdicts atomically using a private mode-0600 temporary file, fsync and same-directory rename; failed publish preserves the previous verdict and cleans up temporary files.
- Added browser gate/timeout/auth/atomic-write regression tests; app source-only script suite passes 212/212. The bounded `npm run audit:workpass16` gate passes; the independent offline memory experiment is exposed as `npm run audit:workpass16:memory-experiment` after intermittent stalls when nested in long chained invocation. The first over-broad chain exceeded the environment execution window and was narrowed to changed/critical gates.
- Release metadata validator: 34/34 checks PASS; release metadata fixtures: 6/6 PASS. Focused app/browser gate tests: 66/66 PASS; runtime typecheck PASS; memory benchmark PASS and remains not-promoted on synthetic data.
- Release inventory: 51 unique deliverables (34 DONE / 9 PARTIAL / 8 TODO); weighted implementation estimate 68.65%, not release readiness.
- Direct app typecheck fails with missing `@types/node` and `vite/client` (`TS2688`); `npm run build` fails with `spawn vite ENOENT`; `npm ci` did not finish in 120 seconds. React/Vite build and live browser E2E remain open.



## WorkPass 17 — project research and evidence-gated progress (2026-10-10)

- Replaced the project's nominal second observation with the canonical HTTPS research tool; requires external evidence and EvidenceFirewall promotion before the DAG can complete the repeat/consolidation steps.
- Added URL/network-policy/HTTPS/host-allowlist preflight before spending execution budget or retry attempts.
- External EvidenceFirewall promotion now requires at least two independent source identities and two distinct content hashes, preventing mirrored identical bytes from counting as corroboration.
- ProjectResearchSession derives diversity and promotion diagnostics from canonical firewall state after restore.
- Research ingestion now records evidence without directly advancing the active project step; only the executor can complete the planned step. Unrelated tool failures no longer consume the current step retry budget.
- Added real Core + firewall + research + planner regression tests. Focused workpass audit, runtime typecheck, project lifecycle/recovery/scheduler tests, server imports and UI/API linkage pass. External provider and browser UI release gates remain open.


## WorkPass 19 — provenance-bound research memory and publisher identity (2026-10-11)

- Integrated eligible external excerpts into the existing canonical `MemoryOS2` instead of adding a parallel memory owner. Single-source results remain in the bounded project-research session; diversified source/content results become capped-confidence `hypothesis` records, never facts.
- Conflicting/rejected source material moves previously recallable research notes back into quarantine. The Core regression covers one source → independent second source → conflicting repeat, plus persistence across a process restart.
- Publisher identity is now derived from the actual serving hostname and normalized across common multi-label suffixes and multi-tenant hosts. Caller-supplied independence labels are not trusted by the session gate; legacy restored source rows use the same normalization.
- Bounded source URL/title/snippet/content-type/hash/query/time provenance and explicit firewall status survive state migration. Runtime version is 35.41.0.
- `npm --prefix runtime/neuro-kurisu run typecheck` passes in TypeScript compiler mode; the focused research transport suite passes 14 scenarios and the project/Core suite passes, including persistence.
- This is not semantic claim verification: source diversity remains weaker than entailment. Live external provider execution, production UI build, browser/Live2D E2E, clean-room rollback and soak remain open.


## WorkPass 18 — DNS-pinned, query-bound external research (2026-10-10)

- Replaced unpinned global `fetch` with a bounded HTTPS transport that pins each request to a vetted DNS address, validates TLS against the original hostname, rechecks every redirect and enforces content-type/byte limits.
- Expanded public-address checks for IPv4 special-use ranges and non-global IPv6; mixed public/private DNS answers fail closed. DNS resolution has its own deadline.
- Required a specific research query (three or more distinct topic terms), added a deterministic query fingerprint and a lexical content-relevance gate. Query hash scopes the `ProjectResearchSession`/firewall claim; unrelated or low-relevance pages are not ingested as external evidence.
- Added 13 deterministic transport/relevance regressions and updated `audit:workpass18`. Runtime semantic TypeScript and project-research regression suites pass.
- Live outbound research was not validated in this environment: DNS resolution for `example.com` returned `dns-resolution-failed`. This pass does not claim production external-provider success or semantic entailment validation.


## WorkPass 23 — safe batched NLI + holdout evaluator (2026-10-11)

- Pin local `cross-encoder/nli-deberta-v3-xsmall` to immutable commit `a150876415327c80daeff35ca6f68f5ed8cf5c24`; refuse mutable revision aliases, disable `trust_remote_code`, require safetensors and validate exactly three expected labels.
- Add `/v1/nli/batch` (up to 24 pairs) and canonical `ResearchSemanticEntailment.evaluateBatch` integration, reducing per-document HTTP/tokenizer overhead while preserving single-pair backend compatibility.
- Bound NLI service worker concurrency, return retryable 503 under overload, and cap PyTorch thread count.
- Add `tools/evaluate_research_nli.py` for a labelled JSONL holdout: stable input hash, confusion matrix, accuracy/macro-F1, per-class precision/recall/F1, cross-entropy, Brier and ECE; private atomic report excludes source text and remote endpoints require opt-in.
- Deterministic integration coverage: 20 mocked semantic NLI cases; 9 NLI service tests; 4 evaluator CLI/metrics/privacy tests; runtime TypeScript check passes.
- Added conservative high-overlap token-trigram detection for near-identical train/holdout queries; tiny edits no longer bypass exact-query leakage checks. Aggregate diagnostics do not store query text, and the benchmark still refuses promotion without a genuine independent holdout.
- Preserved backward compatibility with older single-only NLI services: only HTTP 404/405 on `/batch` triggers bounded single-pair calls; 503, timeout and malformed responses remain fail-closed without request fan-out.
- Runtime is `35.46.0`; root version is `23.0.0-super-final10`. Runtime and root release gates pass. Real pretrained inference and UI build remain unconfirmed because registry DNS is unavailable; no model quality uplift or release readiness is claimed.


## WorkPass 24 — NLI readiness and provenance consistency (2026-10-11)

- Separate process liveness from model readiness with `/livez`, `/healthz` and `/readyz`; readiness remains 503 until the model is loaded.
- Add a sanitized cooldown after dependency/model-artifact load failures. With `--lazy-model-load`, the process can be supervised while loading happens in a bounded background attempt; default startup remains fail-fast.
- Persist model revision from the local NLI HTTP response into atom/quote/aggregate claim evidence. Refuse evidence assessment if the serving model identity changes mid-assessment.
- Validate persisted NLI model ID/revision consistency during research-session restore, rejecting mismatched semantic quotes while retaining compatibility for old snapshots without version metadata.
- New coverage: 23 semantic NLI cases, 10 Python service tests, 4 evaluator tests; research Core gate and memory benchmark pass. All model tests use controlled/mock inference. Real pretrained inference and UI build remain open due blocked DNS/dependency installation.


## WorkPass 28 — single-digit numeric retrieval correction (2026-10-13)

- MemoryOS2 now retains standalone single-digit numeric terms; status codes and one-digit measurements no longer disappear before candidate selection. Single-letter words remain excluded.
- The BM25 comparator uses the same numeric tokenization contract; retrieval configuration fingerprint explicitly captures the algorithm/tokenizer version.
- Added English/Russian numeric retrieval and temporal-expiry regressions. `typecheck`, candidate coverage, retrieval benchmark and multi-seed experiment pass.
- Corrected synthetic fixture is at Recall@5 parity with BM25 (1.00 vs 1.00; delta 0.00). WorkPass27's -0.25 result was confounded by omitted single-digit terms; no general uplift is claimed and promotion remains blocked pending an independent labelled temporal holdout.


## WorkPass 29 — глубокая интеграция Memo × MemoryOS2 × Hexis (2026-10-13)

- Исправлено восстановление canonical content indexes: после загрузки snapshot активная/последняя revision выбирается по временной валидности, статусу, revision sequence и observation time, а не по случайному порядку строк. Возврат к прежней формулировке больше не заставляет старую expired-строку перехватывать `contentIndex`.
- `reviseContent` стал lineage-aware: одинаковый текст — no-op без self-supersede; изменённый текст получает стабильный ID в контексте цепочки и revision sequence, даже если такая формулировка ранее встречалась. Коррекция, вызванная по historical ID, направляется на актуальный tip той же цепочки.
- Повторное наблюдение для content, существующего только в expired/historical состоянии, не перезаписывает historical ID и его validity boundary.
- Добавлены read-only `MemoryOS2.temporalAt()` / `temporalDiff()`. Hexis temporal lookup/diff теперь проецирует canonical MemoryOS2 timeline; собственные Hexis temporal rows остаются audit/export projection, не источником истины.
- Исправлены выборки Hexis: Memory Index отдаёт актуальные записи, синхронизация ограничивает и упорядочивает недавнюю историю, а default learning review берёт до 12 самых недавно затронутых live memories вместо старейшего хвоста newest-first списка. Explicit memory IDs остаются доступными для ревью истории.
- Починен dedup-index при вытеснении/forgetting: после удаления старой записи ключи повторно выбирают лучшую из оставшихся записей, а не стирают ссылку на актуальный дубль. Добавлен регрессионный сценарий заполненного корпуса на 1600 записей, где вытесняется истёкшая копия.
- Добавлен `tests/memory-source-integration-workpass29.mjs` с regressions для snapshot/restore, повторного использования старой формулировки, no-op revisions, переизвлечения expired content, безопасного индексирования после capacity eviction, canonical Hexis temporal delegation и отбора свежих элементов на ревью.
- **Проверки:** runtime typecheck, temporal inspector closure, candidate coverage, numeric retrieval, R15/R16 behavior и integration regression проходят. Внешний root audit и production browser/Live2D E2E проверяются отдельно; этот проход не утверждает release readiness или retrieval-quality uplift.
- **Открыто:** независимая labelled temporal holdout против BM25, React/Vite production build и browser E2E, real NLI inference, clean-room recovery/rollback, soak и release sign-off.


# WorkPass 33 — local semantic embeddings in canonical retrieval — 2026-10-13

Added an optional local embedding provider (Ollama and llama.cpp/OpenAI-compatible APIs), bounded model-keyed caching and progressive indexing, semantic candidate ranking in MemoryOS2, explicit Runtime Atlas toggle and fallback diagnostics. Canonical MemoryOS2 remains the only memory owner; provider failures fall back to deterministic BM25/fuzzy/graph search. Real local model inference and independent temporal holdout uplift remain open. Runtime version 35.56.0; root package 33.0.0-super-final19.

## WorkPass 34 — latency-bounded semantic retrieval in the cognitive cycle (2026-10-13)

- Connected the optional local embedding retrieval path to the ordinary `OrganismCore.observe` flow through `MemoryFabric`; semantic hits now feed the memory rows used by cognitive decisions when explicitly enabled with `NK_EMBEDDINGS_RUNTIME_ENABLED=1`.
- Kept BM25/fuzzy retrieval as the immediate canonical fallback. Foreground semantic wait defaults to 220 ms and is configurable between 50 and 1000 ms; indexing is capped at 12 document vectors per request.
- Added a single-flight guard so slow Ollama/llama.cpp requests do not pile up on successive turns. A timed-out foreground attempt falls back immediately while its one bounded indexing job can finish warming the derived index.
- Added total provider-batch deadlines so the configured timeout covers every chunk, not each chunk independently.
- Added WorkPass34 integration coverage for live semantic ordering, timeout fallback, provider failure and concurrency bounds. The fixture does not claim real model inference or retrieval-quality uplift.

## WorkPass 66 — reproducible dual-workspace installation and release contract (2026-10-19)

- Fixed `npm run install:all`: it now validates and runs lockfile-clean `npm ci` for both `app/` and `runtime/neuro-kurisu/`, rather than installing only the app. Registry retry/fetch and overall deadlines are bounded; the first workspace failure is explicit and fail-fast.
- Runtime typecheck now prefers the compiler installed under the canonical runtime/app lockfiles before falling back to global `tsc`; syntax-only fallback remains explicitly labelled.
- Fixed an existing release contract break found by rerunning the actual gate: WorkPass65 `VERSION.json` and runtime package said `35.85.0 / WorkPass65`, but `RELEASE_MANIFEST.json` and `RELEASE_ARCHIVE_MANIFEST.json` still said `35.84.0 / WorkPass64`. Bumped runtime to `35.86.0 / WorkPass66` and regenerated manifests.
- Added 4 install-orchestration tests plus pinned-compiler selection regression. App scripts remain 218/218 and browser-smoke comparator contract 51/51.
- Registry DNS cannot resolve `registry.npmjs.org` in the current environment. The locked app dependency install and production build remain blocked; no live provider/device or browser/Live2D E2E is claimed. Official weighted roadmap remains 80.1%; release gates remain open.

## WorkPass 68 — canonical TTS gateway and ambiguous outcome handling (2026-10-19)

- Routed `EmbodimentRuntime` Termux speech dispatch through `OrganismCore.executeTool` and the canonical ActionGateway; stable `speechEventId` is bound to a durable idempotency key.
- Added typed Termux outcomes: `completed`, `not-started`, and `unknown`. A post-start timeout, signal, or non-zero exit remains ambiguous because audio may already have begun; command completion is not reported as independently verified playback.
- Ambiguous speech is retained as unresolved evidence and does not increase embodiment failure streak/cooldown or produce false negative skill/reliability credit.
- Added fake-process tests and gateway-boundary/recovery tests. Runtime typecheck and the new tests pass; archived receipt recovery suites also pass when run individually. A long nested aggregate command timed out at the execution wrapper and is not recorded as a single PASS.
- Synchronized root integration manifest and runtime release owners at 35.88.0 / schema 225. App dependency installation remains blocked by npm registry DNS; live Android/audio and browser/Live2D E2E remain open. Memory retrieval candidate remains unpromoted at recallDelta=0; roadmap score stays 80.1%.


## WorkPass 80 — cold-memory retrieval invariants (2026-10-20)

- Added a deterministic regression with a 140-record corpus that forces an old, low-salience record into cold residency, then verifies it remains recallable by lexical retrieval without materializing a vector or silently changing residency.
- Added snapshot/restore coverage for cold records, candidate budget (192), and canonical memory index integrity.
- Wired the regression into runtime scripts and the WorkPass79 GitHub Actions workflow; test:workpass80 combines the new memory regression with the local-language reliability suite.
- **Evidence status:** PASS in GitHub Actions run [39371651412](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412): corpus 140, tiers hot/warm/cold 16/64/60, materialized vectors unchanged at 80, target recall and restore recall true, candidate count 140, index integrity true. This is a residency/integrity invariant, not an independent RU/EN retrieval-quality benchmark. No Recall@k, MRR, transfer-learning, or overall readiness uplift is claimed.


## WorkPass 81 — caller cancellation for local inference (2026-10-20)

- Extended the existing `OpenAICompatibleLocalChatProvider` request contract with an optional caller-owned `AbortSignal`; provider timeout and caller cancellation are composed rather than one replacing the other.
- Added stable `llama.cpp-request-aborted` normalization for caller cancellation before dispatch, during transport, and while reading a bounded response; deadline failures normalize to `llama.cpp-timeout`.
- Extended the provider boundary regression for in-flight and pre-aborted requests. This proves the provider boundary honors a signal when its caller supplies one; it does not prove every upstream cognitive-cycle caller currently forwards cancellation.
- **Evidence status:** PASS in GitHub Actions run [39371651412](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412): timeout abort and caller cancellation (in-flight and pre-aborted) passed alongside HTTP 503, malformed JSON, empty output, response-size limit and loopback-only checks. Real llama.cpp cancellation, upstream end-to-end signal forwarding, and process restart/recovery remain unverified.


### WorkPass81 follow-up — deterministic timeout test harness (2026-10-20)

- GitHub Actions exposed that Node's `AbortSignal.timeout()` timer is unreferenced: the test's unresolved top-level await could terminate with exit code 13 before the timeout fired. The focused test now holds the process open only for the expected timeout window and asserts the normalized `llama.cpp-timeout` outcome.
- Follow-up run [39371651412](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412) passed the cold-memory regression, policy test, provider-boundary suite and server HTTP smoke.


## WorkPass 82 — end-to-end cancellation of in-flight language generation (2026-10-20)

- Propagated the request `AbortSignal` from `/api/organism/chat` through `OrganismRuntime.step`, `LanguageRequest`, `invokeLanguage`, and the local provider. The server aborts generation when the client disconnects and avoids writing a response to a destroyed socket.
- Local cancellation is no longer recorded as a normal llama.cpp provider failure and does not fan out into fallback generation. Kobold/Gemini fetches also compose the caller signal with their deadline, and provider iteration stops when the request has been cancelled.
- Added `tests/workpass82-server-language-cancellation.mjs`: starts a real NK1 server plus a controlled loopback chat-completions endpoint, disconnects the client during generation, and requires the upstream provider socket to close before the 12-second provider deadline.
- Wired the E2E cancellation test into the WorkPass79 Actions workflow. **PASS** in [Actions run 39372093088](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372093088): the controlled provider received one request and observed one upstream disconnect after the chat client disconnected, well before the 12-second provider deadline. This controlled loopback test does not substitute for live llama.cpp or restart/soak testing.


## WorkPass84 — целостность npm scripts и локальных тестовых целей (2026-10-20)

- Добавлен `runtime/neuro-kurisu/tests/workpass84-script-integrity.mjs`: проверяет, что все `npm run <target>` из runtime `package.json` ссылаются на объявленные scripts, а все статические `tests/*.{mjs,cjs,js,ts,mts,cts}`-цели существуют внутри каталога тестов.
- Одноразовый аудит обнаружил три настоящие битые ссылки: пропущенный префикс `test:` у `long-horizon:operational:1000`, неверное имя `test:big-pass-317` вместо существующего `test:big-pass-317:reality`, и ссылку `test:p2852:neural-continuity` вместо существующего канонического `test:p2850:neural-continuity`. Исправлены все три; assertions не ослаблялись.
- Новый script подключён к WorkPass79 GitHub Actions workflow.
- Предварительная проверка обновлённого manifest: 1,655 scripts; 3,334 `npm run`-ссылки без отсутствующих targets; 1,286 статических ссылок на тестовые файлы. Это локальная проверка manifest-данных, не замена ожидаемому результату Actions.
- **PASS:** GitHub Actions run [39374168533](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39374168533) на кодовом HEAD `b95235b5696667ad96cc6f1d63c11f4b91a96ee8`: audit `WORKPASS84_SCRIPT_INTEGRITY=PASS` (1,655 scripts; 3,334 npm-run references; 1,286 static test-file references; zero missing targets/files), WorkPass80 residency, WorkPass83 benchmark truthfulness, WorkPass79 provider policy/boundary, WorkPass82 cancellation and server smoke all passed. Later commits in this PR only add research documentation; their exact-head Actions run is separate.
- Scope: ловит отсутствующие npm script targets и отсутствующие статические test files; не доказывает достижимость/качество каждого теста и не является полным аудитом динамических import/require.


## Research gate — long-term memory and continual learning (2026-10-20)

- Added `docs/RESEARCH_GATE_MEMORY_CONTINUAL_LEARNING_2026-10-20.md`, synthesizing LongMemEval (ICLR 2025), MemoryAgentBench (2025), MemBench (ACL Findings 2025), Memora/FAMA (ACL 2026), FOREVER (ACL 2026), modular-memory continual-learning work (ICML 2026), and Titans.
- The actionable changes are evaluation gates, not unverified architecture imports: separate retrieval from answer correctness; test temporal updates, abstention and stale-memory use; evaluate incremental learning and selective forgetting; track language-specific quality, resource cost and restart recovery; preserve independent holdout integrity.
- Paper and dataset/code links are recorded in the research note. No external dataset or implementation was copied into the runtime; licensing/schema compatibility must be checked before any direct import.
- **Evidence status:** research synthesis only. No NK1 quality improvement is claimed; WorkPass83 remains a synthetic harness test with zero observed uplift.


## Verification update — research-note branch HEAD (2026-10-20)

- **PASS:** [GitHub Actions run 39374347662](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39374347662) completed successfully on HEAD `b440066e49eca7cf098cbbe99267962a9eb564d6`, including WorkPass84 integrity audit, WorkPass80/83 memory tests, WorkPass79 provider tests, WorkPass82 cancellation and server smoke.
- The run includes the research-note and handover updates; those documents do not change runtime behavior. Continue to use exact-head Actions status as the gate for any future commits.


## WorkPass85 — abstention-aware retrieval evaluation (2026-10-20)

- Extended the offline MemoryOS2-vs-BM25 benchmark to label answerable and intentionally unanswerable queries explicitly. Unanswerable examples must have an empty relevance-label set; malformed combinations are rejected rather than silently scored.
- Recall/MRR/precision now use answerable queries only; the report separately records unanswerable-query count, unsupported retrieval rate, correct abstention rate, false-abstention count and rate. Promotion gates require the candidate's unsupported-retrieval rate not to regress against BM25.
- Expanded the fixed RU/EN synthetic harness from 8 to 10 holdout queries (8 answerable, 2 unanswerable). This tests metric integrity only; it is not an independent human-labelled dataset and cannot support a quality-uplift claim.
- Exact-head GitHub Actions validation is pending for this commit; do not mark WorkPass85 PASS until its run succeeds.


## WorkPass86 — bind benchmark provenance to the exact dataset (2026-10-20)

- Retrieval benchmark report schema advanced to v4 after adding abstention metrics.
- Promotion provenance now requires a license identifier (SPDX ID or explicit repository-scoped `LicenseRef`) and a SHA-256 matching the canonical labelled-example fingerprint. Missing, malformed or mismatched hashes block promotion; they are not silently accepted as metadata.
- Regression test derives the fixture hash from the benchmark's canonical fingerprint and verifies a deliberately wrong hash blocks promotion. The fixture's `LicenseRef` is internal test metadata, not a claim that the synthetic fixture is an externally licensed benchmark.
- GitHub Actions is the execution authority; update this receipt only after the exact new head finishes.


## WorkPass87 — suppress corrupt superseded memories in current retrieval (2026-10-20)

- Hardened the canonical `MemoryOS2.retrieve` path: if a memory has a supersession pointer but a missing validity-end timestamp, current/point-in-time retrieval now treats it as stale and increments the existing `staleRetrievalsAvoided` counter. Explicit archival mode remains able to inspect historical records.
- Aligned benchmark current-corpus eligibility and stale-result accounting with the same invariant.
- Added a process-level regression that creates a real revision, corrupts only the parent's validity-end metadata in a restored snapshot, and checks current retrieval suppression, observable diagnostics, and archive-mode visibility.
- WorkPass86 exact-head CI: [run 39376018280 — PASS](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39376018280) on `192a4858cc1bbcb2b6944128c14f0170cc4caf59`. WorkPass87 exact-head CI: [run 39376255921 — PASS](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39376255921) on `cd278c83002b1afcfb821836ff3ce7502fa4906e`. All steps passed, including the new superseded-memory recovery test.


## WorkPass88 verification receipt — 2026-10-20

- **PASS:** [GitHub Actions run 39378152687](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39378152687), exact head `7d56d67a9c8cec7617340f607d199be4bd5859f7`.
- The new WorkPass88 benchmark label-truncation guard passed, as did script integrity, cold-memory residency, WorkPass87 supersession recovery, WorkPass83/85/86 benchmark integrity/abstention/provenance, local provider policy/boundary, end-to-end caller cancellation, and controlled-provider server smoke.
- Evidence scope is regression integrity only. The run does not measure external retrieval quality, real llama.cpp latency, continual-learning gains, or consciousness.


## 2026-10-20 — WorkPass89: confidence-bounded abstention regression

- Extended the retrieval benchmark with a paired-query bootstrap interval for unsupported retrieval on explicitly unanswerable holdout queries.
- Candidate eligibility now requires the upper confidence bound of candidate-minus-baseline unsupported retrieval to remain within a configurable tolerance (default `0`), in addition to the existing point-estimate guard.
- Bumped the benchmark report schema to v6 and added focused assertions. This is a stricter evaluation gate, not evidence of improved retrieval quality; the current bilingual fixture remains synthetic.


## 2026-10-20 — WorkPass90: require adequate unanswerable holdout evidence

- Closed an evaluation gap: a benchmark with no or too few explicitly unanswerable holdout queries could otherwise report a zero-width abstention interval and appear to satisfy the confidence gate without meaningful abstention evidence.
- Added `minUnanswerableHoldoutQueries` (default 4; bounded to 2–32), a dedicated `sufficientUnanswerableEvidence` promotion gate, a surfaced threshold, and the fail-closed reason `insufficient-unanswerable-holdout`.
- The fixed synthetic fixture has only two unanswerable cases and now explicitly proves that promotion is blocked for insufficient abstention evidence. This is a conservative evaluation guard, not retrieval uplift.


## WorkPass90 — adequate abstention evidence gate (2026-10-20)

- **PASS:** exact-head GitHub Actions run [39379410664](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39379410664), branch head `f60a2c3ed314595fc4d8d8cc46b9a37c592d9628`; all workflow steps succeeded.
- Added `minUnanswerableHoldoutQueries` (default 4, bounded 2–32), `sufficientUnanswerableEvidence`, and the fail-closed reason `insufficient-unanswerable-holdout`.
- Regression test proves the current synthetic fixture's two unanswerable queries are insufficient to authorize an abstention promotion claim.
- Reviewed 2026 research on MemoryBench, Mem2ActBench, Memory-R1, AgeMem, MemFit and LeanMem; updated the research gate with a next-stage memory-to-action evaluation plan. These are design inputs, not reproduced NK1 results.
- Evidence scope: CI regression integrity only. No real local LLM run, independent human-labelled corpus, or measured cognitive-quality uplift is claimed.


## 2026-10-20 — WorkPass102: reservoir replay baseline

- Added a bounded, seeded Algorithm R reservoir sampler as an independent continual-learning replay baseline; production defaults are unchanged.
- Added deterministic regression tests and expanded the replay-selection benchmark across five reservoir seeds.
- Added a Node 24 GitHub Actions workflow. Report only replay composition and reproducibility until verifier-grounded task outcomes, retention, transfer and uncertainty intervals are measured.


## WorkPass106 — verifier-outcome promotion gate (2026-10-20)

- Added `VerifiedOutcomePromotionGate.ts`: explicit minimum paired sample and task-family thresholds, minimum aggregate pass-rate gain, optional strict positive 95% CI lower-bound requirement, and a per-family regression ceiling.
- Added `tests/p23-verified-outcome-promotion-gate.mjs` covering successful evidence, small samples, weak gain, uncertain intervals, missing family pairs, regressions, duplicate family names, invalid config, and an explicitly relaxed exploratory mode.
- Corrected `VerifiedOutcomeLedger.ts` so empty/whitespace method IDs are classified as `invalid-method`, not misreported as an invalid attempt; added regression coverage.
- Exposed `test:p23:verified-promotion` in the runtime package and added a Node 24 Actions workflow running the ledger regression, promotion-gate regression, and runtime typecheck.
- This is an eligibility calculation only: it does not automatically promote or alter production learning policy. Synthetic test fixtures validate gate behavior, not real task success.
- Research adaptation: SkillLearnBench's three-level evaluation chain and deterministic task verifiers, plus continual-learning benchmarks' emphasis on transfer/retention rather than memory accumulation. No upstream benchmark data or third-party code was copied into this change.
- Exact-head CI status must be read from Actions before this pass is marked validated.
