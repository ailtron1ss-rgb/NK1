# PASS 15 — Runtime residency / hot-path

Дата: 2026-10-01

Каноническая release-note находится в:
`RELEASE_NOTES_PASS_15_RESIDENCY_HOTPATH_2026-10-01_RU.md`

Проход направлен на снижение transient allocation в planner/interoception/dependency hot-path. На 128-cycle gate peak RSS снизился примерно до 438 MiB, peak heap до 278 MiB.

256-cycle restart boundary сознательно не помечен PASS: текущая среда не завершила длинную persistence/restart проверку в пределах orchestration timeout. Это зафиксировано в канонической release-note.
