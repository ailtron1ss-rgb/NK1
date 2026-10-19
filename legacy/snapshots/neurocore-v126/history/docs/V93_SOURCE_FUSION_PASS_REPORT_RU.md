# NeuroCore V93 — Source-backed fusion pass

## Реальная работа

1. Расширен registry до полного наблюдаемого `fla.layers` export surface: 42 класса/оператора в FLA main, плюс отдельные external candidates.
2. Import targets используют публичный `fla.layers:<Class>` API, поэтому не завязаны на внутренние файловые пути.
3. Добавлена `inspect_constructor()` — сигнатура проверяется без инстанцирования.
4. Добавлен `scripts/probe_upstream_backends.py`: одинаковый tiny forward/backward probe; ошибка классифицируется, fallback запрещён.
5. Intake укреплён против symlink ZIP entries, добавлен expected SHA-256 и базовая license classification.
6. Current NeuroCore не импортирует upstream при обычном import и не создаёт второго recurrent/memory owner.

## Внешняя валидация

Актуальный FLA main публикует GDN-2, Raven, PGDN/PKDA и Mamba-3, а также широкий набор дополнительных linear/recurrent/attention operators. В июле 2026 FLA добавил CAT и FlashQLA backend; в июне — Parallax, PGDN/PKDA, Wall; в мае — GDN-2, Raven, YOCO.

## Важное ограничение окружения

В текущем sandbox GitHub/PyPI не резолвится, поэтому физические upstream bytes не были автоматически загружены в этот pass. Код готов к прямому приёму ZIP через `scripts/admit_upstream_source.py`. Это не считается интеграцией upstream source: только после source import + license/provenance + matched benchmark backend может быть promoted.
