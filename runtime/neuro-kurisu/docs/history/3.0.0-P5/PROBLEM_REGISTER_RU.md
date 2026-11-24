# Реестр проблем и архитектурных решений

| Класс | Проблема | Действие | Статус |
|---|---|---|---|
| Архитектура | Сотни brain/core/coordinator слоёв | Legacy изолирован; один canonical OrganismRuntime | fixed |
| Сложность | Исторические verify-команды и alias surface | Canonical release surface сокращён; research вынесен отдельно | fixed |
| Зависимости | Большой внешний dependency surface и отсутствие lockfile | Runtime/build dependencies = 0; настоящий lockfile v3 | fixed |
| UI/runtime | Framework runtime был тесно связан с cognition | stdlib server + vanilla UI | fixed |
| Версии | Старые release markers смешивались с актуальными | Один VERSION.json + canonical release manifest | fixed |
| Persistence | Несколько state layers | Один OrganismRuntime и одна schema/migration chain | fixed |
| Concurrency | Возможны параллельные state transitions | Single-writer queue + ProcessLock | fixed |
| Legacy leakage | Новый core мог зависеть от старого | Architecture gate запрещает legacy/research imports в canonical | fixed |
| Testing | Проверка наличия модулей вместо причинного эффекта | Smoke + restart + ablation + causal labs | fixed |
| Device paths | Build-container paths в старых scripts | Termux scripts вычисляют root относительно файла / `KURISU_ROOT` | fixed |
| LLM | LLM мог выглядеть как источник решения | LanguageOrgan получает выбранное действие | fixed |
| Android | Реальное устройство нельзя проверить из контейнера | Отдельный Device Gate + soak protocol | pending device |
| Self-authorship | История revisions существовала отдельно от реальных values | P5 applyRevision меняет adaptive values с защитными floors | fixed |
| Value evolution | Legacy P3 value plasticity могла «подпирать» P5 lesion | P5 evolution становится canonical path при включённом флаге | fixed |
| Identity | Continuity теряла anchors после restart | P5 сохраняет value/project anchors | fixed |
| Research runtime | Causal labs были частью release:audit | Research и release gate разделены | fixed |
| Research metrics | Некоторые старые scores насыщались на 1.0 | P5 primary evidence опирается на project/agency/revision/trajectory metrics | fixed |

## Важная граница
Legacy snapshot не является runtime dependency. Он сохранён как provenance/A-B база и не должен импортироваться canonical runtime.
