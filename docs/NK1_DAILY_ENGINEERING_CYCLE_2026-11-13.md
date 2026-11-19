# NK1 — ежедневный инженерный цикл 2026-11-13

**Дата запуска:** 2026-11-13, 18:06 Asia/Almaty  
**Канонический репозиторий:** https://github.com/ailtron1ss-rgb/NK1  
**Каноническая source-ветка:** workpass70-source  
**Live source HEAD:** 1a0315595302f3154df0ae53e5d9188875311467  
**Parent:** 189643ede8f3904dd670f0109a28b7536e894c00  
**Документационная ветка:** docs/nk1-daily-engineering-cycle-2026-11-10; PR #854 остаётся open / not merged.

## Итог и счётчики

| Счётчик | Значение | Интерпретация |
|---|---:|---|
| generated | 18 | Сформированы 18 направлений с независимыми критериями |
| attempted | 4 | Live GitHub sync; HMX test-lifecycle fix; ACP failure diagnosis; CI/release verification |
| completed | 2 | Live sync; исправление HMX integration-test lifecycle |
| partially_completed | 1 | CI/release verification: checks наблюдаемы, ZIP bytes недоступны |
| blocked | 5 | RU/EN holdout; initiative soak; ACP dependency integration; legal clearance; phone soak |
| deferred | 10 | Уже покрытые owners/PR или отсутствие нового доказанного дефекта |
| verified | 2 | Source branch 6/6; HMX test fix on exact PR head |

**Не повышать global readiness.** Новая работа — тестовый lifecycle fix в Draft PR #866; она не означает merge, Release или доказанную работу на телефоне. completed и verified считаются отдельно от generated.

## Live GitHub sync

### Source branch

