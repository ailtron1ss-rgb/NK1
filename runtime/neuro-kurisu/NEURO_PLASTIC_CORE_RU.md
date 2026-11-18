# Neuro-Plastic Core — руководство по локальным LoRA/QLoRA-адаптерам

**Статус:** кодовый контур добавлен в аспектную ветку; обучение реальной модели, построение production corpus и выпуск адаптера ещё не выполнены. Базовая модель не меняется и остаётся fallback.

## Назначение и поток

Neuro-Plastic Core добавляет к существующим P23/P26/P28/P40 отдельный офлайн-цикл параметрической адаптации локальной LLM:

1. P23 предоставляет опыт с provenance и независимой проверкой.
2. Host-owned resolver раскрывает только разрешённые prompt/completion-пары для обучения.
3. Trainer получает только train и validation; holdout в training corpus не экспортируется.
4. Локальный PEFT trainer обучает изолированный LoRA или QLoRA adapter, не обновляя исходные веса.
5. Внешний evaluator сравнивает baseline и candidate на закрытых парных holdout-сценариях и подписывает точный результат.
6. Реестр проверяет receipt, статистические и safety-gates; успешная оценка даёт только статус eligible.
7. Отдельная подпись оператора разрешает активацию.
8. P40-selected local backend вызывает только подходящий domain adapter; любой неподходящий маршрут или runtime fault возвращает исходную модель.

Это не утверждение о доказанном улучшении NeuroCore: улучшение появляется только после реального обучения и независимого измерения.

## Компоненты

| Файл | Ответственность |
|---|---|
| src/organism/learning/NeuroPlasticCorpusBuilder.ts | Строит domain corpus из проверенного P23 dataset через host resolver, проверяет consent/provenance и очищает PII/secrets |
| src/organism/learning/NeuroPlasticAdapterRegistry.ts | Манифест, artifact identity, evaluator receipts, парные holdout gates, ручная активация, restore/rollback |
| scripts/neuro_plastic_train.py | Offline LoRA/QLoRA training и artifact hashes |
| scripts/neuro_plastic_registry.mjs | Stage/evaluate/approve/activate/rollback CLI |
| src/organism/integration/local/NeuroPlasticInferenceAdapter.ts | Domain routing, base-model identity guard, runtime fallback |
| src/organism/language/LanguageOrgan.ts | Преобразует каноническое выбранное действие в ограниченный adapter domain и confidence/risk |
| src/server/server.mjs | Загружает подписанный registry snapshot, маршрутизирует local llama.cpp calls и сохраняет disable/rollback |

## 1. Сформировать доказательный corpus

Используйте buildVerifiedSessionDataset(ledger) из P23 как источник verified metadata. Prompts/completions не извлекаются автоматически из evidence references: их раскрывает отдельный host-owned resolver, который уже имеет право читать исходную запись и может проверить назначение обучения.

Resolver должен возвращать для каждой train/validation строки:

- domain, prompt, completion;
- outcome: verified-success или verified-correction;
- consent: trainingOptIn=true, privacyReviewed=true, licenseApproved=true, piiScreening="passed";
- аттестацию: attestedBy, attestedAt, licenseId, provenanceDigest; последний должен в точности совпадать с evidenceRefDigest текущего P23 outcome.

Не передавайте в resolver для обучения holdout-записи. Не используйте self-report. Не обучайте correction-примеры, если correction не подтверждён human-review с тем же verifier identity. Builder не включает raw evidence refs, identities, holdout aggregate scores или holdout examples в JSONL. Встроенная PII-фильтрация — дополнительная защита, а не замена privacy review и consent.

