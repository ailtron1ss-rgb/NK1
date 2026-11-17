# The Invention Loop — интегрированный контур доказательного саморазвития NK1

Ветка: `aspect/the-invention-loop-20261117`  
Компонент принадлежит `EvidenceResearchSubsystemRuntime`; ключи verifier-ов передаются только host-кодом через `OrganismSystemFabric`.

## Назначение и интеграция
The Invention Loop связывает в один проверяемый цикл:
- `IntrinsicExperimentGenerator`: формирует проверяемые гипотезы из uncertainty, prediction error, novelty и dream-associations
- `ScientificMethodEngine`: хранит вопрос, гипотезу, прогноз, provenance и только независимо подтверждённые evidence
- `VerifiedOutcomeLedger` + `VerifiedOutcomeArtifact`: проверяют task manifest, verifier identity, authority, seed/attempt и Ed25519-подпись
- `TheInventionLoop`: фиксирует протокол, прототип, независимую критику, replication cohort и закрытый holdout
- `AutonomousScientificBrainSubstrate`: получает train update только после полной успешной replication cohort; holdout идёт только в calibration и не изменяет веса

Публичные runtime-входы:
- `proposeIntrinsicInvention(input)` — создать ScientificMethod project и preregistered invention из автономной гипотезы
- `proposeDreamInvention(input)` — превратить candidate dream association в verification hypothesis, не в факт/память
- `recordInventionOutcome(id, signedArtifact)` — проверить подписанное измерение, сохранить outcome и передать только разрешённое evidence научным подсистемам
- `recordInventionCritique(id, signedArtifact)` — проверить подписанную независимую критику

Обе proposal-функции сначала валидируют evaluation protocol, затем создают ScientificMethod project и связывают его ID с invention provenance. Низкий intrinsic drive или невалидная dream association возвращают `null`; они не создают проект и не повышают epistemic status.

## Предрегистрация
До первого запуска фиксируются:
- question, hypothesis, success criteria
- отдельные SHA-256 fingerprints для validation (primary/replication) и sealed holdout; совпадающие fingerprints запрещены, measured baseline, metricScale, direction, minEffect и expectedEffect01
- minSuccessRate, primary seed и отдельные непересекающиеся наборы replication и holdout (каждый минимум 5 seed)
- четыре разные роли: primary verifier, independent critic, replication verifier, holdout verifier
- provenance: источник гипотезы, ID experiment generator и ID ScientificMethod project

Все входные структуры проходят plain-data snapshot до чтения полей. Изменение протокола после preregistration делает цепочку audit невалидной.

## Подписанные артефакты verifier-а
The Invention Loop принимает только `SignedOutcomeArtifact` с Ed25519-подписью и обязательным `measurement`:
- measurement содержит experiment ID, fingerprint полного протокола, SHA-256 прототипа и test fingerprint
- outcome дополнительно подписывает phase, seed, environment, measured value и evidence SHA-256
- critique подписывает ссылку/digest review-артефакта, blockers и limitations
- payload связан с manifest fingerprint из `buildInventionVerifierManifest()`; holdout manifest использует отдельный holdoutTestFingerprint, поэтому тот же fingerprint не может одновременно маркировать validation и holdout split
- эффект вычисляется NK1 из observed/baseline/metricScale/direction; signed `passed` сверяется с вычисленным результатом
- подпись проверяется существующим `ingestSignedOutcomeArtifact()`; один и тот же artifact/run/evidence/seed нельзя переиспользовать

Внешний verifier получает точный manifest через `inventionLoop.verifierManifest(id, phase, seed)` (или чистый builder `buildInventionVerifierManifest`), затем подписывает canonical payload. Приватные ключи должны находиться вне NK1, у evaluator/host. Public-key resolver передаётся конструктору `EvidenceResearchSubsystemRuntime` или `OrganismSystemFabric` как `inventionVerifierKeyResolver`. Если ключ не настроен, verifier неизвестен или подпись недействительна, запись не принимается. Ключи не входят в snapshot.

Подпись доказывает владение доверенным приватным ключом и целостность подписанного измерения; она не доказывает беспристрастность verifier-а. Разделение ролей, среды, seed и holdout остаются самостоятельными gate. NK1 проверяет, что validation/holdout fingerprints различаются; фактическую непересекаемость данных обязан обеспечивать доверенный host/evaluator, так как один digest не доказывает семантическую независимость двух датасетов.

## Цикл и promotion gates
`proposed → designed → prototyped → tested → critiqued → replicating → replicated → holdingout → accepted`

- Primary — только screening; провал закрывает invention как rejected.
- Critique — отдельный заранее назначенный подписывающий verifier; blockers немедленно отклоняют.
- Replication — все preregistered seed, разные среды выполнения, средний эффект ≥ minEffect и success rate ≥ minSuccessRate.
- Holdout — отдельный verifier, seed cohort и среды; acceptance требует полного покрытия, среднего эффекта и success rate по preregistration.
- Retry (`attempt != 1`), повтор seed, run ID, artifact ID, evidence reference и cross-invention replay отклоняются.

## Обучение и контроль утечки
`AutonomousScientificBrainSubstrate.learn()` получает один update только при переходе replication cohort в полностью подтверждённое состояние. Условия дополнительно ограничиваются собственным admission-gate научного мозга (evidence, replication и calibration error). Holdout передаётся с `holdout: true`: он измеряет калибровку, но не обновляет trainable weights. ScientificMethodEngine получает aggregate evidence только из прошедших подпись verifier receipts; неподписанный самоотчёт не меняет belief state.

## Состояние, аудит и восстановление
State schema The Invention Loop: version 4. Каждый переход включён в per-record SHA-256 audit chain; verifier receipts сохраняются вместе с record. Restore:
1. проверяет структуру и непрерывность цепочки переходов
2. перепроверяет каждую Ed25519 подпись по заново предоставленному host key resolver
3. повторно рассчитывает metric effect и cohort summaries
4. проверяет уникальность run/artifact/evidence/seed и stage consistency
5. отправляет неподтверждённые/изменённые записи в quarantine и заново вычисляет counters

Hash chain обнаруживает изменения сохранённого состояния; криптографическую подлинность verifier receipts обеспечивает Ed25519, а не сам hash chain.

## Проверка
Из `runtime/neuro-kurisu`:
```sh
node --experimental-strip-types tests/p23-signed-outcome-artifact.mjs
node --experimental-strip-types tests/the-invention-loop.mjs
npm run typecheck
```
Специальный GitHub Actions workflow выполняет те же две целевые проверки и typecheck для ветки/PR.