- Live branch API: workpass70-source → 1a0315595302f3154df0ae53e5d9188875311467.
- Parent: 189643ede8f3904dd670f0109a28b7536e894c00.
- Latest source commit: [1a031559](https://github.com/ailtron1ss-rgb/NK1/commit/1a0315595302f3154df0ae53e5d9188875311467), “[NK1][Avatar] Reduce remote model import peak memory”, 2026-11-13.
- Exact-SHA checks: 6/6 SUCCESS:
  - [GLB / VRM preflight](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43388626073)
  - [explicit-forget](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43388625919)
  - [browser-affect](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43388625822)
  - [local-language-resilience](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43388625837)
  - [source-lineage-contract](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43388625768)
  - [targeted-and-regression](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43388625677)

### Open PR / issue snapshot

| Item | Exact head / state | Evidence and boundary |
|---|---|---|
| [#863](https://github.com/ailtron1ss-rgb/NK1/pull/863) | f4feaceb221cbf74a4913b7bb4af113c19c2ae1c · Draft | 44/44 checks SUCCESS. 4 containers, 22 nested archives, 21 unique donors. Human legal clearance 0/21; detailed code diffs 1/21; tests verified 1/21; release verified 0/21. Base snapshot 189643e… is one source commit behind live HEAD. |
| [#864](https://github.com/ailtron1ss-rgb/NK1/pull/864) | 21d979476c107d577119d07039fef2762583a4af · Draft | 8/8 checks SUCCESS. Consequence-cost policy remains separate from compute cost; ActionGateway remains sole executor. Human tool-registry and heuristic-weight review remain open. |
| [#866](https://github.com/ailtron1ss-rgb/NK1/pull/866) | 928b85b981e887f595d7fb2cb6a1cec5611f7c40 · Draft | 29/30 checks SUCCESS. Canonical HMX apply and source-lineage checks pass; independent-evidence-evaluation fails on missing acp.helpers. |
| [#853](https://github.com/ailtron1ss-rgb/NK1/pull/853) | 2bae2883286bfd783c5adcf7b8148b8d70e795f4 · Open, not merged | 5/5 checks SUCCESS. Already contains agent-client-protocol==0.12.1 and an ACP import smoke. Do not duplicate it into #866. |
| [#865](https://github.com/ailtron1ss-rgb/NK1/issues/865) | Open | Separate baseline defect: exact pending decision fails to receive grounded reafference/temporal credit. |
| [#854](https://github.com/ailtron1ss-rgb/NK1/pull/854) | Docs branch | Existing documentation PR extended; no new PR created. |

## Actual code/test change

**PR:** [#866 — Hexis HMX 1.7 explicit canonical memory apply](https://github.com/ailtron1ss-rgb/NK1/pull/866)  
**Branch:** aspect/hexis-hmx-canonical-apply-20261113  
**File:** runtime/neuro-kurisu/tests/integration/hexis-hmx-canonical-apply.mjs  
**Commit:** [928b85b981e887f595d7fb2cb6a1cec5611f7c40](https://github.com/ailtron1ss-rgb/NK1/commit/928b85b981e887f595d7fb2cb6a1cec5611f7c40)

**Reproduced failure:** the integration test restarted the real server, completed restart/restore/replay assertions, then killed the restarted server in an inner finally. Later malformed-decision and analysis-only assertions still sent requests to the same base URL, causing ECONNREFUSED.

**Fix:** retain the restarted child through the remaining post-restart assertions and move child shutdown to the outer finally, with bounded exit wait before removing the temporary state directory.

**Exact-head evidence:**
- [canonical-hmx-apply job](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43432034201) — SUCCESS.
- [source-lineage-contract job](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43432034417) — SUCCESS.
- [independent-evidence-evaluation job](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43432034244) — FAILURE: ModuleNotFoundError: No module named acp.helpers.
- All 30 checks completed; 29 SUCCESS, 1 FAILURE. The ACP issue is already addressed by open PR #853; no duplicate dependency change was made.

**Implemented / connected / tested / released:**
- Implemented: YES — test harness lifecycle correction on PR #866.
- Connected: NO claim of production integration; PR #866 remains Draft and unmerged.
- Tested: YES — exact-head canonical HMX apply and source-lineage checks pass; the full PR check set is not green.
- Released: NO.

The regression exercises the existing feature branch's explicit stage → accept (review-only) → apply boundary, sanitization, lineage dedupe/isolation, rollback and restart/replay. The test correction does not itself change the runtime import policy.

## Latest research intake — DSPy GEPA / Agent0

- The 2026-11-13 source-assimilation register explicitly describes itself as initial inventory and architectural routing. No donor code was copied and no donor dependencies were installed in that intake pass; NK1 source archive bytes were not available locally and the package registry was unavailable.
- Four supplied 7z containers contain 22 nested ZIPs and 21 unique donor projects (Letta is duplicated). The 172 LICENSE/NOTICE/COPYING-like filenames are an inventory, not legal clearance. Human legal clearance remains 0/21.
- The DSPy/GEPA note identifies a useful potential gap: NK1 already has outcome reflection, a P23 single-candidate generator, verified outcome receipts and an independent holdout promotion gate. Existing Pareto ranking applies to learning targets, not to a per-example population of candidate skill versions. A full GEPA-style candidate population/archive was not confirmed in the reviewed P23 paths; this remains a preliminary finding pending a repository-wide branch search.
- The adapter in PR #863 is an optional protocol sidecar, not a bundled or locally installed DSPy/GEPA optimizer. It is disabled by default, receives validation-only evidence, and cannot receive holdout scores or activation authority. Do not add the Python GEPA runtime dependency to the TypeScript/Android runtime.
- Candidate next step, not yet implemented: search all canonical owners/branches for an equivalent candidate archive; only if absent, design an NK1-native bounded multi-candidate archive with parent lineage, immutable payload/dataset fingerprints, per-task validation scores, deduplication and explicit metric-call/token/time/cardinality budgets. Independent holdout remains outside the generator; compare against single-candidate P23 using a frozen manifest, paired seeds and ablations before any promotion.

## Release metadata and binary boundary

- Latest published artifact including prerelease: tag workpass70-hotfix1-2026-10-19, published 2026-10-19; asset Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip, 136,354,713 bytes; GitHub metadata digest sha256:9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb.
- Stable tag Neuro: asset Neuro_Kurisu_WORKPASS70_2026-10-19.zip, 135,290,615 bytes; metadata digest sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286.
- Asset metadata was read, but binary bytes could not be materialized through the available GitHub/container download path. Archive member list, CRC, recomputed SHA-256, embedded source revision and source parity remain UNKNOWN. Do not claim current source is released.
- Human license clearance in PR #863 remains 0/21. No redistribution or Release publication is authorized.

## 18-direction execution backlog

Status meanings: done = acceptance verified; partial = some gates verified but full acceptance open; blocked = an external dependency or evidence gate prevents safe completion; deferred = existing work covers the owner or no new defect justifies duplicate work.

| ID / domain | Concrete result, priority, dependencies, risk and acceptance | Status / evidence |
|---|---|---|
| NK1-D2026-11-13-01 Core / OrganismBus | P1; no dependency. Refresh source ref, parent, exact-SHA Actions and PR snapshot. Low risk; accept only when branch API and six exact checks agree. | **done / verified** — live source 1a031559…; 6/6 SUCCESS. |
| NK1-D2026-11-13-02 Perception / world model | P2; depends on canonical PerceptionRouter/WorldModel. Low risk; only change calibration/provenance on a reproduced defect with a behavioral regression. | **deferred / no-new-work** — #863 world-perception-integrity check is green; no new calibration defect reproduced. |
| NK1-D2026-11-13-03 Memory ingest / evidence lineage | P1; depends on HMX staging and canonical MemoryOS2 owner. Low/reversible; accept when post-restart assertions execute and the exact HMX/source-lineage checks pass. | **done / verified** — test-lifecycle fix 928b85b…; canonical-hmx-apply and source-lineage-contract SUCCESS. Runtime feature remains Draft/unmerged. |
| NK1-D2026-11-13-04 Retrieval / RU-EN holdout | P0; depends on immutable licensed bilingual corpus and independent source-group provenance. High risk; accept only with recallDelta > 0 on at least 5 paired seeds and no train/holdout leakage. | **blocked** — no independent confirmatory RU/EN result. |
| NK1-D2026-11-13-05 Consolidation / MemFS / restore | P1; depends on snapshot/restore owner. Medium risk; accept with deterministic restore and replay idempotency under interruption. | **deferred / no-new-work** — the #866 HMX regression already exercises restart/restore/replay; no separate new persistence defect was isolated. |
| NK1-D2026-11-13-06 Motivation / drives / initiative | P1; depends on long-duration runtime/device soak. Medium risk; accept with explainable initiative >=1/hour and correct interrupt/sleep-wake behavior. | **blocked** — no new soak evidence. |
| NK1-D2026-11-13-07 Planning / selector / forward model | P2; depends on a repository-wide search for an existing candidate archive and immutable validation/holdout separation. Medium risk; accept only if no canonical owner already exists and a bounded candidate archive has paired-seed/holdout evidence. | **deferred / no-new-work** — GEPA note identifies a preliminary multi-candidate archive gap; no full branch search or implementation was performed this cycle. |
| NK1-D2026-11-13-08 ActionGateway / Hermes / permissions | P1; depends on canonical ActionGateway. Medium risk; accept only with read-only ambient policy and fail-closed mutation/approval tests. | **deferred / no-new-work** — PR #864 already owns consequence-cost policy and has 8/8 SUCCESS; avoid a duplicate gateway change. |
| NK1-D2026-11-13-09 Reflection / outcome / reafference | P1; depends on verified outcome → temporal-credit assignment. High evidence risk; accept when the exact pending decision receives grounded reafference after restore/replay. | **blocked** — #865 remains open. Separate #866 evaluator startup failure is mapped to existing #853 ACP dependency, not the #865 behavior defect. |
| NK1-D2026-11-13-10 SelfModel / personality / continuity | P2; depends on SelfModel and episodic-memory owner. Medium risk; accept with autobiographical continuity and calibrated self-claim regressions. | **deferred / no-new-work** — no new self-model defect isolated in this cycle. |
| NK1-D2026-11-13-11 UserModel / ToM / forget | P1; depends on UserModelEvidenceModel. High privacy risk; accept with explicit correction/forget/tombstone/replay regressions. | **deferred / no-new-work** — explicit-forget check passes on source HEAD; no duplicate forget logic added. |
| NK1-D2026-11-13-12 EthicalGate / PEA / privacy | P0; depends on human source/license review and permission gates. High legal/privacy risk; accept only with path-level legal clearance and fail-closed policy tests. | **blocked** — donor legal clearance remains 0/21; no redistribution approval. |
| NK1-D2026-11-13-13 Embodiment / MotorFrame / renderer switching | P1; depends on renderer-neutral motor contract and browser/device harness. Medium risk; accept with 2D/2.5D/3D switch, reset and pose assertions. | **deferred / no-new-work** — no new renderer defect; browser/device E2E still open. |
| NK1-D2026-11-13-14 Avatar asset pipeline / GLB-VRM | P1; depends on licensed assets and real browser/mobile measurement. Medium risk; accept with preflight, bounded memory, provenance and measured device peak-RSS. | **deferred / no-new-work** — source avatar optimization and GLB/VRM preflight exist; device peak-RSS and licensed Kurisu asset remain unverified. |
| NK1-D2026-11-13-15 Speech / STT-TTS / lip sync | P2; depends on real audio clock and target-device harness. Medium risk; accept with drift <=80 ms and interruption <=200 ms. | **deferred / no-new-work** — no real audio/viseme timing measurement this cycle. |
| NK1-D2026-11-13-16 Mobile / Android / Termux | P0; depends on a real Android/Termux device. Medium/high risk; accept with 10k deterministic ticks, <=50 ms phone tick and offline/background/foreground soak. | **blocked** — no device soak available. |
| NK1-D2026-11-13-17 App/API / infrastructure | P2; depends on an existing authorized data plane and explicit schema/credential approval. High operational risk; accept with real adapter contract tests and no production mutation. | **deferred / no-new-work** — no database, schema, secret, deployment or production change authorized or needed. |
| NK1-D2026-11-13-18 Validation / CI / Release ZIP / provenance | P0; depends on exact-SHA Actions and binary ZIP access. High false-green/release-parity risk; accept only with all relevant checks green plus ZIP SHA/member/CRC/source comparison. | **partial** — source 6/6, #863 44/44, #864 8/8; #866 29/30 with ACP failure; ZIP metadata known but binary/source parity UNKNOWN. |

## Adaptive goal changes

- Main mission and architecture are unchanged.
- Completed the narrowly scoped HMX test-lifecycle correction; do not duplicate the existing ACP dependency fix from #853.
- Raised #865 temporal-credit/reafference investigation and #853 human integration as the next highest-value blockers.
- Kept RU/EN holdout, license, phone soak and Release ZIP verification at P0.
- Did not promote any 75-aspect registry status. Snapshot remains 62 IMPLEMENTED, 1 TESTED, 11 PLANNED, 1 BLOCKED; labels are not proof of connected runtime behavior.
- No global readiness or area score changed because no new independent behavioral, holdout, device or release-parity evidence was produced.

## Next 5 actions

1. Human review and separately authorized integration of #853; then rerun #866's independent-evidence-evaluation check without duplicating the ACP pin.
2. Investigate #865 from exact decisionId propagation through OutcomeVerificationService to CanonicalTemporalCredit; add a restore/replay regression.
3. Search all source branches for an existing GEPA-like candidate population/archive; only if absent, design an NK1-native bounded P23 candidate archive and validate it against single-candidate P23 with paired seeds and holdout isolation.
4. Obtain a supported binary-download path for the prerelease ZIP; recompute SHA-256, inspect central-directory/member CRCs and compare embedded source provenance; complete human license/NOTICE and separate model, voice and avatar asset review before redistribution.
5. Acquire immutable licensed RU/EN holdout with independent source groups (>=5 paired seeds), then run Android/Termux, browser avatar and speech timing soak.

## Handoff invariants

- Do not merge any PR, close PRs, delete branches, force-push, rewrite history, publish Release, provision databases, change secrets or touch production without separate explicit authorization.
- Do not duplicate #853's ACP pin or create a second PR for the same HMX test contract.
- Keep the 2026-11-13 fix isolated on PR #866 and the daily record on PR #854; the source branch remains unchanged by this cycle.
- The next run must begin with live source HEAD, open PRs, exact-head Actions and release metadata; all SHAs above are snapshots, not future baselines.
