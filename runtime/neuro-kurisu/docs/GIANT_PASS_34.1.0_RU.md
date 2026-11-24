# Neuro-Kurisu 34.1.0 — Giant Pass

## Что добавлено

1. Release bookkeeping переведён на 34.1.0 / organismCore 69.0.0-portable-subject-boundary / state schema 83.
2. Введён `neuro-kurisu.subject-transfer.v1` для переносимого Subject-state.
3. Subject fingerprint использует SHA-256 канонического subject projection и ловит tamper.
4. `facets.embodiment` и host capabilities не входят в portable payload.
5. Для чистого хоста adoption identity является явным флагом; неявного слияния чужого Subject нет.
6. Убран обнаруженный двойной snapshot P80/P81/P82 в горячем цикле.
7. Добавлены `test:portable-subject` и CLI `subject:export`.

## Что осталось открытым

- `OrganismCore.ts` и `StateMigrations.ts` по-прежнему слишком велики и требуют дальнейшего разбиения authority boundaries.
- 71 P-derived file в canonical runtime остаются источником semantic complexity; следующий приоритет — registry/facade consolidation, а не добавление новых параллельных подсистем.
- Long-horizon функционально проходит; scaling остаётся отдельным WARNING при высоком p99/heap-growth даже когда average latency ratio проходит порог. Это не считается закрытым performance-wise.
- Native Android host, lifecycle/recovery и реальная sensor grounding ещё не завершены.
- L1/L2/L3 evidence не продемонстрирована.
- Phenomenal consciousness / qualia остаются UNPROVEN.

## Historical-only result

`audit:legacy` всё ещё сообщает только два унаследованных отсутствующих snapshot-файла (`.github/workflows/build-dist.yml`, `.gitignore`); hash mismatch и extras отсутствуют. Это не является дефектом текущего runtime и не подменяется ложным PASS.

## Release validation

See `docs/RELEASE_VALIDATION_34.1.0_RU.md` for exact gate outcomes and the separation between functional PASS, scaling WARNING and historical legacy status.
