# BIG PASS 95 — Progress / Decisions

## Стартовая точка
Neuro-Kurisu 34.67.0 / BIG PASS 94.

## Что требовалось
1. Не дублировать SocialMindKernel.
2. Добавить second-order social beliefs.
3. Добавить social counterfactuals.
4. Добавить repair planning.
5. Усилить self-in-relationship.
6. Не выдавать собственные действия организма за ground truth намерения пользователя.
7. Сохранить phone-first performance.
8. Сохранить persistence / replay / release integrity.

## Выполнено
- Second-order belief store.
- Bounded counterfactual alternatives.
- Social repair proposal.
- roleSelfModel01 / perceivedAgency01 / expectedResponseUncertainty01.
- agentAction feedback into social learning.
- Evidence-first correction: actualIntent теперь остаётся неизвестным без независимого подтверждения.
- Unicode-safe intent detection.
- Persistence restore normalization for new social fields.
- Read-only social API расширен secondOrder/counterfactuals/repair.
- Release/test/source-truth metadata synchronized to 34.68.0.
- BIG PASS 95 regression test.

## Не выполнено намеренно
- Нет чтения мыслей.
- Нет доказанной Theory of Mind.
- Нет утверждения о феноменальном сознании.
- Нет нового независимого social subsystem.
- Нет тяжёлого always-on inference на телефоне.

## Verification boundary
Функциональные, mobile, architecture, contract, project-state, source-truth, legacy, hygiene, forensics, integrity, syntax, ownership, server и archive checks подтверждались отдельными командами. Единый aggregate audit был прерван внешним 300s timeout на syntax stage после прохождения предыдущих стадий; это не классифицировано как project failure.
