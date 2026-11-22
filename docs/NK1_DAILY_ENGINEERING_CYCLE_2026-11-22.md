# NK1 / NeuroCore — ежедневный адаптивный инженерный цикл — 2026-11-22

## Краткий итог

Live source продвинулся до a98dbfe858be2df19fa01a78639a23f962920aa0. Этот SHA имеет 18/18 завершённых GitHub Actions check-runs SUCCESS. После предыдущего checkpoint PR #1059 и PR #1083 были слиты внешним образом; PR #1079 сохранил 15 уже интегрированных branch histories. Эти merges не приписываются текущему циклу.

Runtime production code не менялся. При проверке HMX persistence найден конкретный пробел в тестовом покрытии: replay проверялся только в одном процессе. Расширен существующий real-server consent regression: после explicit apply сервер останавливается и запускается заново с тем же STATE_DIR; проверяются восстановление accepted stage и canonical hypothesis, сохранение redaction и replay без повторной вставки. Создан Draft PR #1085; его HMX workflow и все 14 exact-head check-runs прошли SUCCESS. Handoff/census сохранены в существующем Draft PR #1084; canonical workpass70-source не изменялся.

## Счётчики

| generated | attempted | completed | partially_completed | blocked | deferred | verified |
|---:|---:|---:|---:|---:|---:|---:|
| 18 | 15 | 6 | 3 | 6 | 3 | 6 |

attempted включает завершённые, частично выполненные и заблокированные задачи. completed не означает released.

## Live snapshot и доказательства

- Repository: https://github.com/ailtron1ss-rgb/NK1
- workpass70-source: a98dbfe858be2df19fa01a78639a23f962920aa0; main: 06e01cdd0a8e60ed70991f22e842887f544d1ebf.
- Source exact-SHA Actions: 18/18 SUCCESS; все check-runs завершены и привязаны к source SHA.
- Branch census before PR #1085: 1,073 refs / 1,055 unique HEADs / 3 duplicate-tip groups / 18 excess aliases. The new PR branch adds one distinct ref/HEAD: derived current total 1,074 / 1,056, with duplicate groups and excess aliases unchanged; full branch pagination was not repeated after branch creation.
- Open PR census at full-pagination snapshot: 270 open PRs / 270 unique heads / 205 Draft / 65 Ready. After PR #1085, live API confirms 271 open PRs / 271 unique heads / 206 Draft / 65 Ready.
- workpass70-source protected=false; main protected=false. Не полагаться на branch protection вместо exact-SHA checks.

### Важные внешние интеграции, наблюдавшиеся в GitHub

- PR #1059 merged externally 2026-11-21; merge commit a21821d91ddc27f701c296deac27014247661cde. BM25 benchmark tokenization стала locale-neutral. Synthetic recallDelta=0; independent uplift не заявляется.
- PR #1079 merged externally 2026-11-21; preserved 15 already-integrated branch histories in ancestry, without branch deletion.
- PR #1083 merged externally 2026-11-22; merge commit/source HEAD a98dbfe858be2df19fa01a78639a23f962920aa0. Added bounded HMX 1.7 outbound export and external-file staging.

### HMX integration evidence

- Current source contains HexisHmxCanonicalMemoryBridge.ts with stage/commit path, HexisAdaptationFabric staging/decision state, and server routes /stage, /decide, /apply.
- Server apply route requires confirmed=true; core apply requires an accepted stage. Tests assert stage/accept are review-only, pre-accept apply is refused, explicit apply writes canonical records, and replay does not duplicate records.
- Workflow .github/workflows/nk1-hexis-hmx-canonical-memory-bridge.yml runs npm ci, runtime typecheck, canonical HMX bridge regression, explicit-apply consent regression and Hexis adaptation test. Current source exact Actions include canonical-hmx-memory and action-governance SUCCESS.
- This proves the tested local server/adapter path, not trustworthiness of every external donor or full interoperability with all Hexis deployments.

