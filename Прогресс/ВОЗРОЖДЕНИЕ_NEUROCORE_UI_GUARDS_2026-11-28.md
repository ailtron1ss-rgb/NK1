# Возрождение NK1 — UI / runtime guardrails

Дата: 2026-11-28
База: workpass70-source
Статус: selective-port branch обновлена; слияние заблокировано до повторного exact-head полного browser smoke после исправления health proxy.

## Источники
- Canonical parent SHA: e8a9ee5aea4c9d7308fac09e72aae63793a02c3d
- Canonical parent tree: 6910b255167543801221af96a091e8dd21339de6
- Donor PR: #1221, branch neurocore-unified/main
- Donor HEAD: 6d7f3e71a8f0741b4e8b6a0c7e2db175d20177b4
- Donor PR: 43 изменённых файла, 183 коммита; exact-head имел сбои NeuroCore focused integration, clean prototype startup и full-app browser smoke. Не объединялся целиком.
- Между donor merge-base и текущей canonical было 58 коммитов; из 43 файлов PR семь путей совпадали с изменёнными путями canonical. Они исключены из слепого переноса.

## Извлечено и перенесено
| Source | SHA / объём | Destination | Treatment |
|---|---|---|---|
| app/src/organism/uiSnapshotCommitGate.ts | bc726f13a600a891d885968f8649c3f5ce04c9b3, 27 lines | same | copied full; monotonic latest-request commit guard |
| app/scripts/ui-snapshot-commit-gate.test.mjs | e573c9231efdf0800062723b0d7284b7e17fab4d, 59 lines + regression | same | copied; adds test for stale send finalization |
| app/src/organism/store.ts | 1f4c9d531adb0c44ee03b998a2a0e61f1667bcef, 205 lines | same | hydrate/refresh/idle/send share commit gate; final chat append merges into current get().snap to avoid stale overwrite |
| app/src/components/avatar/avatarBodyStepScheduler.ts | f56174d63e32c3b68c101731cff58af9c744000d, 12 lines | same | copied full; 50 ms / 20 Hz fixed step, monotonic finite timestamp check |
| app/scripts/avatar-body-step-scheduler.test.mjs | 04459ae3c457cdafe0a545bd015c67af96621b89, 49 lines | same | copied full; 20 Hz contract and real AvatarStage wiring |
| app/src/components/AvatarStage.tsx | canonical source SHA f4a52e4e725f2ec86d97b467f620085140da61b0, 722 lines | same | two targeted edits only: import scheduler + replace 33 ms gate; default Live2D renderer preserved |
| app/src/components/RuntimeHealthPanel.tsx | 8ab3b6c0128746645b9c5e43d7cf75fd2f7be05c, 136 lines | same | copied full; request timeout 5 s, no overlapping requests, visible-page polling every 15 s |
| app/vite.config.ts | canonical SHA 9c9d39ab43ffd3cc9aab3feebd53ba81e1e8bee5, 188 lines | same | adds missing "/api/health" proxy to runtime 127.0.0.1:3310; all existing proxies preserved |
| app/src/routes/index.tsx | b43de0f7dc698893e3840714e929d47e91315a19, 89 lines | same | panel mounted in header; NeuroCore branding adopted |
| app/package.json | canonical source SHA b4175ca7a0dd0d6dbba843da0eed57a7ab89fca9, 134 lines | same | enable Node type stripping for script tests + add focused test command; name, dependencies and lockfile unchanged |
| New app/scripts/runtime-health-panel.test.mjs | authored, now expanded | same | UI/server contract, bounded polling, Kurisu heading and Vite-to-runtime proxy checks |
| New .github/workflows/revival-ui-embodiment-regression.yml | authored | same | Node 24 exact-head focused regression |

