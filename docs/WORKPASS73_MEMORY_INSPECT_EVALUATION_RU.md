# WorkPass73 — независимая оценка памяти NK1 через Inspect AI

## Цель прохода

Подключить внешний проверяющий контур к реальному существующему эксперименту MemoryOS2. WorkPass73 не заменяет MemoryOS2 retrieval и не создаёт второй benchmark. Единственный механизм A/B retrieval по-прежнему находится в:

- runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts
- runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts

Inspect AI получает лишь экспортированный результат эксперимента и независимо пересчитывает метрики по парам baseline/candidate.

## Поток данных

1. Локальный оператор предоставляет MemoryOS2 snapshot, JSONL с независимыми RU/EN метками и provenance-файл.
2. Существующий runner создаёт изолированную копию snapshot и запускает BM25 baseline и MemoryOS2 candidate на одинаковом bounded corpus.
3. При opt-in флаге --inspect-evidence true benchmark сохраняет per-query traces для train и holdout.
4. В queryEvidence попадают HMAC-SHA256 псевдонимы example ID, нормализованного query и memory ID, split/language/answerability, релевантные псевдонимы, baseline/candidate top-K ranks и bounded safety flags.
5. Один случайный HMAC-ключ общий между повторениями paired bootstrap seeds, но не записывается в report.
6. Python adapter превращает report в один Inspect sample. Inspect scorer заново вычисляет Recall@K, MRR, unsupported retrieval, paired bootstrap intervals, bilingual gates, train/holdout leakage и integrity кандидата.
7. Отчёт Inspect не имеет API для записи в MemoryOS2 или продвижения P23-кандидата.

## Запуск на реальном независимом наборе

Минимальные требования WorkPass73 при включённом Inspect export: 4 уникальных train queries на каждый язык, 20 answerable holdout queries и 8 unanswerable holdout queries на каждый язык. В сумме — минимум 40 answerable и 16 unanswerable holdout примеров.

    node --experimental-strip-types runtime/neuro-kurisu/scripts/run-memory-retrieval-experiment.mjs \
      --snapshot /path/to/memoryos2-snapshot.json \
      --labels /path/to/independently-labelled-ru-en-holdout.jsonl \
      --provenance /path/to/dataset-provenance.json \
      --out evaluation/inspect_ai/memory-report.json \
      --seeds 13,29,53,71,101 \
      --inspect-evidence true

    python evaluation/inspect_ai/nk1_memory_evidence.py \
      evaluation/inspect_ai/memory-report.json \
      --output evaluation/inspect_ai/memory-samples.jsonl

    NK1_MEMORY_INSPECT_SAMPLES=evaluation/inspect_ai/memory-samples.jsonl \
      inspect eval evaluation/inspect_ai/nk1_memory_inspect_task.py --model mockllm/model

Provenance должен содержать datasetId, datasetVersion, sourceRef, labelingProtocol, licenseId и contentSha256. Fingerprint должен точно соответствовать используемому размеченному набору. Внешняя аннотация, лицензия и независимость источника требуют проверки человеком/владельцем датасета: непустые поля сами по себе не доказывают их истинность.

## Что проверяется заново

- Recall@K и MRR вычисляются по хэшированным релевантным memory IDs и порядку результатов каждой пары.
- Unsupported retrieval вычисляется на явно unanswerable holdout queries; candidate не должен повышать unsupported rate.
- Paired bootstrap повторяется отдельно для RU, EN и общей выборки, с тем же числом seeds и фиксированным алгоритмом xorshift32.
- Проверяется, что HMAC query digests не повторяются между train и holdout; проверяются duplicate labels, duplicate IDs, отсутствующие/чужие memory digests и malformed ranks.
- Проверяются флаги quarantined/stale/future/dormant/invalidEpistemicStatus для candidate results.
- Условия и thresholds пересчитываются заново, а не копируются из promotion verdict самого benchmark.

## Защита и границы

Сырые запросы, тексты памяти, исходные memory IDs и example IDs не сериализуются в queryEvidence. HMAC key — случайный и ephemeral, общий между seeds одного запуска, но не сохраняемый в отчёте. Это не гарантирует абсолютную анонимность: метаданные, fingerprints и известная структура конкретного набора могут позволять корреляцию. Перед передачей sample внешней инфраструктуре Inspect следует оценить правила хранения eval-логов.

SHA/fingerprint — контроль целостности, не цифровая подпись источника. Независимый scorer проверяет внутреннюю непротиворечивость label/provenance полей, но не подтверждает, что аннотации действительно сделаны независимыми людьми или что датасет лицензирован для этой цели.

Inspect получает только право оценивать sample. Он не загружает model weights, не выполняет retrieval и не вызывает действия NK1. Scorer возвращает VALID для корректной структуры; отдельное поле promotionEligible может остаться false. Никакого автоматического promotion нет.

## CI

CI использует синтетический MemoryOS2 clone-path fixture для проверки end-to-end сериализации и Inspect task. Его sourceRef помечен synthetic://, поэтому scorer может подтвердить структурную валидность, но обязательно отказывает в классификации как внешнего независимого evidence. CI PASS не является доказательством recall uplift.

## Что осталось до настоящего recall uplift

1. Получить внешний, лицензированный RU/EN dataset и независимые relevance labels.
2. Зафиксировать dataset/corpus/config fingerprints и протокол annotation до прогона.
3. Запустить 5+ paired bootstrap seeds на реальном snapshot clone, сохранив неизменённый holdout.
4. Сопоставить NK1 с BM25 baseline и проверить RU/EN отдельно.
5. Провести человеческую проверку provenance и результата до обсуждения любого promotion.

Пока внешний набор не предоставлен и эксперимент не выполнен, качество памяти и recall uplift остаются не измеренными. Этот pass подключает проверяемую инфраструктуру эксперимента, но не утверждает, что память уже стала лучше.
