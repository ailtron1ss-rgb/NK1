# Neuro-Kurisu Clean Rebuild — отчёт

Дата: 2026-08-25

## Почему сделана пересборка
Предыдущая версия накопила слишком много legacy coordinator/core/brain слоёв, повторных test suites, исторических version markers и зависимостей. Это повышало вероятность скрытых несоответствий.

## Новая модель
Canonical runtime отделён от полного исторического снимка. `src/organism/` — единственный cognitive runtime. `legacy-original/` сохранён как provenance и не импортируется.

## Главные изменения
1. Убраны npm runtime/build dependencies: сервер использует Node stdlib; browser UI — vanilla HTML/CSS/JS; LLM подключается через `fetch`.
2. `package-lock.json` теперь настоящий `lockfileVersion: 3` с пустым external dependency tree. Он был создан npm офлайн; подделки registry не использовались.
3. Canonical organism переразложен по доменам: `core`, `world`, `cognition`, `memory`, `body`, `language`, `persistence`.
4. UI и server больше не требуют React/Vite/Express.
5. Только `OrganismRuntime` меняет организм; используется single-writer queue.
6. Persistence остаётся atomic + backup + schema migration.
7. LLM является downstream language organ и не является источником decision.
8. Termux scripts вычисляют root относительно собственного расположения и не содержат build-container paths.
9. Добавлены clean smoke, autonomy, restart, integrity и architecture gates.

## Lockfile
Проверено: `npm install --package-lock-only --offline`, затем `npm ci --offline --ignore-scripts`.
Так как project dependency tree пуст, `npm ci` не требует registry/cache и не создаёт `node_modules`.

Официальная документация npm требует существующий `package-lock.json` для `npm ci` и отмечает, что lockfile фиксирует точное dependency tree. Поэтому настоящий lockfile достигается не маскировкой registry, а уменьшением dependency surface до нуля. См. npm docs: https://docs.npmjs.com/cli/commands/npm-ci/ и https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/.

## Что сохранено
Старый проект не удалён. Полный snapshot предыдущего P3 release находится в `legacy-original/`. Это позволяет сравнивать поведение и переносить только проверенные компоненты.

## Ограничения
Нет device-side Android soak внутри контейнера. Это не угроза целостности canonical code, но это обязательная проверка до длительной эксплуатации на реальном телефоне.

## Критерий будущих изменений
Новая функция сначала существует в canonical domain, получает self-test, integration test и deterministic replay при необходимости. После этого она попадает в runtime. Legacy modules не подключаются напрямую.
