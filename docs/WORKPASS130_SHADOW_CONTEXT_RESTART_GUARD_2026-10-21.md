# WorkPass130 — привязка shadow evidence к trusted run context и restart-регрессия

## Что изменено в коде

- В `VerifiedSkillShadowEvidence.ts` добавлен `createContextBoundSkillShadowEvidenceVerifier`: он сначала проверяет Ed25519 receipt и точную привязку к candidate, затем сравнивает подписанные `manifestFingerprint` и `runtimeVersion` с независимым контекстом, полученным через внедрённый resolver.
- Resolver fail-closed: исключение, отсутствие контекста, неверный fingerprint или пустая версия runtime приводят к отказу. Комментарий фиксирует контракт: источник контекста обязан быть доверенным run registry/configuration, а не самим receipt.
- В `p23-versioned-skill-candidate-store.mjs` добавлена интеграционная регрессия: подписанный receipt сохраняется в AtomicFile persistence, восстанавливается после создания нового store, отклоняется при несовпадении доверенного manifest и принимается при совпадении trusted context.
- Существующий learning workflow уже включает этот тест и проверку TypeScript runtime; отдельный workflow не создавался, чтобы не плодить дублирующие пайплайны.

## Коммиты этого прохода

- `8edfeb0e6b7d563c03fd9517a3f7ffc4976c5a6b` — context-bound verifier.
- `7861d427d629e9f8340aa9b3901f007d5c74a55c` — restart/context regression.
- `733997a1eb492b318942783348ca3075cde2d6f4` — изоляция временного хранилища теста.

## Границы результата

- **IMPLEMENTED:** reusable verifier enforcing signed receipt + trusted manifest/runtime context; regression source committed.
- **NOT VERIFIED:** тест и typecheck не были запущены локально в этой среде. Код в GitHub сам по себе не доказывает, что CI зелёный.
- **OPEN / P0:** production trusted-key registry и resolver должны быть подключены в единственном реальном bootstrap. Resolver должен брать manifest/runtime из доверенного execution record, не из payload receipt.
- **OPEN / P0:** не завершён полный аудит мест создания `VersionedSkillCandidateStore` и всех путей активации в `OrganismCore.ts`. Не заявляется, что обходные activation paths закрыты.
- **OPEN:** approval authority production wiring остаётся отдельным обязательным gate; default-deny не отключать ради удобства теста.

## Связь с мастер-планом пересборки чата

Этот проход закрывает часть gap «проверяемое обучение / отсутствие поддельного shadow evidence / восстановление после перезапуска» из мастер-плана пересборки чата от 2026-10-17. Он не заменяет сам мастер-документ и не доказывает улучшение transfer/generalization. Текущий репозиторий хранит checkpoint и требования, а не гарантированно полный дословный экспорт переписки.

## Следующий крупный этап

1. Найти все реальные constructor/bootstrap call sites candidate store и внедрить production key registry + trusted run-context resolver.
2. Привязать resolver к фактическому manifest, runtime build identity, task/seed и run ID из supervisor/execution ledger.
3. Аудировать все вызовы promotion/activation и доказать отсутствие параллельного пути, который активирует candidate без canonical gate.
4. Получить читаемые job logs и успешные focused tests + typecheck на exact head. До этого статусы CI/тестов остаются UNKNOWN, не PASS.
5. Свести этот P0 в актуальный unified backlog, сохраняя требования к исходникам, UI/Live2D, памяти, обучению и целостности проекта.

## Честный итог

Верификатор теперь умеет не только проверять подпись, но и связывать её с внешним доверенным контекстом выполнения; добавлена проверка этого контракта через перезапуск durable store. Production wiring, сквозной call-graph и успешный CI остаются открытыми.
