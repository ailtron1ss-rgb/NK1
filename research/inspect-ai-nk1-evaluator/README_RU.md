# NK1 × Inspect AI — независимая проверка когнитивных доказательств

**Статус:** первый изолированный интеграционный адаптер; не является частью активного runtime и не меняет память, обучение или принятие решений NK1.

## Что делает

Комплект использует официальный Inspect AI `0.3.286` как независимый контейнер для повторного подсчёта структурных доказательств NK1. Он оценивает:

1. Наличие всех 11 стадий одного когнитивного цикла.
2. Причинные связи между стадиями, а не только наличие имён стадий.
3. Отсутствие неоднозначных/повторных идентификаторов и несовпадений tick.
4. Связность action → outcome → evidence в `CognitiveEventFabric`.
5. Для заявленного внешнего postcondition — наличие отдельного external observation, совпадающих хешей ожидаемого/наблюдаемого результата и непустого `independenceKey`.
6. Корректность bounded receipt revisions и агрегированных счётчиков.

Inspect выполняет только локальные deterministic scorers. В задаче задано `model=None`, solver ничего не генерирует и не обращается к LLM. Inspect здесь — оценочная оболочка, не вторая когнитивная система и не authority для promotion навыков.

## Архитектура

```text
OrganismRuntime.cognitiveEventFabricSnapshot()
        │ read-only snapshot
        ▼
NK1InspectEvidenceExporter.ts
        │ allowlisted / privacy-reduced JSONL
        ▼
Inspect AI task (model=None)
        │ independent recomputation
        ▼
Inspect log + scalar metrics + issue metadata
```

Экспортёр берёт один tick (последний по умолчанию), восстанавливает отдельный `CognitiveEventFabric` и заново запускает `verifyOperationalCycle`. Исходный runtime, MemoryOS2, P23 и skill stores не мутируются.

Экспортёр не переносит текст диалога, тексты воспоминаний, сырые postcondition strings, prompts, модельные ответы или тела пользовательских сообщений. Для receipt остаются ограниченные идентификаторы, stage/parent links, source metadata и SHA-256 postcondition hashes. Несмотря на это, evidence JSONL следует хранить как внутренние диагностические данные: sample IDs, tool IDs и event IDs могут быть чувствительными метаданными.

## Файлы

- `runtime/neuro-kurisu/src/organism/integration/inspectAi/NK1InspectEvidenceExporter.ts` — privacy-reduced export и изолированный повторный расчёт EventFabric.
- `runtime/neuro-kurisu/scripts/export-nk1-inspect-evidence.mjs` — CLI export из snapshot JSON.
- `runtime/neuro-kurisu/tests/nk1-inspect-evidence-exporter.mjs` — Node regression tests.
- `research/inspect-ai-nk1-evaluator/nk1_evidence.py` — dependency-free Python validator / JSONL loader.
- `research/inspect-ai-nk1-evaluator/nk1_inspect_task.py` — Inspect dataset, no-op solver и независимые scorers.
- `research/inspect-ai-nk1-evaluator/run_eval.py` — запуск Inspect и привязка результата к SHA-256 evidence-файла.
- `research/inspect-ai-nk1-evaluator/tests/test_nk1_evidence.py` — stdlib unit tests.

## Использование

### 1. Получить snapshot

В host-коде, где уже имеется экземпляр `OrganismRuntime`, сохранить именно CEF snapshot (не весь organism snapshot):

```ts
import { writeFile } from 'node:fs/promises';

const cefSnapshot = runtime.cognitiveEventFabricSnapshot();
await writeFile(
  '/private/nk1-cognitive-event-fabric.json',
  JSON.stringify(cefSnapshot),
  { encoding: 'utf8', mode: 0o600, flag: 'wx' },
);
```

Снапшот может включать диагностические payloads; не загружать raw snapshot в сторонний сервис. Экспортёр должен работать локально.

### 2. Создать privacy-reduced evidence JSONL

