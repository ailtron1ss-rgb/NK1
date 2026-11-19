# NK1 — журнал консолидации веток и PR (2026-11-19)

## Статус этой волны

Это первый безопасный исполнительный проход, а не заявление о завершении полного аудита 1 035 веток. Цель — уменьшить подтверждённые дубли, сохранив весь исходный код, PR provenance и исторические связи.

## Контрольные точки

- Repository: `ailtron1ss-rgb/NK1`
- Рабочая source-линия: `workpass70-source`
- Проверенный HEAD на 2026-11-19: `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`
- `main` остаётся отдельной веткой release/report metadata; не используется как замена рабочей source-линии.

### Архивная база от 19 октября

Основной Release asset:
- Tag: `Neuro`
- File: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Size: 135,290,615 bytes
- SHA-256 (Release metadata): `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`
- Tag commit: `c2e8e4a78431734612f89318e79d3491643f24f3`

Отдельно существует prerelease hotfix:
- `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`
- SHA-256: `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`
- Release note указывает, что это implementation hotfix, не production-approved.

**Ограничение:** в текущем проходе доступны Release metadata и контрольные хэши, но не сами бинарные ZIP-байты. Архив не извлекался, перечень файлов и побайтовое сравнение с текущим source не выполнены. GitHub compare `Neuro...workpass70-source` возвращает `No common ancestor`, поэтому нельзя считать их обычной merge-историей. Побайтовая сверка ZIP остаётся обязательным gate перед любым утверждением о parity или release readiness.

## Повторная инвентаризация GitHub refs

Снимок на 2026-11-19:
- 1 035 branch refs, 11 страниц API (100 × 10 + 35).
- 944 уникальных HEAD SHA.
- 12 групп одинаковых HEAD; 91 избыточное имя ссылки сверх уникальных HEAD.
- По сравнению со снимком 2026-11-18 добавились ровно два refs:
  - `aspect/kurisu-embodiment-assets-20261118` @ `05148c16e53e4ff7e1d238164bebd4aa610dd36e`
  - `consolidation/nk1-branch-census-20261118` @ `e8b3a4345fb8728c0a3f609c10b6fef48a4d07a8`
- Имена прежних веток не исчезли и их HEAD не перемещались при повторном чтении.
- Сохранены исторические снимки и их исходные числа: 1 033 refs / 942 unique HEAD на 2026-11-18.

Текущий PR census после закрытия четырёх точных дублей:
- 939 PR всего
- 412 open
- 310 merged
- 217 closed without merge

## Подтверждённая консолидация PR

Закрыты как точные дубликаты (без merge):
- #845 → канонический #857
- #849 → канонический #857
- #850 → канонический #858
- #851 → канонический #859

Доказательства:
- #845/#849/#857 имеют одного родителя `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8` и одинаковое результирующее Git tree `1bbd25f24f33372f3458c67ecec4b014553054d9`.
- #850/#858 имеют того же родителя и одинаковое tree `323b16360994f6d9df9f58264176bbda435f7517`.
- #851/#859 имеют того же родителя и одинаковое tree `7ca0bccd2c51a2b16a3bcdf7ca21ef000429664e`.
- До закрытия проверено, что никакие другие открытые PR не используют закрываемые ветки как head или base.
- Каждый закрытый PR получил комментарий с обоснованием и ссылкой на сохранённый канонический PR.

Эти документы/планы остаются тремя разными вариантами (16 фаз, 30 фаз, 10 стадий); были удалены только точные дубли внутри каждой группы, не объединены разные версии планов между собой.

## 81 ветка с одним и тем же HEAD

У 81 имени один и тот же commit:
- HEAD: `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`
- Tree: `4525cefe9efccd05c897846b1c806b783feb3002`
- Parents: `05dcb1df6cd723474d06cd4fd542171eebb5e5f4`, `6b20aa2b6a9d4b8ed1456a9e3ab97631ca1756ff`

Ветка сравнивалась с `workpass70-source`: это общий старый предок (0 commits ahead / 982 behind), а не актуальная самостоятельная реализация.

Дополнительный PR-reference аудит по историческому census:
- 77 из 81 имени присутствуют в head/base refs исторических PR.
- 4 имени не встречаются ни в одной из 937 PR-записей: `feature/useful-functions`, `workpass73-audit-fixes`, `workpass94-avatar-voice-live2d-audit`, `workpass168-hermes-runtime-compound-skill-bridge-test`.
- 4 refs используются как base в открытых PR: `nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass206-runtime-evaluator-wiring`. Последний также имеет исторические PR-связи как head.

Следствие: совпадение HEAD доказывает одинаковый конечный commit/tree, но не отсутствие исторического значения. Нельзя маркировать 77 исторически использовавшихся refs как неиспользуемые. Даже четыре refs без PR-связей нельзя удалять без проверки tags, workflows, branch rules, deployments и внешних ссылок.

