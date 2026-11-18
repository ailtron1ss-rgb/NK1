# P53/P63 → Developmental Genome Bridge — 2026-11-18

## Назначение

Связать существующую лабораторию P53 и планировщик развития P63 с Developmental Genome, не создавая параллельных владельцев состояния или вторую систему исполнения. Мост — stateless-функция оценки и staging, подключённая через OrganismSystemFabric.

## Путь данных

1. P53 передаёт снимок кандидата в состоянии promotable. Повторно проверяются исходные пороги лаборатории: improvement ≥ 0.08, holdout ≥ 0.62, transfer ≥ 0.60, identity preservation ≥ 0.84, risk < 0.28, stability ≥ 0.58 и минимум две записи свидетельств.
2. P63 должен выбрать experiment, иметь confidence ≥ 0.60, development budget ≥ 0.10 и требовать controlled-comparison + holdout-outcome.
3. P60 veto блокирует эксперимент; caution переводит его в NEEDS_REVIEW. Только allow допускает дальнейшую оценку.
4. Существующий Genome Evolution Gate проверяет дочерний паспорт и lineage. В v1 меняются только разрешённые traits: estimatedCost01 и cadenceCycles.
5. Независимый evidence envelope связывает точные parent/candidate digests, evaluator/run IDs, отдельные baseline/holdout dataset IDs, fingerprint существующего IndependentEvaluationEvidence bundle, host-attestation digest, пять и более уникальных paired seeds и rollback checkpoint.
6. Bridge сам рассчитывает 95% bootstrap confidence interval с фиксированным seed, полученным из run ID. Любая отрицательная seed delta, неположительная нижняя граница, слабая continuity или отсутствующий rollback блокируют предложение.
7. Результат READY_FOR_HUMAN_REVIEW означает только, что пакет можно показать человеку на рассмотрение.

## Границы безопасности

- activation во всех ответах и кандидатах остаётся NOT_APPLIED.
- Мост не вызывает P53.promote, не изменяет P53 active profile, P63 state или runtime system contracts.
- Нет горячей замены архитектуры, записи в persistence, автоматического merge, code generation или изменения весов модели.
- SHA-256 digest обеспечивает детерминированную целостность содержимого, но не цифровую подпись.
- independent, holdoutDisjoint, hostAttestationDigest и fingerprint bundle — входные аттестации/идентификаторы. Этот модуль проверяет форму, привязки и digest envelope, но не криптографически удостоверяет личность независимого оценщика или происхождение внешнего attestation. Для production-grade trust host должен независимо проверить attestation и provenance.
- Пять пар seeds — минимальный safety floor, а не доказательство статистической мощности и не замена более крупному preregistered holdout/longitudinal benchmark.

## Проверка

Тестовый контракт охватывает P53/P63/P60 gates, lineage/evidence binding, paired-seed bootstrap, rollback, continuity, digest tampering, dataset overlap, deterministic receipts и hostile/cyclic inputs. Workflow developmental-genome запускает исходные genome tests, bridge tests, runtime typecheck и architecture audit.
