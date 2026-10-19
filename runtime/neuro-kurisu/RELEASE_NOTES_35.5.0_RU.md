# Neuro-Kurisu 35.5.0 — BIG PASS 158

Главная цель релиза: проверка функциональности всего проекта и устранение ложных/устаревших тестовых контрактов.

- Добавлен статический function-liveness inventory.
- Добавлена безопасная behavioral-проверка 177 no-arg методов OrganismCore.
- Добавлен direct contract для ранее неиспользуемых экспортируемых body/perception/cognitive-frame helpers.
- Удалён подтверждённо мёртвый helper `authorshopSafe`.
- Исправлены устаревшие migration assertions, привязанные к старым state schema.
- Сохранены строгие runtime/persistence/server/restart и architecture gates.
- state schema: 127.
