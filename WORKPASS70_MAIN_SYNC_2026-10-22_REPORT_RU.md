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