Из корня репозитория:

```bash
node --experimental-strip-types runtime/neuro-kurisu/scripts/export-nk1-inspect-evidence.mjs \
  --snapshot /private/nk1-cognitive-event-fabric.json \
  --out /private/nk1-inspect-evidence.jsonl \
  --source-commit "$(git rev-parse HEAD)"
```

Опционально выбрать конкретный `--tick N`. Выходной файл создаётся с `wx` и не перезаписывает существующий артефакт. CLI печатает SHA-256 JSONL и фактический verdict.

### 3. Запустить независимые проверки

```bash
python -m unittest discover -s research/inspect-ai-nk1-evaluator/tests -v
node --experimental-strip-types --test runtime/neuro-kurisu/tests/nk1-inspect-evidence-exporter.mjs
```

Эти тесты не требуют Inspect AI.

### 4. Запустить Inspect AI 0.3.286

Из `research/inspect-ai-nk1-evaluator`:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
python run_eval.py --evidence /private/nk1-inspect-evidence.jsonl --log-dir /private/nk1-inspect-logs
```

Для Windows PowerShell активация окружения: `.venv\\Scripts\\Activate.ps1`.

Inspect AI — отдельная Python-зависимость; её не нужно добавлять в runtime/app dependencies NK1. Не загружать модельные веса или сторонний provider: этот task не нуждается в них.

## Интерпретация

Inspect создаёт отдельные показатели:

- `nk1_full_cycle_score` — доля записей с полным проверенным 11-стадийным циклом;
- `nk1_receipt_integrity_score` — целостность action receipt и его parent links;
- `nk1_external_postcondition_score` — корректность external postcondition claims;
- `nk1_export_validity_score` — полный structural audit без ошибок.

`receipt_integrity=1` при пустом массиве receipt означает только отсутствие повреждённых receipt в данном sample. `evidence_presence=0` отдельно указывает, что наблюдаемого action receipt нет. Аналогично, `external_postcondition_integrity=1` при нуле claims является vacuous pass, а не доказательством наличия внешнего подтверждения.

Один sample — это один tick, не вся история жизни. CEF snapshot ограничен окном последних событий и специальным receipt archive; при `recentWindowAtCapacity=true` это нельзя трактовать как полный аудит всех исторических циклов. Для длительных экспериментов создавай отдельные JSONL samples в момент каждого наблюдаемого окна и сохраняй immutable manifest с source commit, export timestamp и SHA-256.

**PASS не означает:** субъективное сознание, общую интеллектуальность, улучшение recall, причинное обучение, реальное автономное поведение или production readiness. Для этого нужны отдельные независимые task suites, holdout, реальные устройства, paired-seed сравнительные испытания и soak tests.

## Безопасность и границы

- Экспорт read-only, не открывает network и не записывает в NK1.
- Исходный raw snapshot остаётся локальным; в Inspect передаётся только allowlisted record.
- Evidence JSONL не является подписанным утверждением и не выдаёт разрешение на skill promotion.
- `WeakMap`-attestation `OutcomeVerificationService` не восстанавливается из JSON. Этот адаптер оценивает только структурно доступные CEF projection records и не притворяется повторной криптографической верификацией подписи провайдера.
- Не подключать эту задачу к P23 promotion gate в данном проходе.

## Upstream

- Inspect AI: https://github.com/UKGovernmentBEIS/inspect_ai
- Документация: https://inspect.aisi.org.uk/
- В NK1 supplied archive: `inspect_ai-0.3.286.zip`, pinned upstream commit `5dcbc98f86b6fd3d4a045b6ad001c6be41a10646`, archive SHA-256 `022feef01ee5a978a496cf0b1b56609e6400d7869fd7e0074d194bf3b1d57e0a`.
- MIT LICENSE присутствует в supplied upstream archive. Это provenance evidence, а не approval проекта на redistribuion; release-license human review остаётся отдельным обязательным gate.
