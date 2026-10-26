# WorkPass336 — строгая проверка подписанного evidence artifact

**Дата:** 26 октября 2026 г.  
**Ветка:** `work/nk1-workpass335-learning-gate-rebased-2026-10-26-r1`  
**Code commit:** `4c817208c27d623474e08b6db1dbf2e81cc82991`  
**Regression commit:** `05fad9f67960af1d1cb9f7ed535aba3e49b2973f`  
**Статус:** PASS на exact code/test HEAD `338902ce5587c8d887acc20ae5c5181f79cd1f87` после синхронизации с базой `cddb58ae48dace8952fe29b37b7e33efae0cdec5`.

## Что изменено

В `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeArtifact.ts` ужесточен ingress для независимо подписанных результатов задач:

- Артефакт и payload версии 1 должны быть plain-data объектами с точным набором полей. Неизвестные поля отклоняются, чтобы расширение payload не могло неявно менять его семантику.
- Проверка получает snapshot из property descriptors, а не читает значения напрямую. Accessor-свойства, массивы, нестандартные прототипы и объекты, которые ломают introspection, закрываются отказом; пользовательские getters не вызываются.
- Ed25519 подпись должна быть стандартной канонической Base64-строкой ровно для 64 байт: ожидаются корректная длина, алфавит и совпадающий encode/decode round-trip.
- Криптографическая проверка подписывает канонизированный snapshot, а не исходный объект, переданный вызывающей стороной.

## Новые регрессии

В `runtime/neuro-kurisu/tests/p23-versioned-skill-candidate-store.mjs` добавлены проверки:

1. префикс посторонних символов, усечённый padding и некорректный padding у подписи отклоняются с `invalid-signature-encoding`;
2. getter в поле payload не выполняется, artifact отклоняется как `invalid-artifact-schema`;
3. getter на конверте артефакта также не выполняется;
4. неизвестное поле в payload schema v1 отклоняется.

Позитивный путь остаётся представлен исходным валидным подписанным fixture: сразу после негативных проверок исходный артефакт должен приниматься.

## Совмещённые соседние изменения

Актуальная база также содержит независимую проверку происхождения evaluator результата в `IndependentSkillCandidateEvaluator.ts` / `VerifiedOutcomeLedger.ts`: копия поддельного envelope не проходит commit boundary только за счёт пересчёта публичного SHA-256. Этот проход сохраняет данный механизм и регрессии `workpass203-independent-candidate-evaluator.mjs`, а также ранее добавленный полный preflight до первой записи в ledger. Детали evaluator-origin фикса находятся в `docs/WORKPASS336_EVALUATOR_ORIGIN_ATTESTATION_RU.md`.

## Границы утверждений

Этот проход укрепляет целостность и форму внешних signed outcome artifacts. Успешные unit/CI тесты сами по себе не доказывают непредвзятость внешнего verifier, реальный рост способности обучаться, надёжность на независимом внешнем holdout или production readiness. Оценки прогресса не повышались; `main` и release ZIP не затрагивались.

**Проверка:** все пять обязательных workflow завершились `success` на точном code/test HEAD `338902ce5587c8d887acc20ae5c5181f79cd1f87` (ссылки выше). Более поздний commit `240b51522c400fdb8639b9509d199ef50ef1b4ea` и его следующий документальный follow-up меняют только документацию/tracker, не runtime или тестовые blobs; на docs HEAD отдельно прошли WorkPass110, WorkPass108, WorkPass105 и progress-ledger integrity, а повторный Unified integration run ещё выполняется. Исторические PASS до объединённого code/test HEAD не засчитывались как его проверка.


## Exact-head validation evidence

Все пять обязательных workflow завершились `success` на code/test HEAD `338902ce5587c8d887acc20ae5c5181f79cd1f87`:

- [WorkPass110 — P23 regressions + runtime typecheck](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40254843579), включая signed outcome artifact authentication regression, verified revision gate, promotion proposal и persisted learning restore checks.
- [WorkPass108 — paired evidence and promotion gate](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40254843575).
- [WorkPass105 — verified outcome ledger](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40254843582).
- [Unified project integration suite](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40254843740): locked install, app typecheck/build/tests, cognitive integration contracts, governed approval gateway/bridge E2E, runtime/research bridge smoke; runtime typecheck emitted `TYPECHECK=PASS`.
- [Project progress ledger integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40254843566).

This validates the combined source/test checkpoint, not a measured improvement in external task success or transfer. Scores remain unchanged; release readiness remains unclaimed.


## Latest WorkPass344 exact-head evidence (2026-10-26)

The later ledger/promotion trust-boundary checkpoint passed all five required workflows on exact code/test HEAD `60c038454cfcf3bdb710d75f73632f585dcf65ff`:
- [WorkPass110 continual-learning metrics + runtime typecheck](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40273298598)
- [WorkPass108 paired evidence identity / verified promotion gate](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40273298708)
- [WorkPass105 verified outcome ledger](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40273298611)
- [Unified project integration suite](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40273298596)
- [Project progress ledger integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40273298594)

This newer result supersedes no historical result; it records that the combined WorkPass344 code/test checkpoint passed after the strict-options test was aligned to the fail-closed contract. No score uplift or release-readiness claim is made.