### Дополнительное доказательство persistence после process restart

- До изменения текущий HMX consent test доказывал idempotency только в одном server process; это не закрывало crash/restart границу.
- PR #1085 останавливает server после первого apply, запускает новый process на том же временном STATE_DIR, проверяет единственную восстановленную canonical hypothesis и повторяет apply.
- После restart: `inserted=0`, `replayed=1`, количество canonical memory rows не меняется. Известный fixture token остаётся redacted.
- Exact PR HEAD `4288d530d16e476d0e83ee3df3cbbb48134fa328`: **14/14 SUCCESS**, включая HMX canonical-memory workflow. Это подтверждает текущий file-backed server path, но не заменяет power-loss/hardware soak.

## 18 направлений и задачи цикла

| ID | Домен / конкретный результат | P | Зависимости | Риск / обратимость | Критерий приёмки | Источник факта | Статус / доказательство |
|---|---|---:|---|---|---|---|---|
| NK1-D2026-11-22-01 | Core / OrganismBus: синхронизировать live source и проверить exact-SHA checks | P0 | Live branch | Низкий, read-only | Все check-runs завершены SUCCESS и имеют один exact head_sha | Branch API + commit check-runs | **done / verified** — 18/18 на a98dbfe |
| NK1-D2026-11-22-02 | Perception / world model: проверить новый provenance/calibration defect | P2 | 01 | Низкий, no-op | Новый work только при воспроизводимом дефекте admission/provenance | world-perception-integrity check | **deferred / no-new-work** — check SUCCESS, нового failing case нет |
| NK1-D2026-11-22-03 | Memory ingest/admission: подтвердить, что HMX stage/accept не пишет в canonical memory | P1 | HMX bridge, MemoryOS2 | Средний, обратимый | Stage и accept не меняют MemoryOS2; только explicit apply пишет | HMX bridge + explicit-apply consent workflow | **done / verified** — текущий source workflow и regression присутствуют |
| NK1-D2026-11-22-04 | Retrieval: проверить интеграцию locale-neutral BM25 tokenizer | P1 | MemoryOS2 benchmark | Низкий, обратимый | Единая case-normalization policy; Turkish-I regression; exact source checks | PR #1059 merge + current source | **done / verified** — merged externally; uplift не доказан, recallDelta=0 |
| NK1-D2026-11-22-05 | Consolidation/MemFS: доказать сохранение accepted HMX stage и replay receipt после перезапуска сервера | P1 | HMX bridge, durable organism state, MemoryFabric receipts | Средний, тестовое изменение обратимо | После restart stage и hypothesis остаются; повторный apply вставляет 0 строк и возвращает replay=1 | `hexis-hmx-explicit-apply-consent.mjs`; exact-head HMX workflow | **done / verified** — PR #1085 HMX workflow SUCCESS; `HEXIS_HMX_EXPLICIT_APPLY_CONSENT=PASS` после restart |
| NK1-D2026-11-22-06 | Motivation/drives: получить 24h initiative cadence telemetry | P1 | Scheduler + target host | Высокий, hardware/soak | ≥1 объяснимая инициатива/час без interrupt/permission violation | Нет 24h telemetry artifact | **blocked** — нет целевого runtime soak |
| NK1-D2026-11-22-07 | Planning/selector: оценить source divergence для Shared Future stack #903 | P1 | Current source + PR head | Средний/высокий, read-only | File-level salvage без rebase/merge/force-push | GitHub compare API | **partially_completed** — 180 ahead / 994 behind, merge-base 1e83a011; salvage не выполнялся |
| NK1-D2026-11-22-08 | ActionGateway/tools: подтвердить consent/idempotency boundary HMX apply | P1 | 03, OrganismCore | Средний, обратимый | Unconfirmed или не accepted stage не меняет memory; replay не дублирует | server.mjs + HMX tests/workflow | **done / verified** — explicit confirmed=true + accepted stage, current CI green |
| NK1-D2026-11-22-09 | Reflection/outcome: получить независимые host-owned postcondition receipts | P1 | Outcome verifier + independent labels | Высокий, evidence-gated | Outcome привязан к exact decision/action/state transition; ACK не считается outcome | Нет независимого outcome dataset | **blocked** — external evidence/host receipt недоступны |
| NK1-D2026-11-22-10 | SelfModel: проверить autobiographical continuity across restart | P2 | Persisted self state | Средний, read-only | Restart/replay сохраняет авторство и evidence boundaries | Нет нового restart/continuity trace | **deferred** — отдельный воспроизводимый дефект не обнаружен |
| NK1-D2026-11-22-11 | UserModel/ToM: сверить explicit correction/forget evidence boundary | P1 | UserModel v2 | Средний, обратимый | Explicit-forget exact check SUCCESS; отдельные ToM claims не повышают trust | explicit-forget check on source SHA | **partially_completed** — exact check PASS; полный ToM E2E не доказан |
| NK1-D2026-11-22-12 | EthicalGate/PEA: завершить release license review | P0 | Human legal decision | Высокий, необратимый gate | Human reviewer + hash-bound license decision для всех компонентов/архивов | RELEASE_LICENSE_REVIEW.json | **blocked** — pending, redistributionApproved=false |
| NK1-D2026-11-22-13 | Embodiment: проверить renderer-neutral motor/affect contracts | P1 | MotorFrame + renderer adapters | Средний, read-only | CI contract checks pass; отдельный browser visual E2E нужен для полного подтверждения | original-avatar-motor-coupling, avatar-cognitive-affect, browser-affect | **partially_completed** — contract CI PASS, visual E2E отсутствует |
| NK1-D2026-11-22-14 | Avatar assets: подтвердить GLB/VRM provenance, rig и redistribution rights | P0 | Human asset/license review | Высокий, legal gate | Exact asset hash, rig/texture manifest и права распространения | Нет human asset approval | **blocked** — нельзя считать production asset approved |
| NK1-D2026-11-22-15 | Speech: измерить interrupt и audio-lip drift на физическом устройстве | P1 | ASR/TTS + audio device | Высокий, hardware | Lip-sync drift ≤80 ms и interrupt ≤200 ms на реальном устройстве | Нет device trace | **blocked** — hardware measurement отсутствует |
| NK1-D2026-11-22-16 | Mobile: Android/Termux offline/background soak | P1 | Android phone + Termux | Высокий, hardware | 10k deterministic ticks, ≤50 ms phone tick, state recovery after background/foreground | Нет phone soak artifact | **blocked** — физический device run недоступен |
| NK1-D2026-11-22-17 | App/API/infra: не создавать новые Supabase/MongoDB/Redis схемы без разрешённой потребности | P2 | Existing adapters + authorization | Низкий, no-op | Только существующий adapter и explicit authorized scope | Current architecture rules | **deferred / no-new-work** — внешняя инфраструктура не менялась |
| NK1-D2026-11-22-18 | Validation/CI/branch convergence: пересчитать branch и open-PR topology | P0 | GitHub API pagination | Низкий, reversible docs | 1073 refs, 1055 unique heads, 270 open PRs; no branch deletion | 11 branch pages + 3 PR search pages | **done / verified** — census обновлён в existing Draft docs PR #1084 |

