# WorkPass535 — production bootstrap доверенных оценщиков P36

**Дата:** 25 октября 2026 г.  
**Ветка:** feature/learning  
**PR:** [#79 → integration](https://github.com/ailtron1ss-rgb/NK1/pull/79)  
**Проверка:** production bootstrap, regression suite и workflow добавлены; точный HEAD не подтверждён выполнением CI/typecheck.

## Решение

Ранее Core уже принимал два доверенных host-config слота, но production server не передавал их при создании OrganismRuntime. Этот проход подключает opt-in bootstrap так, чтобы реальный deployment мог предоставить ключи и данные, не помещая private key или фиктивный оценщик в код NK1.

### Experiment evidence: подписанный ledger

Если задана переменная окружения NEURO_P36_SIGNED_LEDGER_CONFIG_FILE, server.mjs вызывает loadP36VerifiedOutcomeLedgerEvaluator() и передаёт возвращённый адаптер через OrganismRuntime в OrganismCore под зарезервированный ID organism.learning.p36.evaluate-evidence.

Config — JSON версии 1:

    {
      "version": 1,
      "manifestFile": "manifest.json",
      "trustedVerifierKeysFile": "trusted-verifier-keys.json",
      "artifactsDirectory": "signed-artifacts",
      "evaluatorVersion": "p36-signed-ledger-v1",
      "baselineMethod": "baseline-v1",
      "treatmentMethod": "candidate-v1",
      "taskFamily": "memory",
      "sourceId": "host-p36-signed-ledger",
      "independenceKey": "host-p36-verifier-keyring",
      "minimumPairedSeeds": 4
    }

Файлы называются относительно каталога config (или могут быть абсолютными host paths):
- manifest.json — массив точных TaskManifestEntry.
- trusted-verifier-keys.json — JSON-объект verifierId -> PEM public key; private keys запрещены.
- signed-artifacts/*.json — отдельные signed outcome artifacts с payload и signature.

Bootstrap повторно проверяет подпись каждого артефакта на каждом старте. Он отказывает при неизвестном verifier, ошибочной подписи, повторном/конфликтующем исходе, неверном manifest, private key в keyring, невалидных файлах, symlink, любых битах записи в trust-файлах/каталоге артефактов, небезопасных относительных путях или неполном парном holdout-покрытии. Production config/manifest/keyring/artifacts должны располагаться вне runtime-writable state; loader проверяет эту границу до регистрации evaluator. Он требует, чтобы pinned сравнение имело достаточно полных парных seed (не менее четырёх) до регистрации tool. Это не считывает VerifiedOutcomeLedger snapshot как доказательство и не восстанавливает авторитет из одного JSON.

### Developmental maturity: отдельный host module

Если задана NEURO_P36_MATURITY_EVALUATOR_MODULE, bootstrap загружает отдельный доверенный модуль, экспортирующий createP36DevelopmentalOutcomeEvaluator({stateDirectory}) или default factory. Модуль обязан вернуть неразрушительный tool с execute, verify и своим observationSource. Core дополнительно проверяет, что его canonical sourceId и independenceKey отличаются от experiment evaluator.

Это trusted executable host code; модуль не генерируется нейросетью, не берётся из MemoryOS и не должен лежать в runtime-writable каталоге. Без указанного модуля maturity lane не регистрируется — никакой fake delayed retention не подставляется.

### Ошибки конфигурации

Ни одна переменная не обязательна. Если переменная не задана, соответствующий evaluator не настраивается и маршрут остаётся недоступным. Если переменная задана, но config/ключи/подписи/coverage некорректны, server startup завершается fail-closed, а не тихо отключает проверку.

Для production deployment следует держать config, manifest, public keyring и подписанные артефакты в host-owned read-only/controlled paths; verifier private key остаётся только у внешнего подписывающего verifier. Смена manifest/method/family требует новой доверенной конфигурации и новых подписанных результатов.

## Регрессии

Добавлен runtime/neuro-kurisu/tests/p36-host-evaluator-bootstrap.mjs и npm run test:p36:host-bootstrap; .github/workflows/p26-learning-validation.yml запускает его и отслеживает изменения bootstrap/server/test-файлов. Тест формирует 32 signed fixture-артефакта по четырём holdout-задачам, двум методам и четырём seed, проверяет успешную загрузку, поддельную private-key запись в keyring, tampered signature и отдельную загрузку тестового maturity-модуля.

## Граница готовности

- Production server теперь действительно передаёт opt-in evaluators в OrganismRuntime/Core.
- Runtime repository не содержит production verifier private key, production signed outcome corpus или настоящий delayed-maturity provider; поэтому без host configuration никакой evaluator не включается.
- Exact-HEAD TypeScript/test CI пока не подтверждён запуском; этот отчёт не заявляет тестовый PASS.
- Signed ledger evaluator всё ещё подтверждает лишь моментальный holdout. Для полноценного саморазвития нужны отдельные независимо проверенные delayed-retention/transfer outcomes и дальнейшая проверка exact HEAD.

main и GitHub Release ZIP не изменялись. Новых runtime-зависимостей не добавлено.
