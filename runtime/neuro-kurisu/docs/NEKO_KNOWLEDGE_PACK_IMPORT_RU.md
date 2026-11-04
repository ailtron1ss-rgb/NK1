# Импорт N.E.K.O. Knowledge Pack в NK1

## Назначение

`NekoKnowledgePackImporter` — узкий адаптер входного формата N.E.K.O. Knowledge Pack schema v1 к единственному каноническому write-path памяти NK1:

```text
untrusted bytes
  -> strict UTF-8 / JSON / schema-v1 validation
  -> preview (read-only)
  -> host approval + explicit license acceptance
  -> bounded entry selection
  -> stable command ID per pack entry
  -> MemoryFabric.encode(...)
  -> MemoryOS2 (canonical store) + existing checkpoint/restore
```

Импортёр не создаёт дополнительный memory store, retrieval index или очередь. Он не загружает pack из сети, не исполняет содержимое, не принимает заранее рассчитанные embeddings/chunks/hashes/model IDs и не вызывает provider tools.

## Формат и проверки

Верхний уровень допускает только `schema_version`, `pack_id`, `material_type`, `source`, `entries`. Материал — `knowledge` или `corpus`. Поля источника — `name`, необязательные `homepage` и `license`. Записи допускают `title`, `content`, необязательные `summary`, `terms.alias`, `terms.recognition`, `tags`.

Неизвестные поля отклоняются, включая любые derived/runtime поля. Дубли заголовков после NFKC-нормализации отклоняются. UTF-8 декодируется в fatal-режиме; управляющие символы очищаются, текст не обрезается молча.

Основные лимиты:

| Ограничение | Значение |
|---|---:|
| Размер JSON pack | 10 MiB |
| Количество записей в pack | 5 000 |
| Импорт за один вызов | 32 записи |
| Контент одной импортируемой записи | 20 000 символов |
| Суммарный выбранный контент за вызов | 96 000 символов |
| Пример заголовков в preview | 12 |

Pack большего размера разрешается просматривать и импортировать частями через явные индексы записей (индексы нулевые). Автоматическое импортирование всех 5 000 записей невозможно.

## Одобрение и лицензия

`preview(bytes)` не изменяет память и возвращает pack ID, тип, атрибуцию источника, license metadata, digest, размер, количество записей и примеры заголовков.

`import(bytes, approval)` требует одновременно:

- `approval.approved === true` — отдельное решение host/operator;
- `approval.licenseAccepted === true` — отдельное подтверждение принятия заявленной лицензии;
- непустое поле `source.license`;
- явно выбранные индексы для pack, который превышает лимит одной партии.

Approval — inert data object: лишние поля, accessors, sparse/custom selection arrays отклоняются. При этом сам импортёр не является юридическим классификатором лицензий: он сохраняет точную строку лицензии и фиксирует факт host acceptance. Юридическая совместимость, обязательные NOTICE/attribution и права на изображения/аудио/модели проверяются отдельно до одобрения.

## Эпистемические гарантии

Каждая строка импортируется как:

- `kind: semantic`;
- `epistemicStatus: unknown` — никогда автоматически не `fact`;
- `provenanceClass: external`;
- `confidence: 0.15`;
- `sourceAuthority01: 0.2`;
- `trustStatus: unverified-external`.

Сохраняются pack ID, entry index, тип материала, source name, homepage, license, title, alias и recognition terms. Данные не пишутся в autobiographical/identity memory и не получают независимый голос за счёт повторного импорта из того же источника.

## Идемпотентность и восстановление

Для каждой пары `pack_id + entry index` используется постоянный command ID `neko-knowledge-pack:v1:<pack_id>:<index>`. Точный повтор воспроизводит сохранённую квитанцию MemoryFabric. Повтор с изменённым payload при том же command ID завершается conflict error и не переписывает прежнее знание.

Публичный вызов идёт через `OrganismRuntime` queue и `OrganismCore`. После записи Core обновляет штатные projections и выполняет принудительный checkpoint. Восстановление использует существующие MemoryFabric/MemoryOS2 snapshot-restore. Второй persistence engine не добавляется.

## Границы

- Нет автоматического web fetch / Firecrawl / TinyFish вызова.
- Нет plugin execution, shell, dynamic import или network access.
- Нет automatic trust promotion, обучающего апдейта confidence или записи в личность.
- Нет silent truncation, превышения memory limits или обхода MemoryFabric.
- Никаких изменений `main` и опубликованного Release ZIP в рамках этого PR.
