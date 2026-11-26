# NK1: у гейта продвижения появился единственный владелец критериев

Дата: 2026-11-26. Ветка: `feat/p53-sealed-holdout-and-wiring-census-20261126`. Продолжение отчёта `NK1_RUNTIME_WIRING_CENSUS_RU_2026-11-26.md`.

## 1. Найденное дублирование

`VerifiedOutcomePromotionGate` (55-й orphan из переписи) содержал ровно те критерии продвижения, которые `VerifiedSkillPromotion.proposeVerifiedSkillPromotion` — живой путь `OrganismCore` → `P23LearningEngine.stageVerifiedSkillCandidate` → `VersionedSkillCandidateStore` — держал своей копией кода: минимальный прирост, положительная нижняя граница доверительного интервала, регрессия по семьям задач. Две реализации одного гейта нарушают правило «один канонический владелец на возможность» и расходятся при правке: изменение в гейте не влияло на реальное решение.

## 2. Что изменено

1. `VerifiedOutcomePromotionGate` получил явный параметр `pairedUnit: 'task-cell' | 'seed-cluster'` (по умолчанию `task-cell`, прежнее поведение не изменилось). Для `seed-cluster` семейные суммы законно пересчитывают одни и те же полные seed'ы, поэтому требуется `familyPairTotal >= aggregate.pairedN` вместо точного равенства. Невозможный случай (сумма семей меньше агрегата) по-прежнему fail-closed с `family-pair-count-mismatch`, неизвестный `pairedUnit` — ошибка конфигурации.
2. `proposeVerifiedSkillPromotion` больше не дублирует критерии: он передаёт в канонический гейт seed-кластеризованные `PairedMethodSummary` (`comparePairedBySeed` + `comparePairedByFamilyAndSeed`) с `pairedUnit: 'seed-cluster'` и берёт вердикт оттуда. Собственным у предложения остаётся только то, чего гейт не знает: подлинность артефактов, уникальное покрытие задач и дополнительный bootstrap-интервал по seed-кластерам.
3. Коды причин отказа сохранены (`unauthenticated-outcome-evidence`, `insufficient-independent-heldout-task-coverage`, `insufficient-complete-holdout-seed-coverage`, `seed-clustered-family-regression`, `seed-clustered-gain-not-statistically-supported`), поэтому внешние контракты и журналы не изменились.
4. `VerifiedOutcomePromotionGate.ts` удалён из `scripts/runtime-wiring-baseline.json`: перепись теперь `canonicalModules=700`, `connectedModules=636`, `orphans=64`, `connectionRatio01=0.9086`.

## 3. Регрессии

- `tests/p23-verified-outcome-promotion-gate.mjs`: seed-кластеризованные семьи с суммой больше агрегата принимаются только при `pairedUnit: 'seed-cluster'`; тот же вход при `task-cell` даёт `family-pair-count-mismatch`; сумма семей меньше агрегата отклоняется; неизвестный `pairedUnit` — ошибка конфигурации.
- `tests/p23-verified-skill-promotion-proposal.mjs`: добавлен сценарий, где pooled-прирост равен нулю (одна семья +1, другая −1). Такой кандидат отклоняется именно с `seed-clustered-family-regression`, что доказывает: решение принимает подключённый канонический гейт, а не агрегат.

## 4. Прогон

`p23-verified-outcome-promotion-gate`, `p23-verified-skill-promotion-proposal`, `p23-outcome-promotion-integration`, `p23-skill-evaluation-report`, `p23-verified-skill-revision-gate`, `p23-create-skill-promotion-approval-request`, `workpass402-production-promotion-family-gate`, `p23-hermes-production-promotion-gate` — PASS; `tests/runtime-wiring-census.mjs` — PASS (700/636/64); `audit-runtime-wiring --strict --baseline` — `RUNTIME_WIRING_STRICT=PASS WIRING_NEW_ORPHANS=0`; `typecheck-runtime` — `TYPECHECK=PASS mode=tsc`; `audit-architecture` — `CLEAN_ARCHITECTURE=PASS`.

## 5. Что этим НЕ доказано

- Гейт включён в решение о **предложении** продвижения, но не в подписанное одобрение: активация по-прежнему требует внешнего Ed25519-approval и остаётся `canActivateAutomatically: false`.
- Порог гейта для seed-кластеров задаётся политикой предложения (`minCompleteSeeds`), а не `minPairedTasks` пакетного гейта: единицы счёта разные, и это зафиксировано параметром `pairedUnit`.
- P36-путь (`recordExternalEvidence`) не тронут: там своя единица свидетельства (дельты по контекстам), и подключать к нему пакетный гейт без отдельного контракта означало бы сравнивать несравнимое.
- `P36HostEvaluatorBootstrap` и `P36VerifiedOutcomeLedgerEvaluator` остаются orphan'ами: у них нет точки входа в `OrganismCore` (конфиг `OrganismConfig.p36IndependentEvaluator` нигде не читается).
- Никаких заявлений об uplift или ускорении не делается: измерений не было.
