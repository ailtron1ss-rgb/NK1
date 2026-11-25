# NK1 — P23 signed Skill Shadow evidence freshness

Дата фиксации: 25 ноября 2026 года  
Canonical source: `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964`  
Aspect PR: [#1177](https://github.com/ailtron1ss-rgb/NK1/pull/1177)  
Branch: `aspect/skill-shadow-evidence-freshness-20261125`  
Latest inspected head: `27c74e0502264f4a10959ad9f7cd49acfcd221c5`

## 1. Что защищает этот контур

P23 принимает подписанные результаты shadow-запусков навыка и использует их в жизненном цикле candidate → shadow → promotion → persisted-active. Криптографическая подпись подтверждает владение доверенным ключом, но сама по себе не доказывает независимость проверяющего или качество навыка.

Поэтому принятие receipt дополнительно связывается с доверенным контекстом исполнения, разрешённым из внешнего run registry/supervisor: `runId`, `taskId`, `seed`, `manifestFingerprint`, `runtimeVersion`. Поля подписанного receipt не считаются независимым источником этих значений.

## 2. Свежесть по назначению

В verifier введены три явных назначения:

| Purpose | Правило возраста |
|---|---|
| `record` | evidence обязан укладываться в окно свежести |
| `promotion` | свежесть проверяется повторно в момент promotion |
| `persisted-active` | возраст исторического receipt сам по себе не запрещает восстановление уже активированного навыка |

Для всех трёх назначений остаются обязательными Ed25519 signature, точная идентичность candidate/version/payload, независимый trusted-run context и верхняя граница будущего времени.

Политика по умолчанию: 30 дней максимального возраста и 5 минут допуска расхождения часов в будущее. Настройки ограничены: max age — положительное значение не более года; future skew — от 0 до 24 часов. CLI создания approval request использует единый переданный clock value для детерминированности проверки.

## 3. Дополнительная fail-closed защита времени

При review кода выявлены два класса некорректного времени:

1. Конечное, но небезопасное целое или дробное значение verifier clock проходило проверку `Number.isFinite`. Для `persisted-active`, где обычное старение намеренно исключено, это могло обходить проверку допустимого значения часов.
2. Подписанное поле `observedAt` проверялось на конечность и положительность, но дробная временная метка не отбрасывалась, хотя протокол использует UTC epoch milliseconds.

В текущем коде:
- clock должен быть положительным `Number.isSafeInteger`;
- `observedAt` тоже должен быть положительным `Number.isSafeInteger`;
- некорректное значение отклоняется для каждого lifecycle purpose;
- age exemption для `persisted-active` не отменяет проверку подписи, контекста, валидности часов или правдоподобия будущей временной метки.

## 4. Регрессии

Файл: `runtime/neuro-kurisu/tests/p23-skill-shadow-evidence-freshness.mjs`.

Проверяются реальными Ed25519 fixture-ключами и детерминированным временем:
- свежий receipt с точным candidate и trusted context;
- устаревший receipt на этапе record и promotion;
- исторический receipt для persisted-active;
- timestamp из недопустимого будущего;
- неверные границы freshness policy;
- unsafe/fractional verifier clock;
- fractional `observedAt`.

**Подтверждённая TDD-красная стадия:** точный тестовый HEAD `fc4247d26ae2e8e41377fdd256a86ae9e96a3b47` завершился ожидаемым AssertionError: `Number.MAX_SAFE_INTEGER + 1` принимался как verifier clock в `persisted-active`. Workflow: [45606567069](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45606567069).

Production-исправление clock validation внесено в `b43d5b64068e2a8b14888cf41c3e5026022d3cfe`. Затем добавлена проверка дробного `observedAt` и соответствующее production-ограничение в `27c74e0502264f4a10959ad9f7cd49acfcd221c5`.

## 5. Синхронизация ветки и точное текущее состояние

Существующая aspect-ветка синхронизирована с canonical source без force-push:
- merge commit: `b77d904911a0cb97355e48cfc35a23c0819e19b2`;
- первый родитель — прежний PR head `aa2f64aec4f14f0f9e27e852f201eccda59b63f6`;
- второй родитель — canonical source `9008a8982a5173304456bee2c604bd0bc8665964`.

После синхронизации текущий compare source → PR head: **15 commits ahead / 0 behind**, шесть намеренно изменённых файлов:
- один focused GitHub Actions workflow;
- `package.json` с сохранением новых SelfAuthorship scripts из current source;
- promotion approval-request CLI;
- signed shadow evidence verifier;
- versioned candidate store;
- freshness regression tests.

Dedicated exact-head workflow для `27c74e0...` завершился **SUCCESS**: [45607764358](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45607764358), merge head `e4e154aa4985f2ac9f2fe5103938570fb1e6adb5`. Прошли все шаги focused freshness regression, signed evidence, candidate-store lifecycle и approval-request/default-deny test. Runtime type validation завершилась в режиме `node-strip-syntax-only` для 746 файлов; semantic `tsc` не запускался, так как компилятор не установлен. Исторические 63/63 checks относились к прежнему HEAD и старой базе; они не считаются доказательством текущего состояния.

## 6. Статус и ограничения

- PR #1177 остаётся **Draft / open / unmerged**.
- Изменения не интегрированы в `workpass70-source`.
- `main`, Release tag и Release ZIP не изменялись.
- Не заявляется улучшение качества обученного навыка, recall uplift, независимая результативность или доказанная автономность. Эта работа укрепляет только целостность evidence и временные границы его жизненного цикла.
- Независимый code review, production key provisioning/authenticated approval authority audit и host/device soak остаются отдельными воротами.
