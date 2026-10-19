# WorkPass42 — финальная очистка, канонические пути и восстановление исходников

**Дата:** 2026-10-14  
**База:** Neuro_Kurisu_WORKPASS41_2026-10-14.zip  
**Runtime:** Neuro-Kurisu 35.63.0 / schema 225  
**Прогресс прохода:** 94/100  
**Взвешенная готовность проекта:** 78.0% — не означает релизное одобрение.

## Итог

WorkPass42 сосредоточен на наведении порядка и доказуемой оптимизации. Файлы удалялись не по названию, возрасту или расширению: для каждого класса проверено, что содержимое совпадает с сохранённым источником по размеру и SHA-256, а исходный путь можно восстановить или сгенерировать детерминированно. Неизвестные и семантически значимые файлы оставлены.

## Что удалено или перемещено

1. **21 Live2D-shadow файл** в `app/public/live2d` — 16,690,663 исходных байта. Канонический владелец находится в `runtime/neuro-kurisu/public/live2d`. `app/scripts/with-app-env.mjs` гидратирует эти пути перед Vite dev/build из hash-locked manifest. `npm run assets:clean` удаляет только точные копии, оставляя `viewer.html` и `vendor/`; изменённая копия не удаляется.
2. **Два ZIP-алиаса Lumina/Letta** — 3,265,456 байт. Канонические архивы в `legacy/input-archives/raw-source-archives/` сохранены; удалённые пути входят в обратимый path manifest.
3. **27 идентичных файлов между `legacy/kurisu-v9` и `legacy/kurisu-v56`** — 224,067 байт. Каждый имел одинаковый относительный путь, одинаковый размер и одинаковый SHA-256. Сохранены копии v56; пропущенные пути v9 восстанавливаются командой `npm run restore:historical-paths`.
4. **27 идентичных исторических отчётов** — 39,582 байта. Канонические copies остаются в актуальных/верхних документах, а прежние history-пути индексированы для восстановления.
5. **68 корневых исторических отчётов** перенесены в `docs/history/workpasses/root-reports/` без изменения байтов. Движение отражено в `RELOCATION_MANIFEST_WORKPASS42.json`; старые имена и SHA-256 не потеряны.

Суммарно эти новые path-level сокращения убирают примерно **20.22 MB исходного дублированного содержимого** до учёта ZIP-сжатия. 3,873 более ранних Legacy-пути продолжает покрывать `legacy-content-dedup-manifest.json`; этот механизм проверен отдельно и не пересоздаётся поверх WorkPass42.

## Что восстановлено до точной побайтовой обратимости

- Исторические ZIP-манифесты ссылались на 7 изменившихся активных файлов вместо исходных старых байтов. Эти оригинальные preimage восстановлены из неизменённого WorkPass34 в SHA-256-блоки, а 81 `canonicalPath`-ссылка перенаправлена на совпадающие канонические байты.
- В историческом снимке 2026-10-06 десять записей ссылались на эволюционировавшие активные файлы. Их прежние байты восстановлены из WorkPass34 в восьми immutable blobs.
- `python3 tools/verify-compacted-source-archives.py`: **8,512/8,512** исходных элементов, ошибок 0.
- `python3 tools/restore-historical-snapshot.py --check`: **10,427/10,427** записей, ошибок 0.
- `node tools/restore-legacy-deduplicated-files.mjs`: 3,873 manifest entries, missing/changed canonical sources 0, conflicts 0.
- `node tools/restore-historical-duplicate-paths.mjs`: 56 точных omitted-path источников проверяются без записи; `--restore` безопасно материализует их.

## Порядок в дереве

