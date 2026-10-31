# NK1 × Inspect AI — независимая оценка доказательств

## Что подключено

Этот пакет подключает загруженный и проверенный `inspect-ai==0.3.286` как **внешний оценочный контур**, а не как ещё один мозг NK1. Inspect AI не пишет в память, не меняет цели, не обучает P23, не продвигает skills и не получает полномочий на запуск инструментов.

Рабочий поток:

1. NK1 отдаёт read-only snapshot через `GET /api/organism/evaluation/evidence`.
2. Snapshot содержит только хэши ID/parent ID, tick, 11 когнитивных стадий, связи, confidence в basis points и агрегаты `RealityEvidenceLedger`.
3. Сырые `payload`, пользовательские фразы, `claim`, названия источников и `independenceKey` отбрасываются до экспорта.
4. `nk1_evidence.py` проверяет SHA-256 bundle digest и атомарно строит JSONL samples для Inspect AI.
5. Inspect AI независимо пересчитывает наличие 11 стадий и все 20 обязательных причинных рёбер. Отдельный scorer проверяет, что simulator evidence не смешано с external/device/user-reported evidence.
6. Результат — отчёт оценки. Он **не является** разрешением на P23 promotion и не изменяет NK1.

Digest — контроль целостности, а не цифровая подпись или доказательство авторства источника. Окно ограничено 256 событиями CEF и последними 96 записями RealityEvidenceLedger; старые события не представлены в отчёте.

## Получить evidence bundle

Запусти NK1 и скачай агрегированный snapshot на том же доверенном устройстве/локальном узле:

```bash
curl --fail --silent --show-error \
  ${NEURO_API_TOKEN:+-H "Authorization: Bearer ${NEURO_API_TOKEN}"} \
  http://127.0.0.1:3000/api/organism/evaluation/evidence \
  -o evaluation/inspect_ai/evidence.json
```

Порт — фактическое значение `PORT` твоего NK1 сервера. Для loopback по умолчанию токен не требуется; при `NEURO_API_TOKEN` передай его через Bearer header. Endpoint read-only и не принимает пользовательские команды или данные.

## Установка и запуск Inspect AI

Из корня репозитория:

```bash
python -m venv .venv-inspect
. .venv-inspect/bin/activate
python -m pip install -r evaluation/inspect_ai/requirements.txt
python evaluation/inspect_ai/nk1_evidence.py evaluation/inspect_ai/evidence.json \
  --output evaluation/inspect_ai/samples.jsonl
inspect eval evaluation/inspect_ai/nk1_inspect_task.py --model mockllm/model
```

В Windows активируй виртуальное окружение командой `.venv-inspect\\Scripts\\activate`.

Inspect task намеренно не вызывает LLM: solver передаёт входной sample напрямую, а scorer выполняет детерминированную независимую проверку. Это исключает стоимость модели и случайные оценки.

## Локальные регрессии без установки Inspect AI

```bash
python -m unittest discover -s evaluation/inspect_ai/tests -v
node --experimental-strip-types runtime/neuro-kurisu/tests/workpass72-independent-evaluation-export.mjs
```

## Что эта интеграция доказывает — и чего не доказывает

- Доказывает форматированный обмен ограниченными evidence snapshots и независимую проверку структурной полноты причинной цепочки.
- Проверяет бухгалтерское разделение evidence-классов, а не истинность внешнего наблюдения.
- Не измеряет качество памяти, recall uplift, полезность целей, сознание или автономность.
- Не является независимым holdout для качества модели: для этого нужен отдельно созданный immutable dataset, не использованный обучением/настройкой.
- Не даёт Inspect AI права оценивать или одобрять собственное обучение NK1.

## Multi-tick sequence integrity (WorkPass73)

The v2 export adds a deterministic SHA-256 chain over ordered tick projections. Each
cycle contains its sequence index, previous chain digest, canonical cycle digest and
chain digest; the timeline manifest records the first/last tick and chain head.
The independent Python validator checks strictly increasing unique ticks, canonical
cycle identity, globally unique event IDs, parent references that do not point to
known future events, event-window counters and the final chain head. Inspect AI
receives a dedicated timeline sample in addition to per-cycle and reality-ledger
samples.

The chain detects accidental or post-export changes when compared with a retained
bundle digest. It is **not a digital signature**, does not authenticate the host,
and cannot prevent a party with authority to rewrite the source bundle from
recomputing all hashes. For source authenticity, retain the digest outside the NK1
host or add a separately governed signing/anchoring mechanism.
