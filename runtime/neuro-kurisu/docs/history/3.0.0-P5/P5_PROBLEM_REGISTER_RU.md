# P5 Problem Register

| Проблема | Исправление | Статус |
|---|---|---|
| P4 version markers оставались в canonical docs | P4 материалы перемещены в history | fixed |
| P3 value plasticity конкурировал с P5 value evolution | P5 стал canonical path; legacy mechanism оставлен fallback | fixed |
| Self-project linked goal не сохранялся в engine snapshot | добавлен `linkGoal()` | fixed |
| Identity trajectory теряла anchors после restart | anchors добавлены в persisted snapshot | fixed |
| Project evidence требовал только goalId match | relevant actions теперь учитываются | fixed |
| Research labs замедляли release audit | `research:all` отделён от `release:audit` | fixed |
| Node type checking требовал внешних typings | локальный `src/node-shims.d.ts` | fixed |
| P5 migration отсутствовала | schema 6 -> 7 | fixed |
| P5 test не освобождал второй runtime | явный `stop()` | fixed |
