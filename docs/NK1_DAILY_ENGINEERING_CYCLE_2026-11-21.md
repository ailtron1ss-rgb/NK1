# NK1 / NeuroCore — ежедневный адаптивный инженерный цикл — 2026-11-21

## Краткий итог

Проведена полная пагинация веток и открытых PR, проверены live source/main, точные Actions source HEAD и Release metadata. Найден и исправляется отдельный дефект воспроизводимости BM25-бенчмарка: токены документов нормализовались через host-locale `toLocaleLowerCase()`, тогда как запросы — через locale-neutral `toLowerCase()`. Создан Draft PR #1059; первая CI-волна выявила ошибку в новом тестовом fixture (не был задан обязательный `independenceGroupId` при `includeQueryEvidence=true`). Fixture исправлен; повторная exact-head проверка ожидается. Никакого merge или Release не выполнялось.

## Live GitHub snapshot

- Repository: [ailtron1ss-rgb/NK1](https://github.com/ailtron1ss-rgb/NK1)
- Canonical source: `workpass70-source` @ `f1cbaa9492ea297d67d8c7461642a75de92b677e`, commit time 2026-11-21T07:53:04Z; parent `8d98f271e1374376cc81a9ba0c6e77c014f13ca8`.
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`, release/metadata branch.
- Source exact-SHA Actions: **9/9 SUCCESS** on `f1cbaa9492ea297d67d8c7461642a75de92b677e`; classic commit status endpoint has no status contexts (total_count=0), so the 9 check-runs are the evidence.
  - [targeted-and-regression](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282588)
  - [local-language-resilience](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282549)
  - [explicit-forget](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282643)
  - [source-lineage-contract](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282589)
  - [original-avatar-motor-coupling](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282580)
  - [affect-state-restore](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282567)
  - [avatar-cognitive-affect](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282557)
  - [Import graph and layer boundaries](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282577)
  - [browser-affect](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44882282537)

### Branches and PRs

- Полная пагинация `branches?per_page=100`: **1,053 branch refs**, **1,035 unique HEADs**, **3 duplicate-tip groups**, **18 excess alias refs**.
- Две новые пары одинаковых tip:
  - `aspect/consequence-ecology-20261117` и `integrate/consequence-calibration-lineage-followup-20261120` → `f9621bf3e4411ce17bc809922a5f90126001f4fd`.
  - `aspect/world-forge-integrated-20261117` и `integrate/worldforge-to-sharedfuture-after-calibration-20261120` → `68a03799ca0c9f18e4c6e19399ed8018e0215e60`.
  - Ещё одна группа из 17 имён сохраняет один tip `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` (16 excess aliases).
- GitHub Search API: **275 open PRs**, страницы REST: 100 + 100 + 75.
- PR [#903](https://github.com/ailtron1ss-rgb/NK1/pull/903) остаётся open/Draft. Его дети #916, #928 и #947 merged только в вложенные parent branches, не в `workpass70-source`. Сравнение live source → #903: **180 ahead / 893 behind**, merge-base `1e83a011fc677ff20f2348570322bd562181d9ff`; автоматический rebase/merge небезопасен. Ветки сохранены.
- Новый [Draft PR #1059](https://github.com/ailtron1ss-rgb/NK1/pull/1059), branch `fix/memory-benchmark-locale-neutral-20261121`, base `workpass70-source` @ `f1cbaa9492ea297d67d8c7461642a75de92b677e`. PR остаётся Draft и не слит.

### Release и юридические ограничения

- Stable asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, GitHub metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Latest published prerelease asset: `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136,354,713 bytes, metadata SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`.
- ZIP bytes не удалось материализовать поддерживаемым путём; digest остаётся metadata-only. Независимый hash, extraction manifest и source/ZIP parity **UNVERIFIED**. Ноябрьский source не считается released.
- `contracts/RELEASE_LICENSE_REVIEW.json`: status pending; root `NOASSERTION`, runtime `LicenseRef-NK1-Private-All-Rights-Reserved`, 477 locked npm dependencies и 8 source archives ожидают human review; `redistributionApproved=false`.

## Счётчики

| generated | attempted | completed | partially_completed | blocked | deferred | verified |
|---:|---:|---:|---:|---:|---:|---:|
| 18 | 5 | 2 | 3 | 5 | 8 | 2 |

Счётчики не аддитивны между attempted и результатными статусами: attempted включает completed/partially_completed.

## 18 направлений и задачи цикла

| ID | Домен / конкретный результат | P | Зависимости | Риск / обратимость | Критерий приёмки | Источник факта | Статус / доказательство |
|---|---|---:|---|---|---|---|---|
| NK1-D2026-11-21-01 | Core: синхронизировать source HEAD и проверить exact-SHA runtime checks | P1 | Live branch | Низкий, read-only | SHA подтверждён; все прикреплённые check-runs завершены успешно | Branch API + check-runs | **done / verified** — f1cbaa…, 9/9 SUCCESS |
| NK1-D2026-11-21-02 | Perception/world model: не расширять MeTTa serializer в сенсорный worker без реального provenance defect | P2 | Canonical concept compiler | Низкий, no-op | Новый work только при воспроизводимом provenance failure | PR #1031 + source checkpoint | **deferred / no-new-work** — serializer остаётся bounded export, worker не подключён |
| NK1-D2026-11-21-03 | Memory ingest/admission: не дублировать уже интегрированную locale-neutral нормализацию MemoryOS2 | P2 | PR #964 | Низкий, no-op | Сверить canonical owner и не создавать второй tokenizer в MemoryOS2 | PR #964 + live MemoryOS2.ts | **deferred / no-new-work** — MemoryOS2 уже использует toLowerCase |
| NK1-D2026-11-21-04 | Retrieval: сделать BM25 document tokenization locale-neutral и добавить Turkish-I regression | P1 | MemoryOS2 normalization; benchmark harness | Низкий, локальный reversible patch | Одинаковые hashed query evidence при default и Turkish casing; benchmark + experiment + typecheck проходят | MemoryRetrievalBenchmark.ts: tokenSequence; existing memory workflow | **done / verified** — PR #1059 exact code/test head `67460ab86ca25179b2d4125cc7dbe1d692b60f80`: 18/18 SUCCESS; memory-integrity run `44908870023` подтвердил benchmark PASS. Synthetic recallDelta=0, promotion не разрешена |
| NK1-D2026-11-21-05 | Consolidation/restore: не менять snapshot/restore без новой регрессии | P2 | MemoryOS2 restore owner | Низкий, no-op | Только воспроизводимый дефект с failing-before/passing-after regression | Source exact-head checks + текущий backlog | **deferred / no-new-work** — нового restore failure не выявлено |
| NK1-D2026-11-21-06 | Motivation: получить 24h initiative cadence telemetry на целевом runtime | P1 | Scheduler + реальный host/device | Высокий, hardware/soak | ≥1 объяснимая инициатива/час без interrupt/permission violation | 20-Nov handoff; отсутствие soak artifact | **blocked** — нет доступного 24h telemetry artifact |
| NK1-D2026-11-21-07 | Planning: безопасно оценить #903 → #916 → #928 → #947 stack | P1 | Exact parent/child refs | Средний/высокий; rebase не выполнялся | Подтвердить ancestry и source delta; не переписывать историю | PR API + compare_commits | **partially_completed** — child PRs merged only into stacked parents; #903 180 ahead/893 behind live; оставлен нетронутым |
| NK1-D2026-11-21-08 | ActionGateway: не создавать новый adapter без доказанного permission/idempotency defect | P2 | Canonical ActionGateway | Низкий, no-op | Новый work только по failing behavioral regression | Existing source architecture; no new defect surfaced | **deferred / no-new-work** |
| NK1-D2026-11-21-09 | Reflection/outcome: получить независимые postcondition clusters для learning credit | P1 | OutcomeVerificationService + external labels | Высокий, evidence-gated | Независимые источники и exact execution binding; ACK не засчитывается | Completion program / missing dataset | **deferred** — независимый outcome dataset не предоставлен |
| NK1-D2026-11-21-10 | SelfModel: сохранить уже интегрированный concept restore hardening, не дублировать | P2 | PR #1031 | Низкий, no-op | Не открывать повторную работу без регрессии | PR #1031 exact-head evidence | **deferred / no-new-work** — #1031 merged; 8/8 exact-head Actions |
| NK1-D2026-11-21-11 | UserModel/ToM: подтвердить explicit-forget на live source | P1 | UserModel v2 | Низкий, verification | Exact-SHA explicit-forget check SUCCESS | Source check-run 44882282643 | **deferred / no-new-work** — 9/9 source Actions уже включают explicit-forget |
| NK1-D2026-11-21-12 | EthicalGate/PEA: завершить human license review до redistribution | P0 | Human legal decision | Высокий; необратимая правовая граница | Root/runtime/dependency/archive review и явное разрешение на redistribution | RELEASE_LICENSE_REVIEW.json | **blocked** — pending; redistributionApproved=false |
| NK1-D2026-11-21-13 | Embodiment: подтвердить 2D motor и affect contract, отделив от visual E2E | P1 | MotorFrame + renderer adapters | Средний, read-only verification | Contract checks pass; visual/device E2E отдельный gate | Source checks 44882282580/557/537 | **partially_completed** — 2D/affect/browser checks SUCCESS; visual/soak не подтверждены |
| NK1-D2026-11-21-14 | Avatar asset pipeline: получить provenance и rights для production VRM/GLB | P0 | Human asset/license approval | Высокий, legal gate | Byte SHA, rig/texture manifest и право распространения подтверждены | Existing asset/license backlog | **blocked** — production asset/right evidence отсутствует |
| NK1-D2026-11-21-15 | Speech: проверить STT/TTS interruption и audio-viseme drift на реальном устройстве | P1 | Audio device + renderer | Высокий, hardware test | Lip-sync drift ≤80 ms; interrupt ≤200 ms | Completion criteria; no device trace | **blocked** — hardware trace недоступен |
| NK1-D2026-11-21-16 | Mobile: провести Android/Termux offline + background/foreground soak | P1 | Android phone + Termux | Высокий, hardware test | 10k ticks; ≤50 ms phone tick; recovery without state loss | Completion criteria; no phone soak | **blocked** — нет физического phone soak artifact |
| NK1-D2026-11-21-17 | App/API/infra: не создавать Supabase/MongoDB/Redis schema или secrets без существующей авторизованной потребности | P2 | Existing infrastructure + explicit authorization | Низкий, no-op | Только существующий adapter и разрешённый scope | AGENTS.md + architecture constraints | **deferred / no-new-work** — в этом цикле external infra не изменялась |
| NK1-D2026-11-21-18 | Validation/CI/release: перепроверить refs, PRs, exact SHA checks и release gate | P0 | GitHub API + release asset access | Средний; read-only | Полная пагинация; exact checks; ZIP bytes/hash/parity либо явный blocker | Branch/PR/Release API | **partially_completed** — 1,053 refs / 1,035 heads / 275 open PRs; source 9/9; ZIP bytes unavailable |

## Реальные изменения

Feature branch: `fix/memory-benchmark-locale-neutral-20261121`  
Draft PR: [#1059](https://github.com/ailtron1ss-rgb/NK1/pull/1059)

- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts`: BM25 document tokenizer switched from implicit locale-dependent `toLocaleLowerCase()` to deterministic `toLowerCase()`.
- `runtime/neuro-kurisu/tests/big-pass-126-memory-retrieval-benchmark.mjs`: adversarial Turkish-I simulation added; all query-evidence rows now receive explicit independence group IDs.
- `CHANGELOG.md`: entry added.
- Commits: source `beca77182364dac3f27e8a0f90d42cc3cb77f612`; first regression `bf48493e096286b74b5beafecb367d408440bfc6`; changelog `6a46554cf8f698ae7ebb2737f842c558c2f850fe`; test fixture correction `396e1241226820a0dcd64ea92dbaaf33eaba024f`.
- PR #1059 remains Draft; no merge, no branch deletion, no force-push, no Release publication.

## Проверки и ограничения

- Live source HEAD f1cbaa…: 9/9 check-runs SUCCESS.
- PR #1059 first run was 16/17: the new fixture omitted required `independenceGroupId`; this was corrected in commit `396e1241226820a0dcd64ea92dbaaf33eaba024f`. Final exact code/test head `67460ab86ca25179b2d4125cc7dbe1d692b60f80` passed **18/18 SUCCESS**. Memory integrity [run 44908870023](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44908870023): `TYPECHECK=PASS` in Node strip-syntax mode (719 files), `BIG_PASS_126_MEMORY_RETRIEVAL_BENCHMARK=PASS`, `MEMORY_RETRIEVAL_EXPERIMENT=PASS`. Benchmark recallDelta=0 and remains not-promoted; experiment has three seeds (13, 29, 53), not the five-pair confirmatory gate.
- Runtime typecheck mode: `node-strip-syntax-only`, 719 files; semantic `tsc` was unavailable in that workflow.
- No local test execution is claimed. No recall uplift, holdout improvement, device performance, initiative cadence, visual quality, release parity or legal approval is claimed.
- ZIP bytes could not be materialized; only GitHub metadata digest/size were verified.

## Implemented / connected / tested / released

| Component | Implemented | Connected | Tested | Released |
|---|---|---|---|---|
| MemoryOS2 locale-neutral normalization | Yes, existing source | Canonical MemoryOS2 path | PR #964 integrated; current source checks pass | October ZIP only; November source not released |
| BM25 benchmark locale-neutral fix | Yes, PR #1059 branch | Existing benchmark harness | 18/18 exact-head checks SUCCESS; synthetic fixture PASS, recallDelta=0, not promoted | No |
| Core / OrganismBus | Existing canonical source | Unified runtime | Source exact-head Actions 9/9 | No November source release |
| UserModel explicit forget | Existing v2 | Canonical tombstone path | 44882282643 SUCCESS | No |
| Avatar 2D/affect | Existing renderer contracts | Shared motor/affect path | Relevant source check-runs SUCCESS | Visual/device E2E not released |
| Speech/mobile/independent holdout | Contracts/harnesses exist | Full real-world integration not proven | No device/holdout evidence | No |

## Изменения адаптивных целей

- Повысить приоритет детерминизма benchmark baseline: baseline document tokens и query tokens должны иметь одну и ту же Unicode case-fold policy.
- Не продвигать #903 stack: divergence 180/893 делает прямой rebase/merge небезопасным; требуется отдельная source-based salvage оценка.
- Сохранить P0 gates: independent RU/EN holdout ≥5 paired seeds, human license review, ZIP byte-level parity, browser/WebGL E2E и Android/Termux soak.
- Не повышать общую готовность: новых независимых holdout/device/release доказательств нет.

## Следующие 5 действий

1. Оставить PR #1059 Draft до отдельного решения пользователя; перед любым продвижением перечитать live head/Actions и проверить, что base не сдвинулся.
2. Обновить PR #1059 verification notes; оставить Draft до отдельного решения пользователя.
3. Продолжить source-based salvage audit #903 без rebase, force-push или merge.
4. Получить ZIP bytes через поддерживаемый artifact path и выполнить независимый SHA-256 + extraction manifest + source/ZIP parity.
5. Организовать независимый RU/EN holdout и целевые browser/WebGL + Android/Termux soak; сохранить human license decision gate.

---
Handoff: следующий цикл должен начать с live PR #1059 head/Actions, затем сравнить #903 stack с текущим `workpass70-source`. Не считать эту feature-ветку частью canonical source до явного merge пользователем.
