# NK1 / NeuroCore — реестр консолидации — 2026-11-23

## Каноническая линия

- Репозиторий: `ailtron1ss-rgb/NK1`; аккаунт записи: `ailtron1ss-rgb`.
- Каноническая ветка: `workpass70-source`.
- Текущий source после PR #1132: `04f8da1a3696e564acab59c6f4a8473ba714f62e`.
- Tree SHA source и PR head: `38b28d9eda4f3c9e18f935e57f58507d94d749c4` — дерево совпало точно.
- `main` не менялся: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.

## Реальное слияние этого запуска

PR [#1132 — Shared Future / World Forge / Consequence Ecology](https://github.com/ailtron1ss-rgb/NK1/pull/1132) слит в `workpass70-source` методом squash.

- Source base: `3c823af9d8ffe580b621e83b36fe2e9a92a5eba4`.
- PR HEAD: `642b5e3ff67c55cbe0f9910bb13bb5e6c493ced1`.
- PR tree: `38b28d9eda4f3c9e18f935e57f58507d94d749c4`.
- Merge result: `04f8da1a3696e564acab59c6f4a8473ba714f62e`.
- 5 commits, 25 files, +6,709 / -10; compare до слияния: 5 ahead / 0 behind.
- Exact-head Actions: 65/65 SUCCESS. В workflow [NeuroCore core regression validation #7583](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45138568479) шаг `Shared Future, World Forge and Consequence Ecology regressions` завершился SUCCESS.
- Нет unresolved review threads; PR был mergeable, base и HEAD совпадали с проверенными SHA.
- Новых runtime dependencies нет; `package-lock.json` не изменялся.

## Побайтное сохранение старых аспектных изменений

Две пары refs были точными дубликатами по commit SHA; уникальные изменения проверены по blob SHA и выборочно перенесены в PR #1132:

- **Consequence Ecology** — old commit `f9621bf3e4411ce17bc809922a5f90126001f4fd`, tree `7711398fa119a30218f44f2d2049cbe985a1d20b`. Test blob `4fe2e28c5df94127b53ece4ab6f74bce8cde1bd5` сохранён без изменений. Implementation blob `efd61442efc2561f0ee6725f14506e21c352dc7a` усилен до `57fac8271e2fde2336f9409ed12d0e201eb9af16`: restore теперь сверяет canonical outcome, decision binding, evidence identity, timestamps и пересчитанные Brier значения.
- **World Forge / Shared Future** — old commit `68a03799ca0c9f18e4c6e19399ed8018e0215e60`, tree `513c63b24385ce4dedc793200052e3f29b84bf78`. `SharedFutureEngine.ts` расширен с blob `a95fec851f9c7b23d527aad821592f11580779e4` до `fa600c776fc3cbda0527123f46e89d7cef036008` (+44 строк, без удалений); `WorldForge.ts` получил bounded default для candidate multiplier: `491f6cfc2da941a8889c5d379728d06e43131193` → `cf79894e53fd9d48a11e27296e8c6f525c5f076a`.
- World Forge остаётся synthetic-only; Consequence Ecology — analysis-only; canonical owners OrganismCore/ActionGateway сохранены. Никакого auto-execution или реального подтверждения мира эти модули не добавляют.

## Полный branch census

Снимок после merge #1132 и перед self-update этого docs branch:

- **1,124 refs**, **1,106 уникальных HEAD**, **3 группы точных duplicate HEAD**, **18 избыточных refs**.
- Предыдущий полный branch census: 1,114; изменение: **+10**. Из них +9 новых refs относительно прошлого снимка и +1 временная ветка этого реестра.
- Census файл: `docs/consolidation/branch-census-2026-11-23-live.jsonl`. Он фиксирует tip docs branch до коммита обновления самого census-файла — ожидаемая граница снимка.

### Точные дубликаты commit/tree

1. Commit `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`, tree `4525cefe9efccd05c897846b1c806b783feb3002` — 17 refs:
   `nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass79-cognitive-rebuild`, `workpass116-seed-clustered-learning-eval`, `workpass117-verified-replay-admission`, `workpass118-multi-source-learning-integration`, `workpass119-skill-retrieval-feedback-curriculum`, `workpass120-verified-skill-revision-gate`, `workpass121-ledger-bound-promotion-proposals`, `workpass122-promotion-gate-coverage-hardening`, `workpass123-authenticated-skill-lifecycle`, `workpass124-learning-evidence-hardening`, `workpass135-durable-shadow-run-registry`, `workpass203-independent-candidate-evaluator`, `workpass206-runtime-evaluator-wiring`, `workpass313-actions-history-audit`.
2. Commit `f9621bf3e4411ce17bc809922a5f90126001f4fd`, tree `7711398fa119a30218f44f2d2049cbe985a1d20b` — 2 refs: `aspect/consequence-ecology-20261117`, `integrate/consequence-calibration-lineage-followup-20261120`.
3. Commit `68a03799ca0c9f18e4c6e19399ed8018e0215e60`, tree `513c63b24385ce4dedc793200052e3f29b84bf78` — 2 refs: `aspect/world-forge-integrated-20261117`, `integrate/worldforge-to-sharedfuture-after-calibration-20261120`.

### Открытые PR-зависимости

Четыре открытых PR используют `workpass206-runtime-evaluator-wiring` как base — одну из 17 refs первой группы:

- [#109 — dependency boundaries and graph audits](https://github.com/ailtron1ss-rgb/NK1/pull/109)
- [#124 — cognitive-state persistence and learning integrity](https://github.com/ailtron1ss-rgb/NK1/pull/124)
- [#91 — Operation Omega / Hexis](https://github.com/ailtron1ss-rgb/NK1/pull/91)
- [#86 — canonical P23 revision evidence](https://github.com/ailtron1ss-rgb/NK1/pull/86)

У двух малых пар на момент census нет открытых PR с их refs в head/base, но остаются исторические PR-ссылки и непроверенные downstream references.

## Открытые PR и блокеры

- Полный open-PR census на момент снимка: **250** (предыдущий полный census — 270, динамика **−20**). Файл: `docs/consolidation/open-pr-census-2026-11-23.jsonl`; он будет обновлён после создания этого docs PR.
- [PR #1131 — WorkPass622 runtime learning-journal wiring](https://github.com/ailtron1ss-rgb/NK1/pull/1131) не относится к duplicate refs. Его HEAD `0856776970b3859d925a131f77839cf29d5dff53` прошёл 59/59 checks, но base `3c823af9...` стал позади текущего source `04f8da1...` на один commit после merge #1132. Требуется sync/rebase и повтор exact-head CI.
- Безопасных branch refs для удаления сейчас: **0**. Точные дубликаты — только кандидаты. Для 17-ref группы есть 4 открытые PR-зависимости; для всех групп ещё не завершён полный downstream workflow/config/deployment/reference audit.
- Ни одна старая ветка не удалялась и не переименовывалась.

## Release ZIP

Последний опубликованный asset по GitHub metadata: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, tag `Neuro` от 2026-10-19, metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. ZIP bytes не удалось материализовать и пересчитать локально; parity с `workpass70-source` не заявляется.