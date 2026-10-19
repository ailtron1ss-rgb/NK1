# RELEASE NOTES 34.72.0 — BIG PASS 98 Compound Binding Hardening

Версия: 34.72.0 · schema 111 · BIG PASS 98

## Реальные изменения

- ProceduralSkillLibrary: state version 4.
- CompoundSkillStep получил `inputBindings`, `expectedOutputKeys`, `allowUnverified`.
- Reusable skill execution умеет безопасно передавать verified output предыдущего шага в следующий через `$step:<stepId>.<key>`.
- Отсутствующий binding останавливает цепочку fail-closed.
- Для обязательного шага `verified=false` означает, что весь compound execution неуспешен и дальнейшие шаги не запускаются.
- Проверка `expectedOutputKeys` превращает silent malformed tool results в explicit failure.
- Migration v2/v3 → v4 сохраняет обратную совместимость.

## Не заявляется

Compound skills не являются доказательством general intelligence или сознания.