## Excluded / deferred
- app/src/components/Avatar3DStage.tsx: donor rewrite removes pinned online Kurisu v5 loader and changes model fallback/default behavior. Not copied; protect current identity and asset path already enhanced by PR #1220.
- app/src/components/avatar/proceduralHumanoidRig.ts: 873 lines. Structural and key IK/joint-limit/rig-construction sections inspected, but full 873-line analysis is not complete; not copied or marked complete. Needs complete code coverage, integrated test and visual/Android performance gate.
- runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts: 3,584 lines and runtime/neuro-kurisu/src/organism/system/ContinuityLedger.ts: 418 lines. Both were changed in the donor and canonical after their merge-base; whole-file replacement is prohibited.
- Three donor continuity durability tests tied to those stale runtime implementations are excluded.
- Donor app package-name change, root package metadata churn, and lockfile changes excluded. No dependency versions changed.

## Verification
- Added tests: avatar-body-step-scheduler, ui-snapshot-commit-gate, runtime-health-panel (cross-checks the existing server /api/health JSON fields).
- App test script now uses Node type stripping for script tests; the new workflow runs the focused group under Node 24.
- Exact-head run 46142526144 (Revival UI and Embodiment Guardrails) passed. Integrated software baseline 46142526094 and NeuroCore core regression 46142526099 passed on the previous PR revision.
- Full UI smoke artifact from run 46142526106 showed every navigation/layout check passing, but 7 HTTP 406 responses were all for GET /api/health. Cause: Vite dev proxy had only /api/organism and /api/research; /api/health was served by Vite itself. Fixed by adding /api/health → 127.0.0.1:3310 and adding a regression assertion; this exact fix awaits the next exact-head full UI smoke.
- Do not claim full app browser smoke, native Android/Termux soak, or release until their separate gates pass.

## Coverage accounting
- Full donor-source reads: UI gate 27/27; UI gate test 59/59; scheduler 12/12; scheduler test 49/49; health panel 136/136; route 89/89; store 205/205.
- Canonical AvatarStage 722/722 lines read and changed only at the import and physics-step predicate.
- Canonical app/package.json 134/134 lines inspected; only scripts changed.
- Procedural rig donor source app/src/components/avatar/proceduralHumanoidRig.ts (SHA 658559348638ed04461d464a6611e62878bf81d5): fully read 873/873 lines. Donor test app/scripts/procedural-humanoid-rig.test.mjs (SHA 10e38223eb264694de82f8aafb878e84c144108d): fully read 391/391 lines, 13 tests. Coverage: >=45 THREE.Bone joints; >=90 anatomical parts; 15–30 SkinnedMesh batches with skinIndex/skinWeight; 18 mapped body landmarks; 17 applied particle bindings; mirrored arm IK; leg IK; finger curl; joint limits; reset/disposal.
- Rig is reviewed but NOT integrated. Current Avatar3DStage deliberately keeps the procedural placeholder hidden and loads the pinned Kurisu v5 GLB; blindly replacing it would remove the current validated asset path, secondary vertex physics, VRM audit, adaptive dynamics, and model reset lifecycle. The safe integration is a selectable offline/failed-load fallback, not default replacement.
- Follow-up defects to close before runtime adoption: resetPose resets bones but not all facial transient values (eyes/iris/lids/brows/mouth); dispose should be checked for Skeleton boneTexture cleanup; solveTwoBonePlanarIK needs explicit non-finite input contracts; solveArmTarget deltaSeconds is currently unused. Android frame budget / thermal behavior remains unverified.


## Subsequent exact-head investigation (2026-11-28)
- Browser artifact: run 46142526106, artifact 15262582091, SHA-256 8437a0926fcb0b6f0ba6a6c2ab7203ec9240950eac766eaeeee6b38abf08ae76.
- Artifact confirms all desktop/mobile navigation, avatar selectors, Live2D ready/recovery, chat form controls, MindHud and no-page-overflow checks pass. The only failing assertion is network errors for /api/health (4 desktop, 3 mobile; no page exceptions, no failed requests).
- Root cause traced to app/vite.config.ts missing `/api/health` under `server.proxy`; runtime server already supports both `/health` and `/api/health` and returns the exact status fields consumed by the panel.
- Fix applied in this branch: add `"/api/health": { target: "http://127.0.0.1:3310", changeOrigin: true }`; regression test now asserts the proxy contract. Exact-head rerun pending.
