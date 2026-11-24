# NeuroForge — отчёт прогона по коллекции внешних проектов

Дата: 17 ноября 2026 г.
Репозиторий: ailtron1ss-rgb/NK1
Ветка внедрения: aspect/neuroforge-donor-capability-engine-20261116
Статус: статический анализ завершён; автоматический перенос и promotion запрещены.

## Охват

В доступной библиотеке найдены два контейнера: one.7z и two.7z. В них обнаружены 10 вложенных ZIP-проектов: Agent0, AutoGPT, Agent Framework, AutoGen, Chroma, DSPy, FAISS, Hermes Agent, Hyperon Experimental и Langroid.

Архивы three.7z и four.7z, упоминавшиеся в прежнем реестре, в текущей библиотеке недоступны. Этот прогон не охватывает их.

## Статистика финального прогона v16

- 10 доноров.
- 40 463 учтённых файла: 16 584 исходных, 12 730 тестовых, 3 688 документации, 1 858 конфигураций, 1 637 ресурсов.
- 504 133 282 байта просканированного содержимого; 39 пропущенных записей.
- 49 предложений: 3 candidate-gap, 30 reinforcement-candidate, 16 overlap.
- 0 из 10 доноров имеют закреплённый upstream Git commit внутри ZIP.
- Время: 14,64 секунды; пиковая память: 410 148 KiB.
- Поведенческие тесты проверенной локальной копии: 20/20 passed.
- Ничего не скопировано, донорские программы и зависимости не запускались и не устанавливались.

По сравнению с первым широким прогоном (около 946 916 KiB RSS и 23,63 секунды) финальный проход снизил измеренный пик памяти примерно на 56,7%, а runtime — примерно на 38%. Это ориентировочное сравнение: среда и системная нагрузка влияют на показатели.

## Кандидаты, требующие следующего отдельного исследования

### Agent0 — model-serving, приоритет 71/100

Исходники подтверждают vLLM/SGLang serving и rollout-интеграцию. Это серверная multi-GPU архитектура, не готовая реализация для Android или локального мобильного inference. Возможная ценность для NK1 — lifecycle отдельного serving provider и маршрутизация внешнего inference. Корневая лицензия распознана как Apache-2.0, но upstream commit из ZIP не закреплён.

### Hermes Agent — reproducible-builds, приоритет 60/100

Выявлены lockfile diff tooling, Nix tests и build configuration. Возможная ценность — проверка lockfile и provenance сборки NK1 Release. Это преимущественно CI/engineering-инструментарий, не runtime-когнитивная функция. Корневая лицензия распознана как MIT; upstream commit не закреплён.

### Hermes Agent — coding-agents, приоритет 57/100

Выделяются agent/coding_context.py и mini_swe_runner.py: сбор Git/workspace/lockfile-контекста и отдельный Mini-SWE task runner. Для NK1 это может стать основанием собственного адаптера repository context → controlled patch proposal → tests → review поверх AutonomousProjectExecutor и ActionGateway. Не следует импортировать runner или запускать чужие инструменты напрямую.

В Hermes найден credential-like путь plugin-catalog/pass-secrets.yaml. Содержимое не читалось и не публиковалось. Все предложения Hermes заблокированы до security review.

Приоритеты — эвристическая сортировка, не вероятность успеха и не доказательство превосходства над NK1.

## Что уже есть в NK1 и ограничения baseline

Для сравнения использована предварительная path-only карта из 102 выбранных путей (99 исходных путей) рабочей ветки workpass70-source, commit 1e83a011fc677ff20f2348570322bd562181d9ff. Содержимое baseline-файлов не загружалось и не анализировалось; Release ZIP не сверялся.

В выбранных путях уже видны ActionGateway, ExternalProjectResearchTool, LocalEmbeddingProvider, voice/native speech, FutureSimulator, NeuroSymbolicConceptCompiler, SubsystemFlightRecorder и NeuralCausalTraceLedger. Поэтому совпадающие донорские механизмы чаще классифицированы как reinforcement или overlap.

Три candidate-gap остаются предварительными. Для их подтверждения необходим одинаковый полный scan чистого workpass70-source и опубликованного Release ZIP.

## Лицензии и безопасность

Корневые license-сигналы распознаны у всех 10 доноров: Agent0 Apache-2.0, AutoGPT MIT, Agent Framework MIT, AutoGen CC-BY-4.0, Chroma Apache-2.0, DSPy MIT, FAISS MIT, Hermes Agent MIT, Hyperon Experimental MIT, Langroid MIT. License detection — только свидетельство, не правовое разрешение. AutoGen CC-BY-4.0 требует отдельной юридической оценки перед использованием кода.

Upstream commit отсутствует у всех 10 ZIP-проектов. SHA-256 архивов и локальных snapshot не заменяют upstream revision.

Все proposals имеют copyAllowed=false и promotionStatus=blocked. Для любого дальнейшего promotion необходимы human legal review, dependency/security review, isolated reproduction, behavioral benchmark, independent holdout, exact-head CI и release parity.

## Изменения NeuroForge по итогам испытания

- Разделены model-serving и model-provider-adapters: клиент Ollama/OpenAI-compatible не считается inference server.
- Сигналы получили evidence level: implementation, content-only, example-or-test, configuration-only. Только path-anchored implementation evidence может создавать proposal.
- Убрано влияние docs/specs, test bodies и общих CI-конфигураций на доказательства runtime-возможностей.
- Улучшены camelCase/path rules и распознавание существующих NK1-модулей.
- Добавлено распознавание Apache 2.0, CC-BY-4.0 и связанных license signals.
- Секрет-детектор стал консервативнее; env templates, generic token identifiers и runtime getters не трактуются как hard-coded credentials. Значения секретов не выводятся.
- Тела тестов не удерживаются в памяти; сохраняются file hashes и path-only evidence.
- Версия манифеста и аналитического отчёта поднята до schema v2.

Рекомендация: не переносить внешний код напрямую. Следующий эксперимент — получить чистый upstream snapshot Hermes без credential-like материалов и точный commit, затем исследовать собственный малый NK1 prototype coding-context в отдельной aspect-ветке. Agent0 serving и Hermes build tooling рассматривать как архитектурные/CI-референсы, пока независимые тесты не докажут пользу.
