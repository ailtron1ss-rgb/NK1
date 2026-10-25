# WorkPass532 — оценщик саморазвития P36 на подписанном VerifiedOutcomeLedger

**Дата:** 25 октября 2026 г.  
**Ветка:** `feature/learning`  
**PR:** [#79 → integration](https://github.com/ailtron1ss-rgb/NK1/pull/79)  
**Граница проверки:** код, тест и CI-конфигурация добавлены; фактический запуск текущего HEAD не подтверждён.

## Что реализовано

Добавлен `runtime/neuro-kurisu/src/organism/learning/P36VerifiedOutcomeLedgerEvaluator.ts`. Это адаптер для поля `OrganismConfig.p36IndependentEvaluator`; он использует существующие `VerifiedOutcomeLedger` и `VerifiedOutcomeArtifact`, а не создаёт параллельный источник истины.

Адаптер пересчитывает результат по подписанным и аутентифицированным артефактам. В расчёт включаются только строки:
- для точного manifest и split `holdout`;
- от ожидаемого verifier и с совпадающей версией задачи;
- с авторитетом `independent-verifier`;
- для baseline и treatment, с одинаковым полным покрытием задач на каждом seed;
- для которых `hasAuthenticatedOutcomeEvidence(ledger, evidenceRef)` подтверждает живую процесс-локальную квитанцию подписи.

Нужно не менее четырёх парных seed. Оценка сначала усредняет pass rate задач в каждом seed, затем усредняет независимые seed — коррелированные task cells не выдаются за самостоятельные наблюдения.

**Уточнение WorkPass533:** baseline method, treatment method и task family теперь закрепляются в host-конфигурации оценщика. Runtime-запрос не может переключить пару методов или семейство после просмотра holdout-результатов. Подробности: [WorkPass533 — фиксация авторитета пары методов](WORKPASS533_P36_METHOD_PAIR_AUTHORITY_RU.md).

## Что защищено

- Конфигурация требует совпадения manifest fingerprint и bounded-идентификаторов evaluator/source.
- Входные значения `control01` и `treatment01` не определяют результат. Они только заявка, которую executor сверяет с заново рассчитанными значениями из реестра; callback verifier повторяет измерение и проверяет полный результат, evidence refs, methods, family, manifest и expected/observed postcondition.
- Изменённые баллы, отсутствующее покрытие, неверный manifest, недостаточное число seed или неподтверждённые строки приводят к отказу.
- Снимок `VerifiedOutcomeLedger` после восстановления — это сериализованные данные, не подписи. Адаптер fail-closed, пока исходные подписанные артефакты не будут повторно проверены и заново введены в реестр.
- P36 хранит в свидетельстве baseline/treatment methods, task family и manifest fingerprint. Результаты разных evaluator-version/manifest/method-pair/family не должны смешиваться в одном статистическом gate.

## Чего этот адаптер не утверждает

Этот слой измеряет **моментальный holdout**, поэтому он намеренно требует `delayMs: 0`. Он не подтверждает, что улучшение сохранилось спустя часы или дни, и не подтверждает перенос навыка на новые задачи. Для этих ворот нужны отдельные независимые delayed-retention и transfer наблюдения. Одна подписанная таблица holdout не должна позволять P36 объявить зрелость или воспроизводимость.

Production launcher всё ещё обязан создать адаптер из доверенной конфигурации хоста и предоставить реестр, артефакты которого действительно подписал доверенный verifier. Тестовые ключи существуют только в fixture; они не являются секретами production и не устанавливаются runtime.

## Регрессии

Добавлен `runtime/neuro-kurisu/tests/p36-verified-outcome-ledger-evaluator.mjs`, скрипт `npm run test:p36:verified-ledger-evaluator` и шаг в `.github/workflows/p26-learning-validation.yml`.

Тест создаёт 32 подписанных артефакта по четырём holdout-задачам, двум методам и четырём seed; проверяет равную по seed оценку baseline/treatment, отказ на фальшивом score, отказ на задержке/manifest без основания, а также отсутствие доверия к обычному снимку после восстановления. Затем он пропускает результат через ActionGateway и удостоверяется, что P36 принимает только одну проверенную точечную запись и не продвигает гипотезу до получения задержанных доказательств.

## Проверка и оставшиеся шаги

- Исходник, тест, команда package.json, workflow и handover закоммичены в `feature/learning`.
- Точный HEAD TypeScript typecheck и P36 test suite **ещё не подтверждены запуском**. Не заявляется прохождение CI.
- Требуется подключить production trusted-verifier keyring, путь загрузки/повторной аутентификации артефактов после перезапуска и независимые delayed-retention/transfer наблюдения. Без этого нельзя повысить оценку готовности или заявлять эмпирический прирост способностей.
- `main` и Release ZIP не изменялись; PR #79 остаётся draft.
