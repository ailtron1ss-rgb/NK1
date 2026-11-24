# Neuro-Kurisu SUPER — WorkPass 6: agency evidence and reafference closure

**Дата:** 2026-10-09  
**База:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS5_2026-10-09.zip`  
**Происхождение базовой линии:** HOTFIX_CHAT v20 от 2026-10-09 + совместимые WorkPass 4/5; старые ветки не накладывались целиком.  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223.  
**Статус:** интеграционный рабочий проход, не release sign-off.

## 1. Что изменено реально

### A. WILL-inspired `AffordanceField` как read-only evidence layer

- Новый `src/organism/system/AffordanceField.ts` строит ограниченное поле доступных кандидатов из уже сформированного canonical candidate set.
- Учитываются выбранный кандидат, альтернативы, оценка, утилита/уверенность, ожидаемая стоимость, наличие world-prediction ticket, причины/мировые свидетельства и margin между выбором и лучшей альтернативой.
- Число отображаемых кандидатов ограничивается attention budget; выбранный кандидат сохраняется в поверхности диагностики.
- В evidence явно записаны `affectsSelection: false` и `selectionOwner: OrganismCore-canonical-arbiters`: это не второй селектор и не параллельный policy owner.
- `OrganismDecisionTrace` получает `agencyEvidence`; это проходит через обычный persisted trace, snapshot, migrations и restart.

### B. Reafference → canonical temporal-credit path

- Новый `ReafferenceEvidenceCodec.ts` конвертирует только привязанное к точному `decisionId` и ещё не разрешённому каноническому решению внешнее наблюдение в сигнал Temporal Credit.
- `decisionId` намеренно не угадывается по `actionRef`/`executionId`; точная связь передаётся вызывающей стороной.
- Недостаточно проверенные совпадения отклоняются; противоречие становится отрицательным обучающим сигналом только при `disputed`, минимум двух независимых источниках противоречия и threshold `contradiction01 >= 0.68`.
- Дополнительное обучение проводится только существующим `CanonicalTemporalCreditAuthority` и `adaptivePolicy`; применяются исключительно отложенные assignments с причинной уверенностью ≥ 0.5 и признаком независимости.
- Добавлена интеграционная проверка, что decision evidence переживает `snapshot → state migration → restart`, а не существует только в оперативной памяти.

### C. Исправлены два дефекта, найденных при стыковке

1. **Targeted temporal credit:** когда передан `decisionId`, прежняя логика пропускала в тот же вызов и другие pending решения в окне горизонта. Теперь targeted resolve выбирает строго один идентификатор; horizon selection используется только если target ID не задан.
2. **Directional contradiction strength:** явное несовпадение значений одного поля раньше получало низкий вклад из-за низкого lexical similarity. Теперь совпадение использует similarity, mismatch — направленную величину `1 - similarity`; слабое/неоднозначное сравнение не становится искусственно сильным противоречием.

### D. Источники были адаптированы, а не скопированы вслепую

В `legacy/input-archives/raw-source-archives/will-main.zip` сохранён WILL source archive (SHA-256 `9d0c30277f0981b67104b1e2a07d9c7f025fee60ae57bd470cca898cf0d457a4`). Повторно использованы идеи из WILL affordance synthesis и sensory reafference: ограниченное situational affordance field, явная связь action → внешнее восприятие → результат, withheld/непроверенные результаты не трактуются как провал компетенции. Код адаптирован к текущим `OrganismCore`, `OutcomeCognitionFabric`, `CanonicalTemporalCreditAuthority`, `ActionGateway` и `adaptivePolicy`. Ни один полный WILL runtime, второй memory owner, policy owner или action executor не добавлялся.

В согласовании использованы результаты трёх главных анализов: сравнительный аудит WILL vs Neuro-Kurisu от 2026-10-08; полный кодовый/интеграционный анализ; подробная roadmap от 2026-10-09. Их общий приоритет — agency/action feedback, переносимость и evidence/holdout, с сохранением canonical ownership.

## 2. Проверки, действительно выполненные

| Проверка | Результат |
|---|---|
| AffordanceField regression | PASS |
| Targeted Temporal Credit regression | PASS |
| External-observer contradiction regression | PASS |
| Reafference evidence codec regression | PASS |
| Real OrganismCore reafference integration | PASS; 1 exact target assignment, 1 delayed policy assignment |
| Agency evidence persistence/restart round-trip | PASS |
| Runtime TypeScript typecheck | PASS (`TYPECHECK=PASS mode=tsc`) |
| `audit:integration-workpass` | PASS; server imports and API/UI linkage included |
| Server smoke, including real chat request | PASS |
| WILL integration | PASS 9/9 |
| WILL SDK/MCP/channel surfaces | PASS 3/3 |
| Lumina adaptation | PASS 3/3 |
| Hexis adaptation + HTTP smoke | PASS |
| Letta governance | PASS |
| Conscio adaptation + HTTP smoke | PASS |

The runtime UI/API linkage audit sees 122 client routes and 47 Runtime Atlas surfaces, four required existing seams and zero missing handlers. Server import audit checks 10 imports with zero missing.

## 3. Прогресс roadmap

**Итог WorkPass 6: 60.0% взвешенного implementation roadmap, +3.0 п.п. от WorkPass 5.** Формула: сумма `workstream weight × completion fraction`; это оценка объёма/зрелости реализации, не вероятность релиза и не утверждение о 100% готовности. Вклад агентского направления D поднят с 45% до 60% после явного affordance evidence, адресного temporal credit, порога противоречий и проверенного persistence/restart пути.

Текущие проценты: A 100%, B 90%, C 40%, D 60%, E 55%, F 20%, G 30%, H 45%. Подробная таблица находится в `docs/PROJECT_PROGRESS_SCORECARD_2026-10-09.json`.

## 4. Не закрыто — без завышенных заявлений

- Полный root/app typecheck всё ещё зависит от отсутствующих в исходном окружении UI typings/dependencies (`@types/node`, `vite/client`); в этом проходе подтверждён именно runtime typecheck.
- React/Vite production build, desktop/mobile/Live2D browser E2E не подтверждены.
- Agency цепочка теперь имеет диагностическое affordance поле и отложенный reafference путь для точного решения, но полное стрессовое тестирование широкого ActionCompetition/real external tool ecosystem, reconnect/replay abuse cases и автономной долгосрочной работы остаётся открытым.
- Memory 2.0 требует заранее фиксированного baseline/candidate, multi-seed и holdout без утечки обучающих данных. Процент улучшения памяти не заявляется.
- Clean-room install, backup/restore plus upgrade/rollback drill, multi-hour soak/resource-growth limits, финальные SBOM/provenance/release gates остаются TODO.

## 5. Следующий большой пакет

1. KnownEntityDossier как **проекция** уже существующих canonical social/identity/memory owners, без новой самостоятельной базы сущностей.
2. Decision receipts/reafference: adverse cases (decision ID mismatch, duplicate source, stale/freshness boundary, repeated observations, non-autonomous actions) и deterministic replay checks.
3. Memory 2.0 benchmark harness: baseline/candidate arms, separate train/holdout inputs, recall/accuracy/contradiction/latency/token-cost metrics; no automatic promotion without a holdout win.
4. Dependency-complete UI build, browser/Live2D E2E and release recovery gates.