Пример host-side вызова:

    import { writeFile } from 'node:fs/promises';
    import { buildVerifiedSessionDataset } from './src/organism/learning/VerifiedSessionDataset.ts';
    import {
      buildVerifiedNeuroPlasticCorpus,
      toNeuroPlasticJsonl,
    } from './src/organism/learning/NeuroPlasticCorpusBuilder.ts';

    const verified = buildVerifiedSessionDataset(verifiedOutcomeLedger);
    const corpus = buildVerifiedNeuroPlasticCorpus(verified, resolveConsentAndContent, 'reasoning');
    await writeFile('neuro-plastic-data/train.jsonl', toNeuroPlasticJsonl(corpus, 'train'));
    await writeFile('neuro-plastic-data/validation.jsonl', toNeuroPlasticJsonl(corpus, 'validation'));

Каждая JSONL строка имеет ровно четыре поля: exampleId, domain, prompt, completion. Например:

    {"exampleId":"stable-id","domain":"reasoning","prompt":"...","completion":"..."}

Для одного corpus требуется минимум 5 train и 2 validation примера, независимые train/validation seeds, отсутствие task/example overlap и отсутствие одинаковых prompt fingerprints между train и validation. Это только технический минимум для подготовки: для реального вывода о качестве используйте существенно более крупный и репрезентативный набор.

## 2. Подготовить локальную модель и запустить trainer

Trainer не скачивает модели: base model и tokenizer должны уже находиться в локальной директории. Установите optional dependencies в изолированное Python-окружение:

    python3 -m venv .venv-neuro-plastic
    . .venv-neuro-plastic/bin/activate
    pip install -r requirements-neuro-plastic.txt

Для QLoRA сначала установите PyTorch wheel, совместимый с вашей CUDA/драйвером, затем зависимости из файла. QLoRA требует Linux, CUDA и bitsandbytes; CPU-only QLoRA намеренно завершается ошибкой. Для обычной LoRA можно использовать совместимый CPU/GPU PyTorch, но полноценное обучение 7B на CPU практически непригодно.

Получите fingerprints base model и tokenizer:

    python scripts/neuro_plastic_train.py --fingerprint-model /absolute/path/to/base-model
    python scripts/neuro_plastic_train.py --fingerprint-tokenizer /absolute/path/to/base-model

Создайте manifest рядом с JSONL. Пути к train/validation и output задаются относительно manifest; base model может быть абсолютным локальным путём:

    {
      "schemaVersion": 1,
      "method": "lora",
      "domain": "reasoning",
      "adapterId": "kurisu-reasoning-v1",
      "baseModelId": "kurisu-7b",
      "backendId": "llama.cpp",
      "baseModelAlias": "kurisu-base",
      "servedModelAlias": "kurisu-reasoning-lora",
      "governance": {
        "trainingOptIn": true,
        "privacyReviewed": true,
        "licenseApproved": true,
        "piiScreening": "passed",
        "evidenceCount": 9,
        "attestedBy": "reviewed-by-operator",
        "attestedAt": 1800000000000,
        "licenseId": "documented-approved-license-id"
      },
      "baseModelDirectory": "/absolute/path/to/base-model",
      "baseModelFingerprint": "<sha256-from-fingerprint-model>",
      "tokenizerFingerprint": "<sha256-from-fingerprint-tokenizer>",
      "sourceDatasetFingerprint": "<verified-P23-dataset-sha256>",
      "holdoutPlanFingerprint": "<P23-manifest-fingerprint>",
      "trainingFile": "train.jsonl",
      "validationFile": "validation.jsonl",
      "corpusFingerprint": "<corpus.corpusFingerprint>",
      "outputDirectory": "adapter-store/kurisu-reasoning-v1",
      "seed": 41,
      "maxSequenceLength": 2048,
      "epochs": 2,
      "learningRate": 0.0002,
      "lora": {
        "rank": 16,
        "alpha": 32,
        "dropout": 0.05
      }
    }

Проверка без обучения:

    python scripts/neuro_plastic_train.py --manifest neuro-plastic-data/manifest.json --check-only

Обучение:

    python scripts/neuro_plastic_train.py --manifest neuro-plastic-data/manifest.json

Результат записывается в отдельный adapter-store/<adapterId>: adapter_config.json, adapter_model.safetensors и neuro-plastic-artifact.json. Исходная base model не перезаписывается; её fingerprint вычисляется повторно после тренировки. QLoRA использует 4-bit NF4 и PEFT target_modules="all-linear"; LoRA использует найденные поддерживаемые attention/MLP projection modules.

