# NK1 — отчёт синхронизации main → полный Release source

**Дата:** 22 октября 2026 г.  
**База полного дерева:** `workpass70-source` @ `e0d8e5b1a422c1e42db817cc37e5e1f97549c4d5`  
**Main до синхронизации:** `69f8186c8bc2cfcadc7c88fc89406358eedbe8c1`; отдельный publishing workflow добавлен в рамках этой операции.  
**Принцип:** сначала сохранить полное дерево исходников Release, затем добавить отсутствующее содержимое main; существующие файлы проекта не заменять историческими/репозиторными версиями без проверки эквивалентности.

## Результат сравнения

На исходном сравнении было 9 файлов main: 8 отсутствовали в полном дереве по пути, а `README.md` присутствовал, но имел другое содержимое (main: 3,199 байт; runtime/source: 50,374 байта). Во время этой операции в main добавлен новый workflow публикации, поэтому синхронизация переносит все 9 текущих main-only/changed файлов:
- `.github/workflows/publish-workpass70-hotfix.yml` — перенесён без изменения содержимого main.
- `.github/workflows/workpass70-inventory.yml` — перенесён без изменения содержимого main.
- `.github/workflows/workpass70-source-branch.yml` — перенесён без изменения содержимого main.
- `.github/workflows/publish-workpass70-main-sync.yml` — перенесён без изменения содержимого main.
- `NeuroCore_WORKPASS64_AUDIT_SUMMARY.json` — перенесён без изменения содержимого main.
- `NeuroCore_WORKPASS64_REPORT_RU.md` — перенесён без изменения содержимого main.
- `NeuroCore_WORKPASS64_SHA256SUMS.txt` — перенесён без изменения содержимого main.
- `WORKPASS65_PLAN.md` — перенесён без изменения содержимого main.
- `scripts/publish-workpass64.ps1` — перенесён без изменения содержимого main.
- `README.md` — полный текст main сохранён отдельно в `NK1_REPOSITORY_README.md`; runtime/source `README.md` не затёрт.
- `CHANGELOG.md` — добавлена запись аудируемой синхронизации.
- `WORKPASS70_MAIN_SYNC_2026-10-22_REPORT_RU.md` — добавлен этот отчёт.

## Публикация архива

Новый workflow `.github/workflows/publish-workpass70-main-sync.yml` в default branch ждёт успешного workflow `NeuroCore core regression validation` для `workpass70-source`, проверяет, что validated SHA всё ещё является вершиной ветки, и создаёт новый тег с коротким SHA. Старый релиз WorkPass70 Hotfix 1 не перезаписывается. ZIP проверяется на целостность и опасные пути; к Release прикладывается SHA-256 manifest.

## Границы достоверности

- Перенос файлов и commit в ветке исходников — это факт синхронизации, но не доказательство production readiness.
- Отчёт и manifest WorkPass64 сохранены как исторические файлы; их статусы/контрольные суммы относятся только к указанным в них артефактам.
- Выпуск нового ZIP зависит от прохождения core validation и выполнения публикационного workflow. До появления нового Release URL нельзя утверждать, что ZIP уже опубликован.
- Не закрыты автоматически production UI/browser/Live2D E2E, длительный endurance soak, независимый retrieval uplift и полный license review.


## Фактическая проверка после синхронизации

- Текущий синхронизированный source head после переноса файлов и защиты публикации: `65c67882b411299a7620e31a680d8e78e9386806`.
- SHA-сверка текущего `main` подтвердила: 9 из 10 файлов совпадают по исходному пути и blob SHA; содержимое `README.md` из `main` полностью совпадает с `NK1_REPOSITORY_README.md`. Все файлы из `main` сохранены; дерево не было усечено API.
- Validation run [39806308555](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39806308555) и повторная попытка завершились `failure` до шагов. Validation run [39807146096](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39807146096) для указанного source head тоже завершился `failure` до шагов: GitHub API сообщил `runner_id=0`, пустое имя runner и пустой список шагов. Поэтому это **не свидетельство провала конкретных тестов** и не основание заявлять, что тесты пройдены; причину недоступности runner API-ответ не раскрывает.
- Перечень GitHub Releases после проверки содержит только исходные `Neuro` и `workpass70-hotfix1-2026-10-19`; тег `workpass70-main-sync-2026-10-22-*` и новый синхронизированный ZIP отсутствуют. Старый ZIP с SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb` не перезаписывался.
- Итоговый статус: **содержимое main синхронизировано в source-дерево; публикация нового Release-asset не подтверждена и пока не выполнена**. Новый publisher намеренно требует успешной core-validation и создаёт отдельный prerelease вместо изменения исторического тега.

## CI/toolchain follow-up — 22 October 2026

- Migrated `actions/checkout` references to `v7`, `actions/setup-node` to `v7`, and `actions/upload-artifact` to `v7` in all five source-branch workflows; matching main-branch workflows were updated in parallel.
- The core validation workflow explicitly installs Node.js `24.22.0`. The migration follows GitHub's announced Node 20 removal (23 September 2026) and the current Node 24-compatible first-party action releases.
- The latest Actions failures still show zero runner assignment and no executed steps; they do not constitute passing test evidence or isolate a code-test failure. A clean successful run remains a release gate.

## Idempotent publication guards — 22 October 2026

- The existing WorkPass70 hotfix publisher previously failed intentionally when it encountered its already-published tag, which would turn a later successful validation into an avoidable publishing failure. It now sets `publish=false` and exits successfully when that tag exists.
- Both publishers use an authenticated REST tag lookup. HTTP 200 safely skips, HTTP 404 permits a new unique publication, and every other status fails closed. This prevents missing credentials/rate-limit/network errors from being interpreted as proof that a tag does not exist.
