# Neuro Kurisu / NK1 — ежедневный инженерный цикл — 2026-11-23

## Краткий итог

Выполнено одно самостоятельное code-first изменение в направлении speech provider telemetry: строгая runtime-валидация входных событий, adversarial regression и отдельный exact-head CI workflow. PR #1147 открыт как Draft, не слит. Финальный PR HEAD `91ae42209a3297f7249af51ac848d3cb01eafee5` получил **10/10 GitHub Actions SUCCESS**.

Отдельно подтверждено внешнее слияние PR #1121 (MemoryOS2 capacity/lifecycle integrity): merge SHA `f4ca153384747df7979036391121a11d4d16fec5`, exact-merge Actions **31/31 SUCCESS**; текущий source является его потомком. Это внешняя интеграция, не результат слияния текущего цикла.

## Счётчики

| generated | attempted | completed | partially_completed | blocked | deferred | verified |
|---:|---:|---:|---:|---:|---:|---:|
| 18 | 12 | 3 | 5 | 4 | 6 | 3 |

`attempted` включает завершённые, частично выполненные и заблокированные задачи. `completed` не означает `released`. Verified означает exact-SHA CI/evidence на указанном объекте, а не общую готовность продукта.

## Live GitHub snapshot

- Repository: https://github.com/ailtron1ss-rgb/NK1
- Canonical source: `workpass70-source` @ `54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441`.
- Source commit: `[NK1][Cognitive Core] Pair owner stage receipts with voluntary attention`, 2026-11-23T12:51:44Z.
- Exact source Actions: **33/33 SUCCESS**, all returned runs completed on the exact source SHA. Examples:
  - [NeuroCore core regression](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178304980)
  - [Unified organism runtime](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178305060)
  - [Module Dependency Audit](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178305207)
  - [World perception integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178305121)
  - [Action Gateway governance](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178305521)
- `main` @ `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; no change made.
- Current source is 258 commits ahead / 0 behind merged MemoryOS2 capacity PR #1121 merge commit `f4ca153384747df7979036391121a11d4d16fec5`.
- PR #1146 remains open, Ready, based exactly on current source; head `9da4daa8b6d8e09c2555e5fca771c107c2abb0d8`, 216 ahead / 0 behind. No merge was performed.
- PR #1139 remains open; head `a3d424517ba668b31cefcc50a2773c385e9bfdd6`, compare against current source is diverged, 7 ahead / 108 behind. It is not current-source verification.
- PR #429 remains open Draft and owns `ToolInputContract.ts` plus its existing test. Its head is 116 ahead / 1,927 behind current source; do not merge wholesale or create a duplicate PR on the same owner surface.
- Full branch-ref and open-PR pagination was not repeated in this run; no branch-count claim is made.

## Published Release boundary

GitHub Release metadata was refreshed. The latest published prerelease remains `workpass70-hotfix1-2026-10-19`:

- Asset: `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`
- Size: 136,354,713 bytes
- GitHub asset metadata SHA-256: `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`

Stable tag `Neuro` remains `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.

The asset bytes could not be materialized through the available download path. Independent SHA-256, extraction manifest and source/ZIP parity remain **UNVERIFIED**. Neither `main` nor a Release was changed.

`contracts/RELEASE_LICENSE_REVIEW.json` is still `pending`: root `NOASSERTION`, runtime private/all-rights-reserved, redistribution approval false, 477 locked npm components and 8 source archives pending human review. Release publication remains blocked.

## 18 направлений / задачи

