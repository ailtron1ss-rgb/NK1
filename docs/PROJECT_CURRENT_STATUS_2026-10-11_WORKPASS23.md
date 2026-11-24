# Neuro-Kurisu — текущее состояние WorkPass 23

**Дата:** 11 октября 2026 года  
**Root version:** `23.0.0-super-final10`  
**Canonical runtime:** `Neuro-Kurisu 35.46.0 / schema 223`  
**Статус выпуска:** implementation workpass; проект не объявлен release-ready.

## Счётчик выполненного

- **73 уникальных deliverables:** 52 DONE, 11 PARTIAL, 10 TODO.
- В WorkPass 23 добавлено **5 задач** в нормализованный реестр: четыре закрыты реализацией, одна остаётся открытой из-за недоступности сети/реальных весов модели. Дополнительный срез ужесточает поиск почти одинаковых запросов между train/holdout и совместимость NLI batch-клиента со старыми single-only сервисами.
- Кодовые изменения: безопасная загрузка NLI-модели по immutable revision, batched inference, ограничение concurrent work и отдельная privacy-aware holdout evaluation CLI.

## Фактические изменения WorkPass 23

1. **Supply-chain hardening.** `tools/research_nli_server.py` pins `cross-encoder/nli-deberta-v3-xsmall` to commit `a150876415327c80daeff35ca6f68f5ed8cf5c24`; mutable revision aliases are rejected, `trust_remote_code=False`, and loading requires `use_safetensors=True`. The exact revision is shown by `/healthz` and inference metadata.
2. **Batch inference.** New `/v1/nli/batch` evaluates up to 24 premise/hypothesis pairs in a single tokenizer/model forward pass. `ResearchSemanticEntailment` uses optional `evaluateBatch`; custom legacy backends keep single-pair compatibility. Raw scores stay uncalibrated.
3. **Resource control.** The local server caps in-flight worker threads, promptly returns HTTP 503 with `Retry-After` on overload, sets bounded CPU thread count, and preserves loopback-first/token policy.
4. **Holdout evaluator.** `tools/evaluate_research_nli.py` consumes fixed labelled JSONL, calls the batch service, records the exact dataset SHA-256 and model revision, reports per-class precision/recall/F1, confusion matrix, Brier score, cross-entropy and top-label ECE. The report excludes premise/hypothesis text, writes atomically with mode 0600, forbids HTTP off loopback, and requires `--allow-remote` for a non-loopback HTTPS endpoint.
5. **Memory benchmark integrity.** Added conservative high-overlap 3-token-shingle detection for near-identical train/holdout prompts, so trivial edits no longer evade the exact-normalized-query leakage gate. Diagnostics store counts only, not the query texts. Added an explicit near-duplicate leakage regression; the synthetic fixture still does not qualify as external memory-uplift evidence.
6. **Legacy NLI compatibility.** The batch client now falls back to bounded single-pair calls only when `/batch` returns 404/405. A 503, timeout or malformed response remains fail-closed and does not fan out into a request storm. Added regression scenarios for both old single-only endpoints and overload.
7. **Tests and packaging.** Runtime typecheck passes; 20 semantic NLI cases pass via a mocked backend; the service contract suite is 9/9 including pinning/safetensors/batching/backpressure; evaluator suite is 4/4 against a loopback mock service. The evaluator tests exercise its CLI and privacy properties.

## What I could not honestly complete

- The attempt to install optional `transformers`/`safetensors` failed because the package registry hostname could not be resolved (`EAI_AGAIN`); the model is not cached. Therefore **actual pretrained inference, latency and quality are not measured**. The evaluation utility is ready for a network-enabled run but no model score is claimed.
- `npm --prefix app ci` timed out and produced no `node_modules`; the React/Vite production build remains blocked by package-registry access. UI E2E remains open.
- The existing real labelled MemoryOS2 temporal holdout is still absent; no retrieval uplift is claimed.

## Acceptance details

- Runtime TypeScript: PASS (`npm --prefix runtime/neuro-kurisu run typecheck`).
- Semantic claim assessment: PASS, mocked NLI path; batch backend is explicitly exercised.
- Local NLI service contract: **9/9 PASS**.
- NLI labelled-holdout evaluator: **4/4 PASS** against a mocked loopback batch service; tests verify no text is written to report and the output file has mode 0600.
- True model inference and app build: **BLOCKED by registry DNS**, not reported as passed.

Weighted implementation roadmap: **71.65%** (displayed as 71.7%; previous WorkPass23 snapshot 71.50%, +0.15 percentage points; WorkPass22 baseline 71.3%). This is an internal weighted implementation score only—not release readiness, intelligence level, or observed NLI performance.
