# WorkPass343 — fail-closed final release verification

**Дата:** 26 октября 2026 г.  
**Ветка:** `work/nk1-final-release-gate-2026-10-26-r1`  
**Статус:** code and regression committed; exact-head CI pending.

## Найденный дефект

Root-команда `npm run release:verify` запускала `tools/verify-final-release.mjs`, который проверял generated Python artifacts, известные secret paths, UI/API wiring и runtime architecture. При этом проверка согласованности release metadata была отдельной командой (`npm run audit:release-metadata`). Оператор мог получить `ok: true` от final verifier, даже если metadata validator отдельно падал из-за несовпадения версии, lockfile, current-status files или release metadata. Это была неполная финальная проверка, а не доказательство готовности к релизу.

## Реальное изменение

- `verify-final-release.mjs` запускает `verify-release-metadata.mjs --root <root>` как обязательную третью проверку наряду с UI wiring и architecture.
- Output JSON теперь содержит `checks` и summary pass/fail; код возврата равен 1 при ошибке любого mandatory gate.
- `--root` поддерживает изолированные fixtures; неизвестные CLI arguments отклоняются с кодом 2.
- Отсутствие metadata verifier или ошибочный exit status блокирует итоговый результат.
- Добавлен `tools/verify-final-release.test.mjs` с четырьмя сценариями: pass, metadata failure, missing metadata validator, unknown argument.
- Root test script `test:final-release-verifier` добавлен в `audit:workpass70`. Unified integration workflow запускает эту регрессию и сам `release:verify`, когда затронуты релизные контракты.

## Запуск после изменения

```bash
npm run install:all
npm run doctor
npm run test:final-release-verifier
npm run release:verify
npm run start
```

Главный gateway: `http://127.0.0.1:8080`; runtime: `127.0.0.1:3310`; Research Bridge: `127.0.0.1:8765`. Внешние research adapters требуют явного owner approval; запуск не должен автоматически включать сетевые действия.

## Ограничения

WorkPass343 закрывает только пропуск metadata gate. Он не заменяет clean-machine installation, physical Android/Termux audio/sensor tests, browser/Live2D hardware E2E, long soak, license/provenance review, и reproducible rebuild/replacement of the large GitHub Release ZIP.

Текущий проверенный combined code/test head до WorkPass343 — `621864d0d7f2676245383adab86f1dcc6d0f741f`. Его успешные CI run не являются доказательством для новой release-gate реализации; WorkPass343 остаётся pending, пока новый HEAD не пройдёт CI.
