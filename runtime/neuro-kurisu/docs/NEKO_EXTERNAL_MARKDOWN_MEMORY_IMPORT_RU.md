# Импорт N.E.K.O. OpenClaw/Hermes Markdown в NK1

## Назначение

`NekoExternalMarkdownMemoryAdapter` принимает уже извлечённые host-side файлы `USER.md`, `SOUL.md`, `MEMORY.md` и ежедневные журналы `memory/YYYY-MM-DD*.md` / `memories/YYYY-MM-DD*.md`. Он переносит только детерминированную разметку из N.E.K.O. `memory/external_markdown_import.py`; сам ZIP не распаковывается внутри runtime-адаптера — архивный слой должен отдельно безопасно извлечь файлы и передать ограниченный список `{path, content}`.

Это другой формат, чем N.E.K.O. Knowledge Pack schema v1: curated knowledge pack обрабатывается отдельным `NekoKnowledgePackImporter`. Markdown importer предназначен для переноса пользовательского профиля, описания личности и ежедневной памяти из рабочих пространств OpenClaw/Hermes.

## Предварительный просмотр и утверждение

`preview(files)` проверяет path traversal, UTF-8-представленный текст, размеры, число файлов и число кандидатов; выделяет заголовки, пункты списков и абзацы; поддерживает Hermes `§` и удаляет fenced code. Повторяющиеся нормализованные записи сводятся к одному кандидату.

Preview не мутирует память. Каждый кандидат получает стабильный SHA-256 ID и видимые поля источника, секции, типа и найденных инъекционных маркеров. Кандидаты с role markers, ChatML tokens и командами игнорировать прежние инструкции помечаются `quarantined`; для их импорта требуется отдельный per-ID override при уже осознанной ручной проверке.

`commit(importId, approvedIds)` записывает только явно выбранные ID. Preview действует 30 минут и хранится в bounded in-process cache; после рестарта требуется новый preview и новое одобрение.

## Владелец памяти и epistemic policy

Записи проходят только через `MemoryFabric.encode` в существующий `MemoryOS2`. Новый store, вторая очередь памяти и прямой доступ импортёра к `MemoryOS2` не создаются.

| Источник | NK1 kind | Контекст | Начальный epistemic status |
|---|---|---|---|
| `USER.md` | `social` | пользовательские сведения | `unknown` |
| `SOUL.md` | `identity` | внешнее описание persona, требующее сверки | `unknown` |
| `MEMORY.md` | `semantic` | факты-кандидаты | `unknown` |
| daily journal | `episodic` | дата события | `unknown` |

Каждая запись имеет `provenanceClass=external`, низкие `confidence` и `sourceAuthority01`, исходный путь/секцию, формат импорта и независимый ключ источника. Импорт никогда не присваивает `fact`, не перезаписывает базовую личность и не продвигает сведения автоматически. Противоречия остаются на adjudication/epistemic конвейере NK1.

## Границы текущего этапа

- Вход: host-side extracted file descriptors, не произвольный filesystem path и не прямой URL.
- Нет сетевого fetch, выполнения Markdown, LLM-парсинга, automatic import или автоматического повышения trust.
- Для подозрительных фрагментов действует fail-closed preview quarantine и отдельное решение пользователя.
- Idempotency command IDs идут через существующие persisted MemoryFabric receipts; при старении receipt MemoryFabric сам требует recovery вместо слепого повтора.
- Перенос архивных картинок, аудио, видео, вложений и raw transcripts требует отдельных типов наблюдений и лицензий.
