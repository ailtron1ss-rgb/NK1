# WorkPass333 — происхождение семейств задач через evaluator → ledger → promotion

**Дата:** 26 октября 2026  
**Ветка:** `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
**База PR:** `f23c9aa4f5030987c2741808e930e7e100da077b`  
**Статус:** код внесён; финальные проверки на последнем HEAD выполняются.

## Что было не так

Добавить поле `taskFamily` только в адаптер и тестовый gate было недостаточно: независимый evaluator производит реальные отчёты P23, а дальнейший жизненный цикл использует `runBindings`, signed evidence binding и `VerifiedOutcomeLedger`. Если поле не приходит из доверенного источника и не проверяется на границе записи, любой вызывающий код может назначить удобную семью по имени задачи/баллам.

## Исправления

1. **Источник истины.** `IndependentSkillCandidateEvaluator` берёт семью только из `experimentAuthority.manifest` (`TaskManifestEntry.family`). Случай, когда manifest отсутствует, обозначается явным `null`, а не эвристикой по ID/тексту.
2. **Отпечаток плана.** `taskFamily` входит в вычисление `planFingerprint`; изменение состава/категоризации плана не должно сохранять прежний fingerprint.
3. **Отчёт и run binding.** На каждую задачу в evaluation report и `provenance.runBindings` записывается одна и та же manifest-derived family.
4. **Ledger commit.** `recordIndependentEvaluationOutcomes` сравнивает report family и binding family с canonical manifest до записи любых outcomes. Без полного совпадения запись отвергается.
5. **Matched comparison.** Отчёт семьи сверяется со своим run binding; baseline и candidate должны иметь одну family для каждой парной записи. Модифицированный JSON с пересчитанным envelope digest не получает доверия просто потому, что стал самосогласованным.
6. **Signed shadow evidence join.** `HermesVerifiedEvidenceBinding` дополнительно сверяет report family и binding family. Данное сравнение обеспечивает consistency, но не объявляет обычное поле JSON подписью: подлинность run/outcome остаётся обязанностью signed artifact verifier, manifest fingerprint и P23 gates.

## Дополнительная прямая регрессия ledger

`workpass203-independent-candidate-evaluator.mjs` теперь строит реальный manifest-backed evaluation, проверяет `taskFamily='summarization'` в validation/holdout reports и обоих run bindings, затем отдельно подменяет family в отчёте и binding и пересчитывает envelope fingerprint. Оба случая обязаны завершиться отказом до записи любых verified outcomes в `VerifiedOutcomeLedger`. Это проверяет контракт именно на write boundary, а не только в report UI.

## Исправление регрессии CI

На промежуточном HEAD `c3179f878a80dff9b01907e549d6f37488d0f5ee` WorkPass108 и P26 прошли. WorkPass110 упал в `workpass203-independent-candidate-evaluator.mjs`: ожидаемый плановый fingerprint был вычислен по старому списку полей, без `taskFamily`. Это не была ошибка автономного evaluator: после изменения контракта fixture должен включать `taskFamily: null` при отсутствующем experiment manifest. Ожидаемая формула исправлена, но требуется зелёный повторный запуск на новом commit.

## Что не утверждается

- Поле семьи не заменяет подписанный независимый outcome.
- Внутренний тест не доказывает рост навыков в реальном мире.
- Обязательные семьи являются per-skill policy; специализированный memory skill не обязан улучшать все несвязанные направления.
- Main не менялся, PR остаётся draft, основной ZIP-релиз не пересобран.
