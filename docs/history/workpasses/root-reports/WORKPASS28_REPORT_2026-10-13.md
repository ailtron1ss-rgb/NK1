# WorkPass 28 — исправление числового поиска в MemoryOS2

**Дата:** 13 октября 2026 г.  
**База:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS27_2026-10-13.zip`  
**Root:** `28.0.0-super-final14` · **Runtime:** `35.51.0` · **Schema:** `224`  
**Статус:** implementation-workpass; не release-ready.

## Что изменено в коде

1. **Однозначные числа становятся поисковыми токенами.** Ранее regex `[\p{L}\p{N}]{2,}` отбрасывал `0`, `1`, `2`, `3` и другие одиночные цифры. Из-за этого статусы/измерения разных воспоминаний становились неразличимыми, даже когда число — ключевой атрибут. Теперь сохраняются Unicode-блоки букв/цифр длиной не менее 2 и отдельные одиночные цифры; одиночные буквы всё ещё игнорируются.
2. **Один контракт для runtime и оценки.** Canonical MemoryOS2 индексирует цифры, `vectorize` получает тот же token stream, а BM25 benchmark использует ту же tokenizer policy.
3. **Fingerprint привязан к версии retrieval-алгоритма.** В report теперь есть `retrievalAlgorithmVersion`, а retrieval configuration fingerprint учитывает и algorithm/tokenizer version. Эксперименты не должны считать новую токенизацию той же конфигурацией, что предыдущую.
4. **Усилена регрессия по сроку действия.** Numeric match не обходит temporal filter: истёкшее воспоминание не возвращается в режиме Current.

## Результаты, проверенные в этой среде

- `typecheck` — PASS.
- `memory-retrieval-numeric-terms` — PASS: точное первое место для английского статуса `3` и русского измерения `4`; expired item исключён.
- `memory-retrieval-candidate-coverage` — PASS: порядок snapshot не меняет top-k и кандидат за старым posting cutoff остаётся доступным.
- `big-pass-126-memory-retrieval-benchmark` — PASS: candidate Recall@5 `1.00`, BM25 Recall@5 `1.00`, delta `0.00`, CI `[0.00, 0.00]`; `not-promoted`.
- `memory-retrieval-experiment` — PASS: deterministic multi-seed output; promotion остаётся закрытым.

## Важная поправка к предыдущему результату

WorkPass27 показывал `-0.25 Recall@5`. Новый разбор показал, что синтетический набор и обе реализации baseline/candidate не сохраняли самостоятельные однозначные числа, хотя labels зависели от статуса и latency. Это был дефект токенизации и дефект экспериментальной информативности, а не надёжное доказательство производственного отставания. После исправления пример достигает parity. Это **не доказывает**, что MemoryOS2 лучше BM25: данных для такого вывода нет.

## Интеграционные ограничения

Runtime `audit:workpass28` прошёл отдельно, включая HTTP server smoke. При повторном запуске полного корневого chained audit общий запуск превысил пятиминутный лимит инструмента до финального сводного exit status; поэтому объединённая команда не заявляется как подтверждённый PASS. Её компоненты проверялись отдельно: release metadata 34/34, metadata-contract 6/6, browser-smoke unit suite 51/51, atomic report 4/4, server import, UI/API linkage и assets audit — PASS. Это не заменяет production Vite build и browser/Live2D E2E, которые остаются неподтверждёнными.

## Следующее направление

Следующий кодовый проход должен не подгонять веса на этом мини-наборе, а закрепить независимый human-labelled temporal holdout из длинных диалогов: факты с меняющейся актуальностью, ревизии, противоречия, insufficient-evidence queries и числовые значения. Сравнивать Recall@k, MRR, p95 latency, false recall и не допускать holdout leakage. Ветка остаётся одной: `MemoryOS2 → MemoryFabric → OrganismCore → temporal inspector`.
