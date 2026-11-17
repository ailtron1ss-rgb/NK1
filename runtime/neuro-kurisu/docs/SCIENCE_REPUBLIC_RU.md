# OmeStro №18 — Science Republic

## Назначение

Science Republic — ролевой и provenance-слой научной работы NeuroCore. Он организует Discoverer, Theorist, Experimentalist, Replicator, Skeptic и Auditor вокруг одного канонического экспериментального процесса. Он не создаёт второй генератор гипотез, второй outcome ledger или второй механизм проверки подписей.

## Шесть ролей

| Роль | Обязанность | Контроль |
|---|---|---|
| Discoverer | Фиксирует наблюдение, домен и ссылку на evidence | Отделяет наблюдение от интерпретации |
| Theorist | Формулирует механизм, предсказания, falsifiers и альтернативы | Теория должна быть опровержимой |
| Experimentalist | Замораживает test/holdout manifests и связывает протокол с гипотезой | Fingerprint теста должен совпадать с preregistration |
| Replicator | Передаёт подписанные replication-измерения | ID обязан совпадать с verifierPlan.replication |
| Skeptic | Передаёт подписанную независимую критику | ID обязан совпадать с verifierPlan.critique |
| Auditor | Сверяет полный manifest научных артефактов | Не может подменить подписи заявлением о проверке |

Primary и holdout evaluator — дополнительные исполнители, отдельные от шести ролей и друг от друга. Skeptic и Replicator привязаны к соответствующим verifier slots канонического `TheInventionLoop`. Четыре verifier ID должны оставаться уникальными.

## Архитектурное владение

- `EvidenceResearchSubsystemRuntime` создаёт ровно один `TheInventionLoop` с host-owned `InventionVerifierKeyResolver`.
- `ScienceRepublic` получает тот же экземпляр loop; второй движок или shadow state экспериментов не создаётся.
- Hypothesis generation остаётся в `IntrinsicExperimentGenerator`, capture и дедупликация — в `EvidenceResearchSubsystemRuntime.captureGeneratedExperiment/findCapturedExperiment`.
- `openScienceCaseFromCapturedCandidate` передаёт уже существующий capture в Science Republic и переиспользует существующий `ScientificMethodEngine` project.
- `registerScienceRepublicExperiment` валидирует протокол и manifest до создания canonical invention record. Для captured hypothesis сохраняются её source, experiment ID и scientific project ID; для manual case создаётся отдельный ScientificMethod project.
- Signed outcomes и critique делегируются runtime-методам `recordInventionOutcome` и `recordInventionCritique`. Поэтому проверенная replication cohort продолжает поступать в `AutonomousScientificBrainSubstrate`, а holdout используется только для калибровки и не обновляет trainable weights.
- Snapshot сохраняет и канонический loop, и ролевую проекцию. Restore сначала проверяет signed artifacts в loop через host key resolver, затем сверяет ссылки Science Republic с восстановленными canonical records.

## Жизненный цикл

`discovered → theorized → registered → prototyped → tested → critiqued → replicating → replicated → holdingout → awaiting-audit → audit-complete`

Отрицательный primary outcome, блокирующая critique или провал preregistered cohort завершаются в `rejected`. Принятый эксперимент с неполным Auditor manifest или audit blocker получает `audit-blocked`.

1. Discoverer создаёт source-bound observation. Для intrinsic/dream hypothesis используется существующий captured candidate; он остаётся hypothesis, не доказательством.
2. Theorist закрепляет механизм, предсказания, falsifiers и альтернативные объяснения отдельным evidence artifact.
3. Experimentalist preregisters `testFingerprint` и отдельный `holdoutTestFingerprint`; оба должны совпасть с хешами замороженных manifests.
4. Prototype добавляется в canonical Invention Loop как digest-bound reference; Science Republic не исполняет prototype.
5. Primary, replication и holdout outcomes передаются только как Ed25519-signed `SignedOutcomeArtifact`. Подпись связывает task manifest, experiment ID, protocol fingerprint, prototype digest, phase, test fingerprint, environment, измеренное значение и evidence digest.
6. Skeptic передаёт подписанную critique, связанную с тем же experiment/prototype/protocol.
7. Auditor сверяет точный список discovery, theory, оба manifests, prototype, каждого signed outcome и critique. Пропущенные, лишние, повторные или несовпадающие ссылки блокируют audit.

## Размер когорт и аудит

`TheInventionLoop` ограничивает replication и holdout cohorts диапазоном 5–12 уникальных seed. Science Republic имеет 32-event audit cap на запись. Полный максимально допустимый цикл с 12 replication и 12 holdout seed занимает 31 событие, включая discovery, theory, preregistration, prototype, primary, critique и final audit.

## Границы доверия

- Подписи signed outcomes/critique проверяются canonical `TheInventionLoop` через host-provided trusted public keys. Приватные ключи не хранятся в NK1 runtime или snapshots.
- Успешная подпись доказывает владение соответствующим ключом и целостность подписанного measurement payload; она сама по себе не доказывает беспристрастность evaluator или независимость организации.
- Идентичности шести ролей можно связать с host-owned principal registry через `ScienceRoleIdentityResolver` (constructor `EvidenceResearchSubsystemRuntime` или `OrganismSystemFabric`, либо `configureScienceRoleIdentityResolver` на runtime/fabric). Resolver обязан возвращать стабильный canonical subject для каждой пары role/actor; повторяющиеся principals отвергаются. Состояние хранит только subject IDs, а не ключи. Restore повторно вызывает resolver и помещает запись в quarantine, если binding изменён или resolver недоступен.
- Без host resolver роль остаётся `declared-only`. Это не маскируется под внешнюю независимость.
- `ScienceArtifactBytesVerifier` (constructor `EvidenceResearchSubsystemRuntime` или `OrganismSystemFabric`, либо `configureScienceArtifactBytesVerifier` на runtime/fabric) — синхронный host adapter к доверенному artifact store. Он обязан проверять реальные bytes и вычисленный SHA-256 каждого evidence reference и самого audit report. Для audit report callback также получает `actorRole`, `actorId` и, при наличии, canonical `actorSubject` Auditor, чтобы host storage мог проверить authorship policy. При отсутствии resolver/объекта/совпадения audit может быть только `reference-complete`; `byte-verified` выдаётся только когда проверены все исходные артефакты, signed outcome/critique receipts и сам audit artifact. Restore повторяет byte verification для записей с этим статусом.
- Уникальность проверяется и по reference, и по digest: один blob нельзя выдать за несколько разных артефактов/ролей/этапов.
- Подписи `TheInventionLoop`, host identity resolver и host artifact verifier — отдельные trust seams. Но они сами по себе всё ещё не доказывают беспристрастность организации или научную истину.
- `roleIdentity` и `artifactBytesVerified` — ортогональные статусы: byte verification само по себе не повышает `declared-only` до `host-attested`. Поэтому `independentlyVerified=false` и `promotionEligible=false` остаются неизменными даже после `byte-verified`. Этот статус подтверждает реальные байты артефактов и audit report, а не научную истину или разрешение на autonomous model promotion.

## Проверка

Из `runtime/neuro-kurisu`:

```sh
npm run typecheck
node --experimental-transform-types --experimental-strip-types tests/science-republic.mjs
node --experimental-transform-types --experimental-strip-types tests/the-invention-loop.mjs
```

Фокусированный CI workflow: `.github/workflows/science-republic.yml`.
