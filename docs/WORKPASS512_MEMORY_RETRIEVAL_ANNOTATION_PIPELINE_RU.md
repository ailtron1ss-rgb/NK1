# WorkPass512 — воспроизводимая разметка retrieval holdout

## Зачем нужен этот процесс

Текущие RU/EN фикстуры памяти NK1 синтетические: они проверяют корректность метрик, хеширования и запретов на promotion. Они **не являются независимым доказательством положительного retrieval uplift или recallDelta**. Для такого вывода нужны замороженный корпус, запросы, человеческая разметка релевантных MemoryOS2 ID и отдельный holdout.

Pipeline готовит пакет для разметки и проверяет целостность результата. Он не генерирует запросы и ground truth за человека, не меняет живую память и не продвигает алгоритм.

## 1. Подготовить вход

Экспортируй неизменяемый MemoryOSState2.json. Запросы подготовь отдельно в queries.jsonl, одна JSON-строка на запрос:

```json
{"id":"en-train-001","query":"Which memory records the earlier decision?","split":"train","language":"en"}
{"id":"ru-holdout-001","query":"Какое воспоминание фиксирует прежнее решение?","split":"holdout","language":"ru"}
```

Допустимые поля: уникальный id, текст query, split (train или holdout), явная language-метка (en, ru или other). Исходный файл не должен содержать answerable и relevantIds: эти значения заполняются отдельным этапом. Точные дубликаты и near-duplicates между train/holdout блокируются.

Подготовить локальный пакет:

```bash
node --experimental-strip-types runtime/neuro-kurisu/scripts/memory-retrieval-annotation-pack.mjs prepare \
  --snapshot /private/path/MemoryOSState2.json \
  --queries /private/path/queries.jsonl \
  --outdir /private/path/nk1-annotation-pack
```

Пакет включает manifest.json, corpus-catalog.jsonl, annotation-queue.jsonl и русские инструкции. Каталог по умолчанию содержит ID, статус памяти и хеш текста, но не текст. Флаг --include-content добавляет содержимое памяти, чтобы разметчик мог проверять релевантность. Используй его только при осознанной работе с приватными данными. Снапшоты, пакеты, тексты памяти и аннотации не добавлять в Git.

## 2. Заполнить человеческую разметку

Скопируй annotation-queue.jsonl в отдельный annotations.jsonl, не изменяя id, query, split или language. Для каждой строки задай:

- answerable: true и один или несколько точных relevantIds из corpus-catalog.jsonl; либо
- answerable: false и пустой массив relevantIds;
- annotatorId, reviewedAt с ISO-8601 timestamp и timezone; при необходимости notes.

Размечай относительно всего замороженного корпуса, а не результатов только одного алгоритма. Не используй ответы кандидата как ground truth. Неоднозначность фиксируй в notes или разрешай до теста.

## 3. Зафиксировать происхождение

Создай source-provenance.json с фактическими сведениями об источнике:

```json
{
  "datasetId": "nk1-memory-retrieval-en-ru",
  "datasetVersion": "2026-10-27-v1",
  "sourceRef": "exact source URI, archive hash, or internal artifact reference",
  "labelingProtocol": "Describe who labelled relevance and the rule used.",
  "licenseId": "Exact SPDX identifier or justified LicenseRef"
}
```

Не угадывай лицензию: используй реальный SPDX ID или обоснованный LicenseRef. Для пользовательской памяти применяй приватный sourceRef с соблюдением согласия и приватности.

Финализация:

```bash
node --experimental-strip-types runtime/neuro-kurisu/scripts/memory-retrieval-annotation-pack.mjs finalize \
  --pack /private/path/nk1-annotation-pack \
  --annotations /private/path/annotations.jsonl \
  --provenance /private/path/source-provenance.json \
  --outdir /private/path/nk1-validated-dataset
```

Проверки отклонят неизвестные memory ID, изменённые/дублированные запросы, неполные метки, отсутствующую лицензию или несовпадение хешей. Минимум для каждого языка en и ru: 2 train, 8 answerable holdout и 2 unanswerable holdout.

## 4. Запустить offline benchmark

Используй тот же снапшот, что зафиксирован в пакете. Выходной путь должен быть новым: CLI не перезаписывает существующие результаты.

```bash
npm --prefix runtime/neuro-kurisu run run:memory-retrieval-experiment -- \
  --snapshot /private/path/MemoryOSState2.json \
  --labels /private/path/nk1-validated-dataset/labels.jsonl \
  --provenance /private/path/nk1-validated-dataset/dataset-provenance.json \
  --out /private/path/nk1-retrieval-report.json \
  --seeds 11,29,47
```

В отчёте проверь datasetFingerprint, corpusFingerprint, раздельные RU/EN метрики, recallDelta, MRR, интервалы неопределённости, unsupported retrieval/abstention и все promotion gates. Финализация подтверждает только целостность входа, а не качество разметки, inter-annotator agreement или реальный рост качества. Для вывода об улучшении нужны независимая разметка и успешно пройденные gates. Этот проход не меняет main или Release ZIP.