## Активы воплощения: PR #950

Существующий Draft PR #950 сохраняет 8 отсутствовавших sprite PNG и 4 render/screenshot-варианта. Его описание фиксирует перенос 12 бинарных объектов через Git blob API с проверкой SHA blob (без пересохранения изображений). Runtime-код не менялся, спрайты пока не подключены к UI, варианты render evidence сохранены отдельно до выбора. #950 оставлен без изменений; его merge не выполнялся.

## Целевая архитектура веток

Проектная таксономия в `branch-taxonomy-and-target-structure-2026-11-18.md` предлагает 13 долгоживущих доменов:
1. core-organism-runtime
2. memory-and-retrieval
3. learning-and-neuroplasticity
4. motivation-autonomy-planning
5. affect-personality-usermodel
6. embodiment-avatar
7. voice-and-speech
8. tooling-and-integrations
9. safety-trust-and-governance
10. evaluation-and-observability
11. client-mobile-and-ux
12. infrastructure-release-and-operations
13. research-and-assimilation

Это целевая модель, не окончательная классификация всех веток. Тематические отнесения должны быть подтверждены commit ancestry, changed paths, patch/blob hashes, зависимостями, тестами и использованием в PR. Долгоживущие ветки — аспектные; небольшие изменения — временные task branches внутри нужного домена; исторические refs сохраняются как provenance до прохождения всех проверок.

## Что в этой волне не менялось

- Не менялись `workpass70-source` и `main`.
- Не изменялись исходники проекта, зависимости или release ZIP.
- Не выполнялись merge исходных/runtime PR.
- Не удалялись Git branch refs и commit objects.
- Не закрывались PR, кроме четырёх доказанных exact duplicate master-plan PR.
- PR #949 остаётся Draft; его документы — audit/report, не runtime integration.

## Ограничения инструментов текущего прохода

Текущая GitHub-интеграция поддерживает чтение refs/PR/файлов и управление PR, но не предоставляет отдельной операции удаления branch refs. Бинарный Release ZIP также не удалось материализовать для извлечения в текущем runtime. Поэтому массовое удаление веток и побайтовый parity gate здесь не выполнялись.

## Следующая очередь аудита

