# NK1 — отдельный CI-контур для GLB/VRM preflight

Дата: 2026-11-01  
Ветка: `workpass70-source`

## Цель

Сделать проверку границы загрузки 3D-моделей независимой от установки всего app dependency tree. Это важно, потому что ранее app build блокировался недоступностью npm registry; parser regression suite использует Node.js и локальные TypeScript-модули и не нуждается в установке React/Three.js/Vite.

## Что добавлено

1. Новый workflow `.github/workflows/avatar-model-preflight.yml`.
2. Триггеры: push в `workpass70-source` при изменении preflight-кода/теста/workflow, pull request в `workpass70-source` с теми же path-фильтрами и ручной `workflow_dispatch`.
3. Выполнение на Node.js 22.16.0 командой:
   `node --experimental-strip-types --test app/scripts/avatar-model-preflight.test.mjs`.
4. У workflow только `contents: read`; checkout не сохраняет credentials; конкурентные устаревшие запуски отменяются; timeout — 5 минут.
5. CHANGELOG обновлён отдельным коммитом.

## Почему это полезно

- GLB/VRM upload boundary получает самостоятельную регрессионную защиту.
- Проверки не зависят от сотен app dependencies и сетевой доступности npm registry.
- Ошибки в ограничениях размера, GLB chunks, embedded buffer layout и VRM extension identity могут быть обнаружены до renderer handoff.
- Узкий workflow быстрее и дешевле полного app build и не подменяет его.

## Проверяемые границы

Этот workflow запускает только parser contract suite. Он не подтверждает production Vite build, браузерную загрузку/рендеринг, GPU resource soak, Android/Termux playback, корректность конкретной Kurisu-модели или лицензии.

## Коммиты

- Workflow: `039a50cfb09515dd7047b0cf64baa84571509b1a`
- CHANGELOG: `4247a315e1a94bca39cee15c49f27807d9fc086f`

## Статус проверки

- Файл workflow и запись CHANGELOG записаны через GitHub API.
- Локальный запуск теста в текущей среде не выполнен: исходная проблема доступа к raw GitHub/npm registry не устранена.
- Успешный GitHub Actions run на точном SHA ещё не подтверждён; PASS не заявляется.
- Основной weighted roadmap score остаётся 80.1%: этот шаг улучшает непрерывность проверок, но не закрывает независимый RU/EN retrieval uplift, browser/device E2E, clean-room restore, license review или soak.
- Stable Release ZIP и prerelease Release ZIP не изменялись.

## Следующий шаг

Получить exact-head Actions evidence для нового workflow, затем продолжить P0 по bilingual memory retrieval: независимый immutable holdout, пять paired seeds, source-clustered metrics и promotion только при доказанном `recallDelta > 0`.
