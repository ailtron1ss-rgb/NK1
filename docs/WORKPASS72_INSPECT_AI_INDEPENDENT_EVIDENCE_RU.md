# WorkPass72 — Inspect AI как независимый оценочный контур NK1

**Статус:** кодовая интеграция находится в отдельной ветке. Hosted CI должен подтвердить точный PR SHA перед слиянием. Это не завершённая независимая оценка качества памяти.

## Архитектурное решение

Из загруженного архива inspect_ai-0.3.286.zip используется Python-пакет Inspect AI как изолированный evaluation harness. Он не запускается внутри runtime NK1 и не получает доступ к хранилищам, ActionGateway, MemoryOS2, Letta, mem0, P23 или кандидатам навыков.

В NK1 добавлена только read-only проекция уже существующих владельцев данных:

- CognitiveEventFabric — события, стадии и parent links;
- RealityEvidenceLedger — классы доказательств и ключи независимости;
- UnifiedCognitiveCycle — накопительные счётчики для контекста.

IndependentEvaluationEvidence.ts строит ограниченную privacy-minimal проекцию. Идентификаторы и parent ID хешируются SHA-256; свободный текст, payload, source name, claim и independenceKey не сериализуются. Экспорт ограничен 256 событиями CEF и 96 последними reality records. Включён digest для проверки модификации после экспорта; digest не подписан и не устанавливает подлинность источника.

## Независимая проверка

Python scorer заново проверяет 11 стадий и 20 причинных рёбер, включая обязательные связи от observation до self-update. Дубликаты стадий/ID, некорректные tick, пропуски и отсутствующие связи дают FAIL. Отдельная проверка контролирует арифметическую непротиворечивость учёта внешних и симуляционных источников.

Inspect task работает без внешней LLM: solver передаёт входной sample напрямую, scoring выполняется локально. mockllm/model передаётся Inspect как формальный backend для выполнения task; generate() не вызывается. Результаты предназначены для отчёта, а не для автоматического promotion.

## Получение и оценка

Сервер слушает 127.0.0.1:3000 по умолчанию; если задан PORT, используй его значение. Endpoint только GET и возвращает агрегированную проекцию. Для loopback без NEURO_API_TOKEN токен не требуется; если переменная задана, передай Bearer token.

    curl --fail --silent --show-error \
      -H "Authorization: Bearer $NEURO_API_TOKEN" \
      http://127.0.0.1:3000/api/organism/evaluation/evidence \
      -o evaluation/inspect_ai/evidence.json

Если NEURO_API_TOKEN не задан для loopback, строку с -H нужно опустить.

Установка и запуск из корня репозитория:

    python -m venv .venv-inspect
    . .venv-inspect/bin/activate
    python -m pip install -r evaluation/inspect_ai/requirements.txt
    python evaluation/inspect_ai/nk1_evidence.py evaluation/inspect_ai/evidence.json \
      --output evaluation/inspect_ai/samples.jsonl
    inspect eval evaluation/inspect_ai/nk1_inspect_task.py --model mockllm/model

В Windows активируй окружение командой .venv-inspect\Scripts\activate.

Локальные unit-тесты без установки Inspect AI:

    python -m unittest discover -s evaluation/inspect_ai/tests -v
    node --experimental-strip-types runtime/neuro-kurisu/tests/workpass72-independent-evaluation-export.mjs

## Границы доказательности

1. Bundle SHA-256 — checksum, а не цифровая подпись.
2. Bounded snapshot не является полной историей и может не содержать родительское событие для самой старой записи окна.
3. Source-class accounting проверяет разделение, заданное самим NK1, но не верифицирует физическую реальность камеры/телефона.
4. Цикл из 11 стадий — структурный критерий, не признак сознания.
5. Успешный Inspect score не даёт полномочий на изменение памяти, learner, skills или релиз.
6. Этот pass не измеряет recallDelta. Для этого нужен отдельный immutable memory-retrieval holdout, не использованный обучением/настройкой и подтверждённый независимым provenance.

Следующая отдельная работа — подключить этот же внешний evaluation контур к holdout памяти, сравнить NK1 retrieval с baseline на парных seed и проверить contamination до публикации recall uplift.

## WorkPass73 — целостность последовательности тиков

Схема экспортируемого пакета поднята до `nk1.independent-evaluation-evidence.v2`.
Каждый цикл содержит `sequenceIndex`, `previousChainDigest`, `cycleDigest` и
`chainDigest`. Манифест `timeline` хранит количество циклов, первый/последний tick
и digest головы цепочки. Независимый Python-проверяющий дополнительно проверяет:

- строго возрастающие и уникальные tick;
- ожидаемый digest идентификатора цикла;
- уникальность event ID во всём экспортированном окне;
- отсутствие известных ссылок parent → event из будущего;
- согласованность числа экспортированных событий и границ event window;
- непрерывность цепочки и совпадение финальной головы.

Inspect AI теперь получает самостоятельный sample `evidence-timeline`, помимо
проверок каждого отдельного цикла и reality ledger.

**Граница доверия:** цепочка помогает обнаружить перестановку/изменение данных при
сравнении с сохранённым digest, но не является цифровой подписью и не доказывает
авторство или независимость источника. Хост, который может переписать исходный
bundle, способен пересчитать и всю цепочку. Для доказательства происхождения
digest нужно сохранять вне NK1 либо отдельно внедрить управляемую подпись/внешнее
якорение.
