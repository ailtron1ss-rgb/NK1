# WorkPass335 — защита подписей и verified skill revision gate

**Дата:** 26 октября 2026 г.  
**Ветка:** `work/nk1-workpass335-learning-gate-rebased-2026-10-26-r1`  
**Code/test checkpoint:** `8cd1a4b6495036c8200b5f2581e8c123584d1ea9`; **validated HEAD:** `2aa76acb545ac1a485962f4016c6586766424a0a`  
**Статус:** P23 regression suite, runtime typecheck и полный integration suite прошли на exact HEAD `2aa76acb545ac1a485962f4016c6586766424a0a`.

## Что изменено

Функция `decodeCanonicalEd25519Signature` принимает только строку стандартного Base64, которая кодирует ровно 64 байта и после round-trip декодирования и обратного кодирования совпадает с исходной строкой. Это исключает пробелы, посторонние символы, лишние суффиксы, обрезанные подписи и неоднозначные текстовые представления.

Один и тот же контракт применяется в обоих критических путях:
- `createAuthenticatedSkillPromotionApprovalVerifier` — проверка подписи перед активацией кандидата навыка;
- `createAuthenticatedSkillRollbackApprovalVerifier` — проверка подписи перед откатом активной версии.

Некорректная кодировка приводит к отказу до криптографической проверки. Отсутствие доверенного ключа остаётся отказом по умолчанию. Этот patch не добавляет автоматическую активацию, не ослабляет проверку evidence и не заменяет независимую оценку кандидата.

## Регрессионные сценарии

В `runtime/neuro-kurisu/tests/p23-versioned-skill-candidate-store.mjs` добавлены проверки:
- валидная каноническая promotion-подпись принимается;
- promotion-подпись с суффиксом `!!!`, ведущим пробелом или удалённым padding отвергается;
- валидная rollback-подпись принимается;
- rollback-подпись с суффиксом `!!!` отвергается.

## Закрытие holdout revision-gate контракта

В том же проходе усилен `SkillRevisionGate.ts`, который вычисляет paired holdout-результат для сравнения baseline и candidate:

- Некорректная запись, где task/family/method/verifier/evidence вместо строки содержит число, объект или null, отвергается как row; gate продолжает обрабатывать остальные валидные пары.
- Не-массив observations, неверное имя метода или некорректный объект options дают явную ошибку конфигурации.
- Producer `proposeVerifiedSkillPromotion` теперь применяет такой же строгий контракт до построения proposal: для `minPairedTasks`, `minAbsoluteGain`, `maxFamilyRegression` и `minCompleteSeeds` не происходит clamp/fallback при явно переданном невалидном значении; null/non-object options отклоняются сразу.
- `minPairedTasks` требует целое значение от 2 до 10 000; `minAbsoluteGain` и `maxFamilyRegression` — конечные числа в диапазоне `[0, 1]`. Значения не подрезаются и не заменяются молча.
- Пара baseline/candidate с несовпадающими task families исключается из знаменателя и учитывается как один rejected pair.
- В `p23-verified-skill-revision-gate.mjs` добавлены проверки повреждённых rows, mismatched-family accounting, строгих порогов и допустимых граничных значений. В `p23-verified-skill-promotion-proposal.mjs` добавлены producer-level регрессии для NaN/out-of-range threshold, недопустимого complete-seed count и null options.

Результат остаётся proposal-only: даже прошедший gate не активирует навык и не заменяет аутентификацию outcome/shadow evidence, независимую оценку или подписанное одобрение.

**Validation PASS (exact tested HEAD `2aa76acb545ac1a485962f4016c6586766424a0a`):** [WorkPass110 — P23 regression suite + runtime typecheck](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252825176); [Project progress ledger integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252825161); [Unified project integration suite — clean locked installs, app build/tests, cognitive integration contracts, approval gateway E2E, runtime/research smoke](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252825150). Scorecard percentages remain unchanged; these results do not measure external learning uplift.

## Связи между ветками

`main` — release-control ветка и не является корректной точкой сравнения исходного runtime. Полное исходное дерево хранится в `workpass70-source`; расширенный стек находится на `fix/mega-cognitive-progress-tracking-2026-10-26-r3` (WorkPass334). Отдельная ветка `fix/strict-ed25519-signature-encoding-2026-10-26` содержит этот security fix, но имеет иную историю и отстаёт по ряду направлений. Поэтому в текущую линию перенесён узкий кодовый diff и тесты.

Отдельная архитектурная зона риска: `fix/unified-substrate-runtime-wiring-rebased-2026-10-25` содержит отличающиеся изменения в `OrganismRuntime`, `UnifiedCognitiveSubstrate` и `CognitiveRoutingPolicy`. Их интеграция требует сравнения producer/consumer контрактов и проверки combined HEAD; автоматический wholesale merge без CI небезопасен.

Базовая ветка также продолжает двигаться: во время этого прохода в ней обновлялись progress-ledger скрипты и тесты. Текущая ветка WorkPass335 была создана заново от актуальной базовой линии и затем получила узкий security patch, чтобы не затирать эти изменения.

## Что ещё требуется подтвердить

1. **Подтверждено:** versioned skill store, verified skill revision gate, promotion proposal и остальные P23 learning regressions прошли в [WorkPass110](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252825176).
2. **Подтверждено:** runtime TypeScript typecheck прошёл внутри WorkPass110; app build/typecheck/tests и cognitive integration contracts прошли в [Unified project integration suite](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40252825150).
3. **Подтверждено:** все три workflow завершились PASS на exact HEAD `2aa76acb545ac1a485962f4016c6586766424a0a`.
4. Независимый holdout для learning/transfer и реальная проверка внешних postconditions.
5. Воспроизводимая пересборка и проверка основного release ZIP.

**Оценки прогресса не увеличены:** до выполнения проверок этот patch считается исправлением security contract, а не доказательством повышения обучаемости или готовности к production.