## 3. Зарегистрировать готовый adapter manifest

Trainer автоматически пишет рядом с adapter weights файл `neuro-plastic-registry-manifest.json`. В нём уже согласованы base-model ID/backend/base alias, LoRA method/domain, tokenizer/dataset/holdout/corpus fingerprints, registry governance attestation, trainer version/seed, served-model alias и реальные SHA-256/размеры `adapter_config.json` и `adapter_model.safetensors`.

После успешного обучения проверьте этот manifest и убедитесь, что:

- `baseModel.servedModelAlias` — тот же alias, который реально обслуживает выбранную базовую модель в локальном backend;
- `servedModelAlias` — заранее загруженный adapter alias, а не alias, который backend должен автоматически угадать;
- все governance поля подтверждают реальный opt-in, privacy review, license review и screening. Trainer требует эти поля до обучения и копирует их в отдельный registry manifest и artifact metadata;
- output каталог совпадает с `adapter-store/<adapterId>`, а hashes совпадают с реальными файлами.

Вместо ручной сборки JSON выполните stage:

    node --experimental-strip-types scripts/neuro_plastic_registry.mjs stage --input adapter-store/kurisu-reasoning-v1/neuro-plastic-registry-manifest.json

Команда повторно хеширует файлы и проверяет metadata перед созданием записи `staged`. Она не оценивает candidate и не активирует его. Следом передайте подписанные независимым evaluator результаты holdout по инструкции ниже.

## 4. Независимая оценка и подписание результата

Независимый evaluator получает неизменяемые baseline и candidate inputs и запускает один и тот же закрытый holdout protocol на одинаковых парах/seed. В training corpus holdout не попадает. Каждая observation содержит pairId, seed, split="holdout", authority="independent-verifier", verifierId, holdoutFingerprint и metrics: quality01, safety01, retention01, cost01, latencyMs, safetyViolationCount.

В корневом JSON evaluation находятся manifestFingerprint, holdoutFingerprint, evaluatedAt, baseline[], candidate[] и подписанный receipt. Receipt связывает evaluator identity, timestamp, SHA-256 точного нормализованного содержимого обеих paired arms и отдельный fingerprint вычисленного решения (paired count, seeds, quality uplift/CI, safety, retention, cost, latency, violations и eligibility). Подпись — Ed25519: evaluator подписывает приватным ключом, а NK1 runtime и CLI проверяют её публичным ключом. При restore registry заново сверяет report summary с подписанным fingerprint; пересчёт обычного SHA отчёта не позволяет подменить числа.

Создайте отдельную пару ключей evaluator вне trainer/runtime host:

    openssl genpkey -algorithm ED25519 -out evaluator-private.pem
    openssl pkey -in evaluator-private.pem -pubout -out evaluator-public.pem
    chmod 600 evaluator-private.pem

Приватный ключ должен оставаться только у независимого evaluator/scorer и никогда не попадать в NK1 runtime, CLI host, trainer или Git. Для подписания evaluator вызывает экспортированный helper `createNeuroPlasticEvaluationReceipt(..., evaluatorPrivateKeyPem)`. NK1 получает только public PEM и не может самостоятельно выпускать валидные evaluation receipts. Операторское разрешение также использует Ed25519, но отдельный ключ и отдельный trust map; evaluator и operator не должны разделять приватный ключ.

CLI:

    export NEURO_PLASTIC_EVALUATOR_PUBLIC_KEY="$(cat /secure/path/evaluator-public.pem)"
    export NEURO_PLASTIC_REGISTRY_FILE="state/neuro-plastic-adapters.json"

    node --experimental-strip-types scripts/neuro_plastic_registry.mjs stage --input adapter-manifest.json
    node --experimental-strip-types scripts/neuro_plastic_registry.mjs evaluate --adapter kurisu-reasoning-v1 --input holdout-evaluation.json