| ID | Домен и конкретный результат | P / зависимости / риск | Критерий приёмки | Статус и доказательство |
|---|---|---|---|---|
| NK1-D2026-11-23-01 | Core / OrganismBus: сверить live source и exact-SHA Actions | P0; live branch; низкий, read-only | Все check-runs завершены на одном SHA и SUCCESS | **done / verified** — `54f9ec7...`, 33/33 |
| NK1-D2026-11-23-02 | Perception: проверить world-model integrity на текущем source | P2; 01; низкий | Новый work только при новом failing case | **deferred / no-new-work** — [world perception integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178305121) SUCCESS |
| NK1-D2026-11-23-03 | Memory ingest: сохранить HMX hypothesis от text-only implicit supersession | P1; HMX bridge + MemoryOS2; высокий integrity-риск | Current-source failing-before/passing-after; local-local supersession сохранён | **partially_completed** — #1139 содержит candidate guard/tests, но diverged 7/108; новый runtime reproduction не выполнен |
| NK1-D2026-11-23-04 | Retrieval: отделить synthetic BM25 check от независимого RU/EN uplift | P1; MemoryOS2 + immutable holdout; средний | ≥5 paired seeds, independent holdout, recallDelta > 0 с uncertainty | **deferred** — source checks зелёные, независимый uplift не подтверждён |
| NK1-D2026-11-23-05 | Consolidation: защитить canonical MemoryOS2 capacity, restore и projection lifecycle | P0; MemoryOS2 → MemoryFabric; высокий, но обратимый | Protected rows не теряются; byte/index/reference accounting exact; exact merge CI | **done / verified, external** — PR #1121 merged as `f4ca153...`, 31/31 SUCCESS: [Actions](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45131101894) |
| NK1-D2026-11-23-06 | Motivation: проверить новую voluntary-attention/owner-receipt связку против initiative cadence | P1; core receipts + scheduler; средний | Объяснимая инициатива ≥1/час на 24h soak без нарушений interrupt/permissions | **partially_completed** — новый source commit наблюдался, 33/33 CI; 24h telemetry отсутствует |
| NK1-D2026-11-23-07 | Planning: проверить paired Cognitive Parliament + Intent execution candidate | P1; Evidence Firewall + P69 + ActionGateway; высокий | Exact-head CI, fail-closed evidence, отдельное external approval, recovery/idempotency | **partially_completed** — PR #1146 open, 216 ahead / 0 behind; merge не выполнялся |
| NK1-D2026-11-23-08 | Tool security: проверить array-proxy ingress в ToolInputContract | P1; ToolInputContract + ActionGateway; высокий security-риск | Proxy/array traps не выполняются; rejected input не меняет receipt/ledger | **blocked** — статически найдено: array branch в `inspect()` вызывает reflection до `isProxy`; существующий открытый #429 владеет тем же файлом/тестом и сильно stale. Runtime reproduction и дублирующий PR не создавались |
| NK1-D2026-11-23-09 | Reflection: проверить owner-stage receipts против независимого postcondition evidence | P1; CognitiveEventFabric + outcome verifier; высокий | ACK не считается outcome; receipt привязан к exact action/state transition | **partially_completed** — source integration наблюдалась; независимый host-owned outcome dataset отсутствует |
| NK1-D2026-11-23-10 | SelfModel: проверить autobiographical continuity через process restart | P2; persisted self state; средний | Restart/replay сохраняет авторство, provenance и calibrated self-claims | **deferred** — нового failing trace в этом цикле нет |
| NK1-D2026-11-23-11 | UserModel: подтвердить explicit-forget boundary на source | P1; UserModel v2; средний | Explicit correction/forget сохраняет tombstones и не воскресает при restore | **deferred / no-new-work** — [source explicit-forget check](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178305042) SUCCESS; нового дефекта нет |
| NK1-D2026-11-23-12 | EthicalGate: закрыть human license/redistribution gate | P0; legal review; высокий, human-only | Reviewer + hash-bound decision для root/runtime/dependencies/archives | **blocked** — license contract pending, redistributionApproved=false |
| NK1-D2026-11-23-13 | Embodiment: проверить renderer-neutral MotorFrame contract | P2; MotorFrame + renderers; средний | Contract CI и отдельный browser visual E2E | **deferred / no-new-work** — [avatar cognitive-affect coupling](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45178304678) SUCCESS; новый defect не обнаружен |
| NK1-D2026-11-23-14 | Avatar assets: подтвердить GLB/VRM provenance, rig и redistribution rights | P0; asset inventory + human approval; высокий | Exact asset hashes, rig/texture manifest и права подтверждены человеком | **blocked** — human asset approval отсутствует |
| NK1-D2026-11-23-15 | Speech: harden native provider event ingress | P1; NativeSpeechEventChannel + host router; низкий/обратимый | Runtime phase/field allow-list; no getter/proxy/coercion; exact-head tests | **done / verified** — PR #1147, head `91ae422...`, 10/10 SUCCESS; [native speech workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45187694268) |
| NK1-D2026-11-23-16 | Mobile: Android/Termux offline/background soak | P1; physical target device; высокий | 10k deterministic ticks, ≤50 ms phone tick, restore/background soak | **blocked** — реальный Android/Termux device run отсутствует |
| NK1-D2026-11-23-17 | App/API/infra: не добавлять новые внешние схемы без доказанной необходимости | P2; existing adapters + authorization; низкий | Использовать только существующий owner и разрешённую схему | **deferred / no-new-work** — в этом цикле инфраструктура не менялась |
| NK1-D2026-11-23-18 | Validation/CI/Release: сверить source, PR exact head и Release metadata | P0; GitHub API + Release asset; средний | Source/PR exact SHA checks, ZIP bytes hash/extract/parity, legal gate | **partially_completed** — source 33/33, PR #1147 10/10, Release metadata verified; ZIP bytes/parity и полная branch pagination не выполнены |

## Реальные изменения текущего цикла

