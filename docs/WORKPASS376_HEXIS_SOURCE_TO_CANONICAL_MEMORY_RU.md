# WorkPass376 — Hexis / OMEGA source lineage → canonical MemoryOS2

**Дата:** 2026-10-26  
**Ветка:** \`workpass376-hexis-source-to-canonical-memory\`  
**База:** \`workpass375-hexis-canonical-ingress-latest\`  
**Статус:** реализация и регрессионные тесты добавлены; exact-head CI ожидается.

## Проблема интеграции

WorkPass375 защищает write boundary MemoryOS2, а OMEGA уже хранит описательную lineage в SourceMonitor и эпистемические claims в P65. Без явного bridge эти отдельные журналы могут рассказывать об одном upstream observation, не сходясь в канонической evidence lineage памяти. При этом автоматически считать любой след «доказанным фактом» небезопасно: SourceMonitor прямо указывает, что его provenance descriptive, а не криптографическая аутентификация.

## Изменения

- Добавлен \`HexisCanonicalEvidenceBridge\`: получает trace через \`SourceMonitor.lineage()\` или claim из snapshot P65 и перенаправляет допустимую provenance в единственный writable owner — \`MemoryOS2.recordEvidence()\`.
- Допускаются только активные наблюдения / факты с классом \`direct-observation\` или \`corroborated\`, корректной source identity, safe timestamps и 64-символьным declared content fingerprint.
- \`inferred\`, \`unverified\`, hypothesis, model-generated и memory-echo записи не могут создать новую independent evidence lineage через этот мост.
- Stable independence key вычисляется из upstream \`sourceId + contentFingerprint\`; один и тот же upstream source, пришедший из SourceMonitor и P65, схлопывается в единственную canonical lineage.
- Authority в MemoryOS2 ограничена консервативными cap по evidence class и остаётся метаданными provenance. Bridge никогда не меняет belief confidence, не подписывает источник, не разрешает tools и не продвигает skill.
- Добавлены метрики attempted/accepted/added/duplicates/rejected и регрессия на cross-store dedup, no confidence ratchet, reject-before-mutation и restart replay.
- Новый suite включён в \`test:hexis-memory-evidence-lineage\`, а repository-wiring workflow учитывает source/test файлы, WorkPass376 push branch и WorkPass375 как base для stacked PR.

## Границы доказательств

Fingerprint в этом контракте — заявленная upstream-метка, а не доказательство подлинности содержимого. Сильную аутентификацию, независимую проверку и рост recall нужно доказывать отдельным signed-evidence контрактом и immutable holdout. \`main\` и published Release ZIP не изменялись.
