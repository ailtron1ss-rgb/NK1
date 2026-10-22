# WorkPass129 — подписанные доказательства shadow-run (2026-10-21)

## Цель прохода
Следующий P0 после WorkPass128: не считать shadow-run достоверным только потому, что вызывающий код передал правдоподобные `runId`, SHA-256-подобный fingerprint, `passed: true` и timestamp.

## Изменения в коде
- Добавлен `VerifiedSkillShadowEvidence.ts`: схема подписанного execution receipt связывает результат с точными `candidateId`, `skillId`, версией кандидата, fingerprint payload, fingerprint исходов proposal, run/task, manifest, seed, runtime version, verifier ID, результатом и временем.
- Ed25519-подпись проверяется по явно доверенному публичному ключу. Изменённый outcome, неизвестный ключ, иной candidate/version или подменённый fingerprint отвергаются.
- `VersionedSkillCandidateStore` получил отдельный `SkillShadowEvidenceVerifier`, по умолчанию deny. Он проверяет receipt до сохранения наблюдения и повторно проверяет каждое сохранённое наблюдение перед promotion — snapshot/персистентность сами по себе не считаются доказательством подлинности.
- Добавлен регрессионный тест `p23-verified-skill-shadow-evidence.mjs` и подключение в npm scripts + learning workflow.
- Существующий тест жизненного цикла явно использует тестовые verifier-callbacks; это не production-конфигурация.

## Важные ограничения
- Код написан и закоммичен в ветку, но тесты и TypeScript typecheck в этом проходе не запускались; GitHub Actions пока не считается зелёным без доступного успешного job/log.
- Production runtime ещё должен создать trusted key registry и внедрить `verifySignedSkillShadowObservation(observation, candidate, trustedKeys)` в конструктор store. Без этого новый default-deny корректно блокирует shadow admission и promotion.
- Подпись доказывает владение доверенным ключом, но сама по себе не доказывает независимость, честность или качество verifier. Ключи должны поступать из доверенной конфигурации, а не от кандидата/пользователя.
- Manifest и runtime version сейчас криптографически подписаны как поля payload; вызывающая production-система должна сравнивать их с реально использованным holdout manifest/runtime. Подпись не заменяет проверку фактического исполнения.
- Не закрыт полный аудит всех путей активации в `OrganismCore.ts`; прежний GitHub contents endpoint возвращал пустое содержимое. Нельзя объявлять, что все activation paths используют candidate store.

## Связь с запросом о пересборке чата
Не потерять мастер-анализ от 2026-10-17: документ «Нейро Курису — стратегия, архитектура, исходники, исследования и дорожная карта» (ранее сообщалось: 17 779 слов, 42 страницы, 25 разделов, 100 задач P0–P3). Его требование — свести в один управляемый план цели и историю решений, дефекты/недостающие возможности, анализ исходников и пригодных интеграций, актуальные исследования 2025–2026 и пошаговую дорожную карту. Этот план должен быть источником требований для implementation passes, а не отдельным документом, который заменяет кодовую работу.
- В каждом следующем проходе связывать изменённый код с конкретным gap/задачей из мастер-плана и отмечать DONE / PARTIAL / OPEN.
- Не утверждать, что текущий репозиторий содержит буквальный полный экспорт всех сообщений чата: он содержит checkpoint/handover и выводы, а не гарантированно полный transcript.
- Пересобрать единый актуальный backlog на текущем состоянии NK1: старые WorkPass51–54/архивные версии — исторический контекст, текущие WorkPass124–129 и live PR/CI — фактическая основа статуса.

## Изменённые пути
- `runtime/neuro-kurisu/src/organism/learning/VerifiedSkillShadowEvidence.ts`
- `runtime/neuro-kurisu/src/organism/learning/VersionedSkillCandidateStore.ts`
- `runtime/neuro-kurisu/tests/p23-verified-skill-shadow-evidence.mjs`
- `runtime/neuro-kurisu/tests/p23-versioned-skill-candidate-store.mjs`
- `runtime/neuro-kurisu/package.json`
- `.github/workflows/workpass110-continual-learning-metrics.yml`

## Следующий крупный шаг
1. Подключить production trusted-key registry и signed shadow verifier в единственном canonical bootstrap; проверить все места создания `VersionedSkillCandidateStore`.
2. Исправить/расширить тесты так, чтобы default-deny был проверен на фактической persistence reconstruction, подпись проверялась повторно после restart, и подмена manifest/runtime отвергалась сравнением с доверенным контекстом запуска.
3. Запустить focused tests + typecheck + exact-head CI; если runner снова возвращает jobs без steps/logs, диагностировать runner/workflow, не считать это PASS.
4. Завершить call-graph audit всех путей активации, включая `OrganismCore.ts`, и только затем оценивать безопасное снятие draft.
5. Перенести мастер-план пересборки чата в актуальный backlog с владельцами/критериями проверки и не терять ранее согласованные цели интеграции исходников, UI/Live2D и единого проекта.

## Честный итог
Укреплена проверяемая граница shadow evidence, добавлен signed receipt contract и регрессия. Это повышает безопасность допуска кандидата, но не доказывает улучшение качества обучения, production wiring или завершённость цифровой личности.
