# Архив инженерных циклов NK1: 10–15 ноября 2026

Этот каталог содержит неизменённые исторические снимки ежедневных инженерных циклов, перенесённые из старой документационной ветки `docs/nk1-daily-engineering-cycle-2026-11-10`.

## Важно: это архив, не текущий handoff

- SHA ветки `workpass70-source`, PR-статусы, счётчики и CI-ссылки внутри этих документов отражают состояние на дату соответствующего цикла.
- Они **не являются текущим состоянием репозитория** и не должны использоваться как инструкции для новых изменений.
- В документах сохранены исходные утверждения, ограничения и отметки UNKNOWN/NOT INSPECTED. Сами файлы не переписывались, чтобы сохранить provenance и контекст решений.
- Все упоминания открытых PR рассматриваются только как исторические записи. Современное состояние проверяется по живому GitHub API.
- Release ZIP от 19.10.2026 в этих журналах подтверждён только по metadata; binary inspection, CRC/member list и source parity не заявлялись.

## Состав

| Дата | Документ |
|---|---|
| 10.11.2026 | [Daily engineering cycle](../NK1_DAILY_ENGINEERING_CYCLE_2026-11-10.md) |
| 11.11.2026 | [Daily engineering cycle](../NK1_DAILY_ENGINEERING_CYCLE_2026-11-11.md) |
| 12.11.2026 | [Daily engineering cycle](../NK1_DAILY_ENGINEERING_CYCLE_2026-11-12.md) |
| 13.11.2026 | [Daily engineering cycle](../NK1_DAILY_ENGINEERING_CYCLE_2026-11-13.md) |
| 14.11.2026 | [Daily engineering cycle](../NK1_DAILY_ENGINEERING_CYCLE_2026-11-14.md) |
| 15.11.2026 | [Daily engineering cycle](../NK1_DAILY_ENGINEERING_CYCLE_2026-11-15.md) |

## Откуда перенесено

- Donor PR: #854
- Donor branch: `docs/nk1-daily-engineering-cycle-2026-11-10`
- Текущий источник на момент selective port: `workpass70-source`
- Из PR #854 намеренно не перенесены устаревшие версии `README.md`, `AGENTS.md`, `NEUROCORE_START_HERE.md`, 75-aspect backlog, `engineering-os/aspects.v1.json` и изменения `package.json`. Их необходимо анализировать отдельно по смыслу и версии; они не нужны для сохранения исторических отчётов.

## Политика дальнейшей работы

При любом противоречии между этим архивом и текущим кодом/ветками верным считается актуальный source после live ref check. Архив не должен автоматически менять статусы аспектов, readiness, релизные утверждения или текущие handoff-инструкции.
