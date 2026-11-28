# Возрождение NK1 — UI / runtime guardrails
Дата: 2026-11-28
База PR: workpass70-source@e8a9ee5aea4c9d7308fac09e72aae63793a02c3d
Статус: selective port остаётся Draft; exact-head workflow проверяет последнюю правку status-lite.

## Источники и решение по донору
- Донор: PR #1221, branch neurocore-unified/main, HEAD 6d7f3e71a8f0741b4e8b6a0c7e2db175d20177b4.
- Донорский PR: 43 файла, 183 коммита; на exact donor HEAD падали NeuroCore integration, clean startup и UI browser smoke.
- Между merge-base донора и canonical накопилось 58 коммитов; 7 путей PR пересекались с более новыми canonical изменениями. Поэтому whole-branch merge отклонён.
- PR #1238 — отдельный selective port: revival/neurocore-ui-runtime-guards-20261128. На HEAD 9b60e66806d342c3765b0791172014770d1da39f было 13 файлов +500/-21; после выбора существующего status-lite endpoint изменения панели/теста обновлены, временный Vite proxy для /api/health убран. PR files и exact HEAD нужно читать заново после последнего commit.

## Файлы, источники и адаптация
| Destination | Source / SHA | Review / handling |
|---|---|---|
| app/src/organism/uiSnapshotCommitGate.ts | donor bc726f13a600a891d885968f8649c3f5ce04c9b3 | 27/27 строк; monotonic latest-request commit gate |
| app/src/organism/store.ts | donor 1f4c9d531adb0c44ee03b998a2a0e61f1667bcef | полный 205-строчный донорский файл; исправлен send-finalization race: последний chat turn добавляется к актуальному get().snap, а не к устаревшему snapshot |
| app/scripts/ui-snapshot-commit-gate.test.mjs | donor e573c9231efdf0800062723b0d7284b7e17fab4d | 59 строк + дополнительная проверка stale finalization |
| app/src/components/avatar/avatarBodyStepScheduler.ts | donor f56174d63e32c3b68c101731cff58af9c744000d | 12/12 строк; bounded monotonic fixed 50 ms / 20 Hz scheduler |
| app/scripts/avatar-body-step-scheduler.test.mjs | donor 04459ae3c457cdafe0a545bd015c67af96621b89 | 49/49 строк; подтверждает реальную wiring в AvatarStage |
| app/src/components/AvatarStage.tsx | canonical f4a52e4e725f2ec86d97b467f620085140da61b0 | прочитано 723 строки текущей версии; только импорт scheduler и замена delta threshold; Live2D остаётся default |
| app/src/components/RuntimeHealthPanel.tsx | donor health panel 8ab3b6c0128746645b9c5e43d7cf75fd2f7be05c, adapted | первоначальный endpoint /api/health заменён на существующий /api/organism/status-lite; UI показывает только реально возвращаемые поля |
| app/src/routes/index.tsx | donor route b43de0f7dc698893e3840714e929d47e91315a19 + canonical UI contract | панель смонтирована; h1 Kurisu, подпись NeuroCore · digital organism сохранена |
| app/package.json | canonical b4175ca7a0dd0d6dbba843da0eed57a7ab89fca9 | scripts-only: Node type stripping для .ts тестов, focused regression script; dependencies и lockfile неизменны |
| app/scripts/runtime-health-panel.test.mjs | authored | cross-check component → backend status-lite route → existing Vite /api/organism proxy; bounded polling and Kurisu heading |
| .github/workflows/revival-ui-embodiment-regression.yml | authored | Node 24 exact-head focused regression |
| Прогресс/ВОЗРОЖДЕНИЕ_NEUROCORE_UI_GUARDS_2026-11-28.md | authored | source provenance, file coverage and exclusion log |

В PR на предыдущей ревизии добавлялась временная Vite proxy запись для /api/health, затем удалена. Не оставлять этот эксперимент как production fix. В текущем дизайне панель вызывает /api/organism/status-lite, а Vite использует уже существующий и применяемый UI organism API путь /api/organism.

## Что показала браузерная проверка
- Run 46142526106, artifact 15262582091, SHA-256 8437a0926fcb0b6f0ba6a6c2ab7203ec9240950eac766eaeeee6b38abf08ae76: навигация, desktop/mobile layout, avatar selectors, Live2D recovery, чат-контролы и проверки страницы прошли; UI smoke падал только на HTTP 406 из нового /api/health вызова.
- Run 46142990425, artifact 15262132185, SHA-256 fd6db5b96ad577753ccff9f3eeab60f104f0fafcd548a3f16249e58218f752a9: после временной Vite proxy записи /api/health продолжил отвечать 406. Это опровергло гипотезу, что достаточно добавить только Vite proxy.
- Контракт сервера проверен: /api/organism/status-lite возвращает ok, version, organismCore, schemaVersion, tick, lastAction, memoryCount, autonomyScore, predictionError; Vite уже проксирует весь /api/organism на runtime порт 3310. Поэтому панель переведена на status-lite, а ненужный /api/health proxy удалён. Последний exact-head UI smoke должен подтвердить исправление.

## Исключено из интеграции
- app/src/components/Avatar3DStage.tsx: донорская версия замещает действующий pinned Kurisu v5 GLB loader и меняет fallback/model lifecycle; целиком не переносить.
- runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts (3,584 lines) и runtime/neuro-kurisu/src/organism/system/ContinuityLedger.ts (418 lines): одинаковые пути изменены после merge-base на canonical, полный donor overwrite недопустим.
- Donor package name, root metadata churn, lockfile и три теста, зависящие от старой ContinuityLedger, исключены.

## Полный анализ procedural humanoid rig
- app/src/components/avatar/proceduralHumanoidRig.ts, SHA 658559348638ed04461d464a6611e62878bf81d5: 873/873 строк прочитано.
- app/scripts/procedural-humanoid-rig.test.mjs, SHA 10e38223eb264694de82f8aafb878e84c144108d: 391/391 строк прочитано; 13 тестов.
- Проверки: skeleton 45+ joints; anatomical part mesh batching; skin indices/weights; 18 body landmarks; 17 particle bindings; mirrored arm IK, leg IK, finger curl, joint limits, reset/dispose.
- Не интегрирован: current Avatar3DStage сохраняет pinned Kurisu v5 GLB, asset/VRM audit, secondary vertex physics, adaptive dynamics и model lifecycle. Целевой способ интеграции — отдельный explicit offline/failure fallback на общей articulated body particle state.
- Перед подключением закрыть facial reset completeness; Skeleton boneTexture disposal; non-finite IK contracts; неиспользуемый deltaSeconds в solveArmTarget; Android CPU/GPU/thermal soak.

## Проверки / текущие ограничения
- На предыдущем PR head 9b60e668...: Revival focused workflow SUCCESS; integrated software baseline SUCCESS; normalized VRM motor SUCCESS; avatar cognitive-affect coupling SUCCESS; Live2D browser acceptance SUCCESS; body particle physics SUCCESS; OperationalJournal regression SUCCESS; Super Install regression SUCCESS; 2.5D depth rig SUCCESS; module dependency audit SUCCESS.
- Полный UI smoke на этом head после изменения status-lite — требуется новый exact-head run.
- Один workflow OmeStro 20 завершился failure по constitution-ratification-denied / ActionGateway не создал ticket; код PR #1238 не меняет constitution/ActionGateway. Не засчитывать как success; отслеживать отдельно.
- Android/Termux физическое устройство, thermal soak, человеческая визуальная приёмка и release не выполнялись. Никакие из них не считаются завершёнными.
