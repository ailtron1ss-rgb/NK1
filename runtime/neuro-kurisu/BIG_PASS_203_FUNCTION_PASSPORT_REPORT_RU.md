# BIG PASS 203 — Function Passport / Semantic Verification Closure

## Цель

Закрепить правило: **функция не считается полностью внедрённой, пока её точный behavioural contract не закрыт требуемыми доказательствами**.

## Что добавлено

- `src/organism/verification/FunctionPassport.ts` — строгая модель паспорта функции, behavioural contract, proof plan, verdict и confidence.
- `scripts/build-function-passports.mjs` — AST-инвентаризация и построение паспорта для каждой функции.
- `scripts/verify-function-passport-gate.mjs` — integrity gate: запрещает VERIFIED при отсутствии обязательного evidence tier.
- `tests/big-pass-203-function-passport.mjs` — unit/invariant проверки самого proof engine.
- `FUNCTION_PASSPORTS_203.json` — полный machine-readable реестр.
- `FUNCTION_PASSPORTS_PRIORITY_203.json` — приоритетный backlog безопасных кандидатов.
- `FUNCTION_PASSPORTS_203_RU.md` — человекочитаемый отчёт.
- `package.json` — команды `test:big-pass-203`, `audit:function-passports`, `audit:function-passport-gate`.

## Реальный результат

| Показатель | Значение |
|---|---:|
| AST-функций в паспорте | 2675 |
| VERIFIED | 15 |
| INTEGRATION_ONLY | 27 |
| UNSAFE_TO_AUTO_RUN | 129 |
| UNVERIFIED | 2504 |
| Strict VERIFIED rate | 0.56% |
| Parameterized safe probes | 568 |
| Parameterized probe passed | 553 |
| Parameterized probe failed | 0 |
| Input synthesis needed | 3 |
| Lifecycle needed | 12 |
| Typecheck | PASS |
| Passport gate | PASS |
| BIG PASS 193 core | PASS |
| BIG PASS 200 standalone | PASS |
| BIG PASS 200 Core | PASS — но phase=fragmented |
| BIG PASS 201 | PASS |
| BIG PASS 202 | PASS |
| Architecture audit | PASS |
| Source hygiene | PASS |

## Важное различие

Старый semantic audit остаётся полезным историческим/совместимым слоем и показывает 38 VERIFIED. Новый passport намеренно строже: он требует proof plan, привязанный к конкретному контракту функции. Поэтому его VERIFIED count ниже — это **не регрессия runtime**, а повышение стандарта доказательства.

## Главная новая проблема, которую обнаружил проход

Крупнейший активный долг проекта — не синтаксис и не импорты, а **semantic under-coverage**. У огромного числа функций есть реализация, тестовые упоминания или интеграционный маршрут, но нет полного proof package.

Наибольший практический ROI сейчас дадут безопасные observational/state-transition функции в cognition, memory, world, self и learning.

## Крупный интеграционный сигнал

`BIG_PASS_200` standalone остаётся coherent (`coherence=0.7599`, `coupling=0.69`, `stability=0.7803`), тогда как Core-проход всё ещё показывает `phase=fragmented`, `coherence=0.6638`, `coupling=0.2868`. Это подтверждает основной архитектурный приоритет: закрыть integration spine до добавления новых cognitive modules.

`BIG_PASS_193` core сохранил преимущество модели над baseline (`MAE 0.1928 vs 0.3048`), но текущий core result всё ещё помечен `validated=false`. Это означает, что качество полезного поведения уже заметно, но proof policy проекта ещё не считает этот результат полностью валидированным.

## Следующий большой проход

1. Выбирать один bounded cognitive domain.
2. Для каждой его безопасной функции поднимать контракт из heuristics в явный contract record.
3. Генерировать exact-function probes.
4. Проверять postconditions и state deltas, а не только отсутствие exception.
5. Для stateful функций добавлять restart/readback proof.
6. Для replayable функций добавлять deterministic replay proof.
7. Для self/consciousness добавлять adversarial/lesion proof.
8. После каждого закрытого пакета повторять весь passport gate и regression suite.

**Критерий завершения домена:** у него нет UNVERIFIED безопасных функций высокого criticality без явной причины; каждая remaining функция либо VERIFIED, либо имеет зарегистрированный blocker, который невозможно снять автоматически и которому назначен конкретный proof path.