**Feature branch:** `fix/native-speech-event-input-boundary-20261123`  
**PR:** [#1147 — Validate native provider event input boundary](https://github.com/ailtron1ss-rgb/NK1/pull/1147)  
**Final PR HEAD:** `91ae42209a3297f7249af51ac848d3cb01eafee5`  
**Base:** `workpass70-source` @ `54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441`  
**Branch relation:** 6 commits ahead / 0 behind; 3 changed files.

Files:
- `runtime/neuro-kurisu/src/organism/body/NativeSpeechEventChannel.ts`
- `runtime/neuro-kurisu/tests/native-speech-event-channel-workpass628.mjs`
- `.github/workflows/nk1-native-speech-event-channel.yml`

Implementation:
- Six provider phases now have a runtime allow-list.
- Input is read from own enumerable data descriptors only; proxies, accessors, symbols, unknown fields and non-plain objects are rejected before reflective traps.
- Operation IDs must be strings; exit codes, signals and diagnostic strings are type/bounds checked.
- Rejected inputs do not advance sequence state; diagnostic control whitespace is normalized.
- Existing process-local queue ordering and bounded reentrant dispatch are preserved.

Verification history:
- Initial strict dependency/typecheck exposed TS2352 on the guarded record cast. Fixed in commit `91ae422...` by the explicit `unknown` bridge.
- An initial clean-startup smoke failure (`gateway exited before becoming ready: fetch failed`) was transient; the rerun on final head passed.
- Final exact-head PR Actions: **10/10 SUCCESS**, including Module Dependency Audit, integrated software baseline, clean prototype startup, core regression, unified runtime, ActionGateway governance, UserModel explicit-forget and the new speech workflow.
- The new workflow runs the 9-case native event-channel suite, 3-case host-router suite and runtime typecheck. Its runtime typecheck uses the repository's Node strip-syntax fallback when the TypeScript compiler is not installed in that job; the separate Module Dependency Audit also passed on the final head.
- PR #1147 remains **Draft / open / mergeable**. It was not merged. Code is implemented and CI-connected in the PR branch, tested on exact PR HEAD, not released.

## Implemented / connected / tested / released

| Component | Implemented | Connected | Tested | Released |
|---|---|---|---|---|
| Core / OrganismBus | Existing source implementation | Unified runtime | Source 33/33 | No November ZIP parity |
| MemoryOS2 capacity lifecycle | PR #1121 implementation | MemoryOS2 → MemoryFabric projections | Merge SHA 31/31 | No |
| Native speech provider event boundary | PR #1147 code | New PR workflow + host router | Final PR HEAD 10/10 | No |
| UserModel explicit forget | Existing source implementation | Canonical UserModel path | Source check SUCCESS | No November ZIP parity |
| ToolInputContract array-proxy guard | Not implemented | Not connected | Static gap only | No |
| Avatar / speech hardware | Partial adapters | Full physical integration unproven | No hardware soak | No |

No overall readiness percentage was raised. The source CI, one PR's focused tests and a merged memory lifecycle change do not establish independent retrieval uplift, 24h autonomy, Android performance, audio/viseme synchronization, license approval or Release parity.

## Handoff and next 5 actions

1. Reproduce the ToolInputContract array-proxy issue on current source; resolve the stale open #429 ownership without creating a duplicate PR on the same file/contract.
2. Reconcile #1139's HMX hypothesis boundary and 13 MemoryOS2 regressions against the current source; branch is 108 commits behind and must not be merged wholesale.
3. Review #1146's exact-head Actions and Cognitive Parliament/Intent integration boundaries; preserve its current base and do not merge.
4. Materialize the October 19 prerelease ZIP through a supported authenticated path, independently hash/extract it, and obtain human license/asset review.
5. Run independent RU/EN holdout with ≥5 paired seeds and physical Android/Termux + speech/viseme soak.

### Entry-point freshness limitation

- Root `AGENTS.md` checkpoint is dated 2026-11-20; `README.md` and `NEUROCORE_START_HERE.md` still carry older checkpoints.
- Open PRs #831, #762 and #652 already modify `AGENTS.md`, `README.md` and/or `NEUROCORE_START_HERE.md`. Those shared entry files were deliberately not edited in this cycle to avoid colliding with active PRs or creating a second docs PR on the same files.
- `engineering-os/aspects.v1.json` remains a 2026-11-06 snapshot tied to `bcd48b1...`; the 2026-11-23 aspect inventory/fabric documents are based on `71343b17c`, not the current source SHA. They are not current readiness truth.
- This report is the verified execution handoff for the next cycle; root entry-point refresh requires a safe disposition of the existing docs PRs.
- No branch deletion, force-push, PR merge, Release publication, production change, external service installation or paid action was performed.