## Реальные изменения этого цикла

- Runtime production code: не менялся. Test-only persistence regression добавлен в Draft PR [#1085](https://github.com/ailtron1ss-rgb/NK1/pull/1085), branch `test/hexis-hmx-restart-idempotency-20261122`, head `4288d530d16e476d0e83ee3df3cbbb48134fa328`. HMX workflow [run 45030481553](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45030481553) SUCCESS; logs подтвердили typecheck (723 files, Node strip-syntax mode), canonical bridge, consent/restart regression и Hexis adaptation PASS. Все 14 exact-head check-runs на PR #1085 завершились SUCCESS.
- Документация и handoff обновлены в существующей ветке docs/neurocore-project-map-analysis-20261121 через Draft PR #1084; canonical workpass70-source не изменялся.
- Обновлены AGENTS.md, README.md, NEUROCORE_START_HERE.md, living project map, branch census и open-PR census; добавлен этот daily report.
- PR #1084 и PR #1085 остаются Draft и не слиты. Ветки, PR и история не удалялись; force-push и Release publication не выполнялись.

## Implemented / connected / tested / released

| Компонент | Implemented | Connected | Tested | Released |
|---|---|---|---|---|
| Core / OrganismBus | Existing canonical implementation | Unified source runtime | Current source 18/18 Actions | November source not released |
| HMX 1.7 import/export | Bounded export, staging, explicit apply | Server routes + canonical MemoryOS2 bridge | HMX workflow and consent/idempotency regressions in current source CI | Not in October ZIP |
| BM25 retrieval benchmark | Locale-neutral tokenization fix | Existing benchmark harness | Merged PR #1059; current source checks pass; recallDelta=0 | Not in October ZIP |
| UserModel explicit forget | Existing v2/tombstone path | Canonical user evidence path | explicit-forget check SUCCESS | Not in October ZIP |
| Avatar / affect | Existing motor and renderer contracts | Canonical embodiment path | Relevant source CI checks SUCCESS | Visual/device E2E not released |
| Speech / mobile | Existing partial adapters | Full hardware integration not proven | No physical device measurement | No |

## Release, licensing and readiness limits

- Stable Release tag Neuro and latest prerelease workpass70-hotfix1-2026-10-19 are October 19 assets. Metadata SHA-256 is available; archive bytes are not.
- Independent ZIP hash, extraction manifest and source/ZIP parity remain UNVERIFIED. November source changes are not RELEASED.
- Human license review remains pending: root NOASSERTION, runtime private/all-rights-reserved, 477 locked npm components and 8 source archives pending review; redistributionApproved=false.
- Independent RU/EN holdout with ≥5 paired seeds and positive confidence-supported recall uplift is not established.
- No 24h initiative cadence, Android/Termux soak, 10k phone ticks, lip-sync drift or interrupt latency was measured.
- Analysis coverage in the project map is now 40% (audit depth only); this is not a NeuroCore product-readiness percentage. Product readiness is not raised.

## Изменения адаптивных целей

- Закрыто: source exact-head sync; BM25 locale-neutral defect is integrated; HMX stage/decide/apply consent and replay contract are connected and CI-covered; current branch/PR census refreshed.
- Повышен приоритет: source-based salvage analysis for #903 and #866, because source divergence is now quantified and #866 overlaps current HMX behavior.
- Не повышать: memory uplift, autonomy, avatar, speech, mobile or release readiness without independent holdout/device/legal evidence.

## Следующие 5 действий

1. Re-read PR #1085 live head and Actions before any further edit; it is Draft and 14/14 exact-head checks currently pass.
2. Compare #866 against current HMX bridge file-by-file; preserve it and record only genuinely unique behavior.
3. Perform source-based selective salvage of #903; preserve its branch history and avoid force-push.
4. Run independent RU/EN holdout with at least five paired seeds and immutable split manifest.
5. Materialize the October 19 ZIP through a supported path; independently hash/extract and obtain human license/asset review; schedule browser/WebGL and Android/Termux device soak.

## Handoff

Next cycle must start from live workpass70-source @ a98dbfe858be2df19fa01a78639a23f962920aa0, not the old 2026-11-21 handoff. First inspect PR #1085 head/Actions and PR #1084 documentation head; then continue #866/#903 source-based salvage. No PR merge, branch deletion, force-push or Release publication was performed.