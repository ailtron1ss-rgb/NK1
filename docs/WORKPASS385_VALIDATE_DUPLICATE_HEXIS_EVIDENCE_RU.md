# WorkPass385 — валидировать Hexis evidence до duplicate no-op

**Дата:** 2026-10-26  
**Ветка:** workpass375-hexis-canonical-ingress-latest  
**Базовый HEAD:** 17d89d3e464689b8d3466f8598cdb37b3ee79bbe  
**Статус:** изменение кода и regression внесены; exact-head проверки обязательны.

## Дефект

`MemoryOS2.recordEvidence()` нормализовал `independenceKey`, затем сразу возвращал `ok:true / duplicate-source`, если lineage уже существовал. Source, provenance class, confidence, observedAt/evidenceFreshnessAt и Hexis canonical envelope проверялись только для новых lineage. Поэтому повтор с тем же ключом, но malformed confidence (`1.01`), неверным provenance, некорректными timestamps или control-character source классифицировался как успешная дедупликация.

## Исправление

- Удалить ранний duplicate return из последовательности проверки ключа.
- Проверить source text/identity, enum provenance, confidence [0,1], integer timestamps/freshness и выполнить `adaptHexisEvidence()` до проверки существующего lineage.
- Только после успешной адаптации проверить `hasEvidenceLineage`. Если источник уже присутствует, вернуть `duplicate-source` no-op, не менять memory object/evidence trail/estimated bytes/lastAccessAt/reconsolidations.
- Оставить MemoryOS2 единственным canonical memory owner; вторую таблицу lineage или отдельную память не создавать.

## Regression

Расширен `tests/cognitive-hexis-evidence-adapter.mjs`: существующий `paper:claim-1` повторяется с некорректной confidence (число и строка), provenance, observedAt, freshness, пустым source и C0 control character. Все случаи обязаны вернуть `ok:false`, точную причину и неизменённые evidence trail/reconsolidations. Обычный duplicate с валидными полями и duplicate после snapshot/restore по-прежнему проходят как no-op.

## Критерии закрытия

Новый exact-head запуск должен пройти `test:cognitive-hexis-evidence-adapter`, `test:hexis-memory-evidence-lineage`, Repository Wiring Audit и полный WorkPass71. Synthetic unit tests не трактуются как measured memory recall/learning uplift.

`main` и опубликованный Release ZIP не меняются.