- `runtime/neuro-kurisu/` — единственный writable runtime и canonical Live2D assets.
- `app/` — UI и delivery shell; сгенерированные Live2D shadows исключены из компактной поставки, а UI-specific viewer/vendor остаются.
- `legacy/` — исходные версии и сторонние исходники; повторные физические копии сведены в manifest, а не выброшены без следа.
- `contracts/` — контракты и hash-lock inventory.
- `docs/` — активная документация; `docs/history/` — архив истории; `docs/archive-optimization/` — манифесты/блоки и инструкции восстановления.
- `tools/` — контроль, materialize/restore и release gates.
- `research/` — экспериментальные ветки, не являющиеся альтернативным writable runtime.

Навигация: `docs/PROJECT_FILE_MAP_WORKPASS42.md`; интеграционная карта: `docs/INTEGRATION_MATRIX_WORKPASS42_2026-10-14.md`; текущий список дел: `docs/WORKPASS42_TASKS_2026-10-14.md`.

## Почему некоторые совпадающие файлы оставлены

Не все одинаковые байты означают ненужный файл. Отдельные `LICENSE/NOTICE` нужно держать у независимо лицензируемых вложенных проектов; bootstrap SQL и versioned migration SQL являются разными entrypoints; пустые `__init__.py` — маркеры отдельных Python-пакетов; fixture-файлы и evidence с различающимися именами сохраняют смысл для разных тестов/версий. Полный построчный аудит всех оставшихся 9 тысяч файлов за один проход не может честно считаться завершённым только по hash-анализу. Поэтому спорные семантические дубли сохранены, а не удалены наугад.

## Проверки и ограничения

- Канонические asset sync/clean: 6/6 focused tests (после включения clean-mode).
- Восстановление duplicate-path: 4/4 targeted tests.
- Runtime/app tests из предыдущих проходов сохранены; повторяются основные доступные gates WorkPass42 перед упаковкой.
- Retrieval benchmark по-прежнему не показывает прирост полноты; кандидат не продвинут.
- **Production Vite build не заявляется как PASS:** `node_modules` отсутствуют, `vite` не найден; locked npm install не удалось выполнить из-за недоступности npm registry. Browser/Live2D E2E, real provider receipts, clean-room rollback, manual license review и soak остаются открытыми.

WorkPass42 — финальная сборка очистки текущего чата, не утверждение, что проект полностью release-ready или что сознание может быть подтверждено инженерными тестами.


## Final reconciliation after cleanup

- `ReleaseContract.ts` had drifted to runtime 35.62.0 while `package.json`, lockfile, `VERSION.json` and `RELEASE_MANIFEST.json` declared 35.63.0. The code contract and its test now check version **and phase** against the canonical runtime manifests. Runtime release-contract and integrity audits pass at **35.63.0 / schema 225**.
- Five identical immutable preimages had two physical copies in `historical-snapshot-blobs/` and `source-archive-blobs/`. Snapshot references now share the source archive blob after byte-for-byte SHA-256 equality, saving a further **31,893 raw bytes** without changing any historical member data.
- Final exact-duplicate scan: **18 groups / 39 extra paths / 91,244 raw bytes** remain intentionally because these are distinct path roles (per-package license/source notices, bootstrap vs migration SQL, named fixtures, package markers and version-labelled evidence). No remaining group was removed by hash alone.
- Final focused results: asset hydration/clean **6/6**; generic restore **4/4**; release metadata **34/34**; release metadata contract **6/6**; SBOM/provenance **1/1**; app scripts **218/218**; browser-smoke contract **51/51**; architecture audit **1,878 source / 581 canonical / 0 missing / 0 cycles / 0 legacy leakage**; hygiene **3,998 files / 0 errors / 0 warnings**; syntax **1,318 JS / 6 shell / 247 JSON**; runtime typecheck **PASS**; source archives **8,512/8,512**; historical snapshot **10,427/10,427**; legacy dedup map **3,873 entries / 0 missing sources / 0 conflicts**.
- Production Vite remains unbuilt in this environment because app dependencies are absent and npm registry access failed earlier. Do not read archive checks as a production-release signoff.