Promotion gate требует не менее 5 matched pairs и 5 независимых seeds; проверяет положительную нижнюю границу 95% CI качества и минимум +0.01 среднего uplift, safety delta не хуже -0.005, абсолютный mean safety не ниже 0.98 и ни одного holdout safety ниже 0.95, retention delta не хуже -0.02, абсолютный mean retention не ниже 0.95 и ни одного holdout retention ниже 0.90, cost delta не выше +0.03, latency ratio не выше 1.15 и полное отсутствие safety violations. Для выборок больше 30 используется консервативная Student-t critical value band, а не автоматически 1.96. Пороговые значения намеренно консервативны и должны калиброваться на реальных задачах, а не смягчаться ради прохождения теста. Любая missing/duplicate pair, неверный holdout fingerprint или неподписанный receipt отклоняется.

## 5. Подписать ручное разрешение, активировать или откатить

Оценка переводит адаптер максимум в eligible; она никогда не активирует его автоматически.

    # Публичные ключи: JSON object { "operator-key-2026": "<Ed25519 public PEM>" }
    export NEURO_PLASTIC_APPROVAL_PUBLIC_KEYS_JSON="$(cat /secure/path/neuro-plastic-approval-public-keys.json)"
    export NEURO_PLASTIC_APPROVER_ID="operator-id"
    export NEURO_PLASTIC_APPROVER_KEY_ID="operator-key-2026"

    node --experimental-strip-types scripts/neuro_plastic_registry.mjs approve --adapter kurisu-reasoning-v1 --output state/kurisu-reasoning-v1.approval-request.json

Команда approve создаёт только unsigned request с canonical payload, точным adapter/report/base-model/manifest binding, signerKeyId и timestamp. Для локальной изолированной подписи можно использовать отдельный offline signer (сам NK1 runtime и registry CLI приватный ключ не читают):

    chmod 600 /secure/path/operator-private.pem
    node --experimental-strip-types scripts/neuro_plastic_sign_approval.mjs \\
      --input state/kurisu-reasoning-v1.approval-request.json \\
      --key-id operator-key-2026 \\
      --key-file /secure/path/operator-private.pem \\
      --output state/kurisu-reasoning-v1.approval-signed.json

Signer проверяет canonical payload и key ID, требует Ed25519 private key в regular file с owner-only permissions, отклоняет symlink и перезапись существующего output и создаёт подписанный JSON с правами 0600. Приватный ключ должен находиться вне репозитория; для production предпочтителен KMS/HSM или отдельный signer service. Либо передайте request в такой сервис: он подписывает поле canonicalPayload и добавляет base64 detached signature в approval.signature. Затем выполните:

    node --experimental-strip-types scripts/neuro_plastic_registry.mjs activate --adapter kurisu-reasoning-v1 --input state/kurisu-reasoning-v1.approval-signed.json

Подпись оператора связана с adapter ID, evaluation report ID, base-model fingerprint, fingerprint полного нормализованного adapter manifest (артефакт, tokenizer, source dataset, holdout plan, domain, method, served alias и governance), actor ID, signer key ID и timestamp. Для новой активации подпись должна быть не старше 15 минут; допустимый clock skew вперёд — 30 секунд. При восстановлении уже сохранённого ACTIVE состояния подпись проверяется криптографически, но не истекает по времени. Любое изменение manifest или signer identity после выдачи request требует новой подписи. NEURO_PLASTIC_APPROVAL_PUBLIC_KEYS_JSON содержит только доверенные Ed25519 public PEM keys, максимум 64 ключа; NEURO_PLASTIC_APPROVER_KEY_ID выбирает один ключ из этого набора. NK1 runtime и CLI не принимают operator private keys и не выпускают подписи. При restore сервер и CLI отдельно перепроверяют evaluator receipt, operator approval и artifact hashes; отсутствие или неверность любого доказательства переводит adapter в неактивное состояние (fail closed).

