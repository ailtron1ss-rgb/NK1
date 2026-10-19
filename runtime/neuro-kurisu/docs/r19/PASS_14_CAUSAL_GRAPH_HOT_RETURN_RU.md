# PASS 14 — Causal Life Graph hot-return (индекс)

Дата: 2026-10-01

Каноническая release-note этого прохода хранится в:
`RELEASE_NOTES_PASS_14_CAUSAL_GRAPH_HOT_RETURN_2026-10-01_RU.md`

Этот файл намеренно не дублирует release-note. Он оставлен как навигационная запись R19: PASS14 удалил неиспользуемые deep-return snapshots из двух hot-callers `CausalLifeGraph.recordCycle()`, сохранив публичное поведение по умолчанию и формат durable state.
