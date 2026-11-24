# NeuroCore / NK1 — P1: безопасный допуск самоулучшений
Дата: 24 ноября 2026  
Каноническая база интеграции: `workpass70-source @ 87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`  
Проверенная реализация-источник: `aspect/host-owned-patch-receipt-authority-20261103 @ 74ed2279c5bbdbcf7ffc18833956c6990b0518bf`

## Что реализовано

### 1. Структурная модель исходного кода
`SourceGraph` строит детерминированный граф source inventory, модулей, символов и импортов. Связи имеют происхождение `EXTRACTED` либо `INFERRED`; inferred связи нельзя выдавать за факт. Относительные импорты разрешаются от каталога импортирующего файла. `SelfModificationGuard` защищает и файлы по пути, и файлы, содержащие критические символы внутри нейтрально названного файла.

### 2. Точная привязка patch receipt
`PatchReceiptGuard` проверяет Ed25519-подпись host-owned ключом, точный base SHA, digest байтов diff, manifest реально изменённых файлов/строк и containment в разрешённом evolve block. Candidate proof не может подменить base SHA, source graph или публичные ключи.

### 3. Независимое измерение улучшения
`PairedSelfImprovementEvidence` принимает только подписанные host evaluator артефакты. Каждый outcome привязан к:
- candidate ID и точному SHA патча;
- experiment ID;
- protocol fingerprint;
- task-manifest fingerprint;
- test fingerprint и attempt;
- уникальному seed, evidence ID и environment ID;
- holdout split и verifier ID.

Требуется минимум пять уникальных пар, минимум два разных verifier public key и две среды. Все пары обязаны иметь один protocol/manifest/test identity. Публичные ключи evaluator registry уникальны, не совпадают между verifier ID и не переиспользуются от patch signer. Proxy traps и malformed/accessor-backed поля обрабатываются fail-closed.

### 4. Единый host-owned admission service
`SelfImprovementPatchAdmissionService` принимает полный исходный снимок от доверенного host composition root, проверяет точный commit SHA и canonical snapshot SHA-256, строит SourceGraph и скрывает внутренние graph/pool. Низкоуровневый verified admission защищён module-private capability token. Candidate не может сконструировать его самостоятельно.

Результат tagged `signed-patch-receipt` несёт hash/fingerprint receipt и holdout evidence. Обычные observations остаются `metrics-only` и не могут разрешить patch admission.

## Защита live runtime

- Guard блокирует evaluator, holdout, approval authority, trust roots, identity, action gateway, source graph и саму admission machinery.
- Запрет применяется к реальным owning files критических symbols, а не только к имени пути.
- DangerModel учитывает rollback readiness, blast radius, чувствительные подсистемы и paired downstream evidence.
- CanonicalSelfAgencyAuthority и live Core regressions запускаются в профильном CI.
- Не добавлены production private keys. Host public keys и source snapshot должны поступать из operator-controlled deployment composition, не из модели или runtime-writable memory.

## Проверки

Профильный workflow `NK1 self-analysis substrate` на проверенной donor revision завершился SUCCESS в двух запусках. Он выполнил:
1. locked dependency install;
2. structural source index / self-modification guard;
3. signed patch receipt / changed-line containment;
4. cryptographic admission + independently signed paired holdout;
5. host source snapshot boundary;
6. SelfAgency authority и live Core integration;
7. stale-evidence rejection / progress axes;
8. exact SHA progress report;
9. adversarial self-modification regression;
10. runtime typecheck.

Run 1: https://github.com/ailtron1ss-rgb/NK1/actions/runs/45479883422  
Run 2: https://github.com/ailtron1ss-rgb/NK1/actions/runs/45479870660

## Статус и ограничения

Это **admission/preflight**, не активированный self-edit executor. Service не пишет файлы, не создаёт ветки, не запускает arbitrary patch, не мерджит и не публикует Release. В Core не подключён автоматический путь применения таких patches. Для следующего P2 этапа нужны отдельные host-isolated apply/test, независимая post-apply evaluation, проверка rollback, операторское approval и exact-base lease.

P53DevelopmentalSelfModificationLab пока не promoted: его shadow/holdout split и независимость evaluator требуют отдельного исправления и runtime wiring. Нельзя считать P1 равным готовому автономному переписыванию исходников.