1. Снять единый актуальный snapshot всех branch refs, PR heads/bases, tags, workflow triggers и protection/ruleset references.
2. Полностью разобрать оставшиеся 11 duplicate-HEAD групп; затем exact-duplicate trees и ветки, которые делят один общий base.
3. Проходить похожие runtime-кластеры не по именам, а по полным changed-file/patch/blob сравнениям, сохраняя уникальные строки, импорты, конфигурацию, документы, assets, URLs и тестовые сценарии.
4. В первую очередь углубить avatar/unified-brain cluster (#848/#856/#844 и родственные PR), затем N.E.K.O. plugin/runtime, memory/HMX и learning/neuroplasticity кластеры.
5. Для каждого домена создать/использовать одну актуальную aspect-ветку от `workpass70-source`; переносить только подтверждённые уникальные изменения с provenance и проверками.
6. Удалять refs только после проверки всех head/base refs, tags, workflows, rulesets, deploy references и архивирования полного списка исходных SHAs.
7. После materialization Release ZIP выполнить extraction manifest + per-file SHA256 + binary/text diff и проверить происхождение/лицензии assets.

**Итог:** в этом проходе подтверждены 4 точных PR-дубликата и безопасно закрыты; число веток осталось 1 035. Полная веточная консолидация и побайтовый аудит архива ещё не завершены.

## Live refresh — 2026-11-19 (после merge #950)

### Актуальная перепись refs и PR

- Branch refs: **1 038**; уникальных HEAD SHA: **947**; групп одинаковых HEAD: **12**; избыточных имён поверх уникальных commit tips: **91**.
- Ветка `workpass70-source`: `0a3e4c4e51d7c2ec154a87cc0912e4a1cd6752e0`.
- От контрольной точки `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33` GitHub compare показывает **3 commits ahead / 0 behind**. Последний коммит — merge #950.
- Branch census files: `branch-census-2026-11-19.json/.md`.
- Pull requests: **942 total / 413 open / 312 merged / 217 closed without merge**; **926** distinct PR head refs, **412** distinct open head refs.
- PR census files: `pull-request-census-2026-11-19.json/.md`.
- По сравнению с реестром 2026-11-18 обнаружены пять новых refs и ни одного исчезнувшего: `aspect/embodiment-skeletal-3d-kinematics-20261119`, `aspect/kurisu-embodiment-assets-20261118`, `aspect/memory-hmx-semantic-integrity-20261119`, `aspect/tooling-neko-plugin-integrity-20261119`, `consolidation/nk1-branch-census-20261118`. Полный перечень и HEAD SHA находится в новом JSON.

### Движение PR в текущем окне

- **#950 — MERGED** (2026-11-19 05:08:41 UTC): 13 файлов, +33/-0. В source сохранены 8 PNG спрайтов Курису, provenance-документ и 4 изображения visual evidence. Это сохранение ресурсов; подключение их к renderer/UI отдельно не доказано.
- **#952 — MERGED** (2026-11-19 05:05:40 UTC): 2 Markdown-файла, +209/-0. Добавлены русская спецификация manifest policy и file-level reconciliation N.E.K.O. plugin веток. Merge commit #952 — `9742b5a82966e11ba9c913074615b2420736bcee`; затем source продвинут merge #950 до `0a3e4c4…`.
- **#951 — OPEN / Draft**: 8 файлов, +672/-1, 3D skeletal kinematics. Полный diff, зависимости и exact-head CI должны быть проверены до интеграции.
- **#953 — OPEN / Draft**: 17 файлов, +2 551/-112, HMX / bitemporal MemoryOS2. Требует построчной сверки с актуальной временной семантикой MemoryOS2 и полного CI.
- **#949 — OPEN / Draft, audit-only**. PR создан относительно `7547f528…`; source теперь `0a3e4c4…`. Перед merge требуется заново проверить merge-base и отсутствие конфликтов; это не runtime PR.

### Границы и безопасность

- В этом обновлении изменяются только отчёты на ветке консолидации. Рабочие runtime-файлы, `main` и Release ZIP не редактируются.
- Ни один runtime PR не был объединён этим обновлением; #950 и #952 уже были merged в GitHub на момент проверки.
- Ветки не удалялись. Совпадающий HEAD не равен доказательству ненужности ref: исторические PR, head/base refs, workflows, tags, rulesets и deployment references нужно учитывать отдельно.
- Основной архив 19 октября: tag `Neuro`, `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135 290 615 bytes, release metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`, tag commit `c2e8e4a78431734612f89318e79d3491643f24f3`. ZIP-байты не удалось получить в текущем runtime; состав архива, extraction manifest и побайтовая сверка остаются невыполненными gate.
- GitHub compare между tag `Neuro` и текущим source сообщает `No common ancestor`; нормальный merge ancestry и parity нельзя предполагать.


## Final live CI / source correction after the last refresh

- PR #951 is merged (not Draft). Its exact donor head `0a289c1ddc4c19da4def7409b4e28ef85cb6854c` has 44/44 workflow runs completed successfully; merge commit and current source checkpoint are `aa2b385153ddc316eadf61f87e2c0803d7d59d98`. This remains a bounded library port, not end-to-end embodiment wiring.
- PR #953 remains open / Draft at `fbab11da4e07a09282b8cb043904a05a4f638663`, 22 files (+2,668/-113). A later exact-head Actions read returned 50/50 completed successful runs (0 pending, 0 failure). The current source vs PR compare is still diverged: 22 commits on the PR side and 2 on the source side after merge-base `9742b5a82966e11ba9c913074615b2420736bcee`. Keep the PR Draft pending code-level review and source rebase/revalidation.
- The earlier note that #953 had two pending jobs is a historical intermediate observation and is superseded by the 50/50 final run result.


## 2026-11-19 execution update — selective source migrations

- **PR #138 MERGED** into `workpass70-source`: merge commit `08053819c8fb91861703736d63f1459ad4be121b`. Its original 38-file donor patch was reduced to four files: operational micro-cycle runtime, finite-input regression test, runtime package manifest and WorkPass296 workflow. Exact-head CI: **22/22 successful**. The new boundary validates malformed observations before host-state access, accepts own sensor properties only, fails closed on inherited/throwing/malformed sensor values, and shares one normalized snapshot across homeostasis, life continuity and neural input.
- **PR #131 MERGED** into `workpass70-source`: merge commit `3a185b341e85ca9a8d3f3d1679a1f4464416b6c2`. Its original 67-file donor patch was reduced to six files: shared Node/npm policy, tests, installer, doctor, root package scripts and WorkPass71 workflow. The source's tracked-artifact guard in `super-doctor` was preserved. Exact final-head CI: **7/7 successful**.
- The 17-ref duplicate-tip group was not deleted or force-updated. Current active old-base dependencies: #109 on `nk1-all-branches-merge-2026-10-23`; #112/#91/#86 on `rebuild`; #124 on `workpass206-runtime-evaluator-wiring` — five open PRs over three old refs.
- Fresh live census: **953 refs**, 937 unique HEADs, one 17-name duplicate group, 16 excess aliases. Ten names in the previous 963-ref inventory are absent; no new names appeared. This is not attributed to this session.
- PR #949 audit branch is being refreshed to the post-#131/#138 source and current census; it remains Draft pending review of its complete documentation bundle.
- No branch refs were deleted; no force push was used.