P25 host policy использует независимый trust set и не наследует права operator approval:

    export NEURO_PLASTIC_P25_POLICY_PUBLIC_KEYS_JSON="$(cat /secure/path/neuro-plastic-p25-policy-public-keys.json)"
    export NEURO_PLASTIC_P25_POLICY_KEY_ID="p25-policy-key-2026"

Включение NEURO_PLASTIC_MODEL_ALIASES_ENABLED=1 допускается только при наличии соответствующего NEURO_PLASTIC_P25_POLICY_KEY_ID в policy public-key map, настроенного llama.cpp endpoint и точного base-model fingerprint. P25 manifest подписывается внешним Ed25519 policy signer; runtime проверяет detached base64 signature и signer ID. Отсутствие ключа или неверная подпись отключает P25 executor, не ослабляя базовый inference path.

Откат:

    node --experimental-strip-types scripts/neuro_plastic_registry.mjs rollback --adapter kurisu-reasoning-v1 --reason "holdout or live regression"

Runtime fault автоматически отключает адаптер и пытается сохранить это состояние; затем исходный запрос повторяется на base model. Если base call тоже недоступен, исходная ошибка проходит наружу.

## 6. Подключить к локальному inference

Сервер использует уже выбранный P40 local backend; в LanguageOrgan adapter domain получается только из канонического action:

| Выбранное действие | Domain |
|---|---|
| respond | language |
| verify, reflect | reasoning |
| explore | exploration |
| rest, wait, defer | Нет адаптерного маршрута |

Confidence берётся из выбранного IntentCandidate. Risk рассчитывается как максимум uncertainty, self-prediction error и 0.65 × cognitive load. Реестр применяет дополнительные пределы: confidence не ниже 0.72 и risk не выше 0.35.

Перед запуском локального сервера загрузите adapter alias в совместимый llama.cpp endpoint. Registry не изменяет конфигурацию llama-server и не подменяет base model самостоятельно: endpoint должен уметь разрешать переданный model alias в заранее загруженный adapter. Затем выставьте:

    NEURO_PLASTIC_REGISTRY_FILE="/absolute/runtime/path/state/neuro-plastic-adapters.json"
    NEURO_PLASTIC_APPROVAL_PUBLIC_KEYS_JSON="<trusted-operator-public-key-map>"
    NEURO_PLASTIC_BASE_MODEL_SHA256="<exact-base-model-fingerprint>"
    NEURO_PLASTIC_MODEL_ALIASES_ENABLED=1

NEURO_PLASTIC_MODEL_ALIASES_ENABLED оставляйте выключенным, пока backend действительно не preload-ит alias. Если alias неизвестен, adapter вызов отключается при runtime fault и запрос уходит на исходную модель. При mismatch base-model fingerprint, отсутствии подписанного активного adapter, backend cooldown, низкой confidence или высоком risk используется base model без изменения веса.

## Ограничения и эксплуатационные правила

- CI проверяет contracts, CLI lifecycle, Python preflight и server syntax; он не запускает дорогое обучение 7B и не подтверждает реальный GPU/QLoRA throughput.
- До обучения нужна человеческая проверка consent, provenance, privacy и лицензий. PII regex — только дополнительный фильтр, не DLP-сертификат.
- Holdout secret/data и evaluator private key должны находиться вне trainer/runtime host; runtime получает только Ed25519 public key. Operator approval и P25 policy private keys храните только в отдельных signer/KMS/HSM; runtime получает только раздельные public-key maps.
- Не коммитьте модельные веса, JSONL corpus, holdout rows, approval secrets, evaluator private keys или state registry. Adapter artifacts и state — локальные runtime данные.
- Не обновляйте base fingerprint после обучения «для удобства»: mismatch означает, что adapter не относится к текущей base model.
- Не считайте eligible доказательством production readiness. Нужны независимый review, реальные unseen tasks, retention/forgetting checks, latency/cost measurements и длительный runtime soak.
- В текущей интеграции нет автоматического обучения при каждом разговоре. Только offline candidate build → независимая оценка → human approval → controlled inference.
