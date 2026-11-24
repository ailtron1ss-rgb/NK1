# BIG PASS 95 — Second-order Social Mind / Counterfactual Repair

Дата: 2026-09-07
Версия: 34.68.0

## Цель
Углубить существующий SocialMindKernel без создания второго независимого social subsystem: second-order beliefs, counterfactual alternatives, repair signals и self-in-relationship.

## Главный принцип
Evidence Before Interpretation. Собственное действие организма не считается доказательством фактического намерения человека. При отсутствии независимого подтверждения actualIntent остаётся неизвестным.

## Изменения
- SocialMindKernel получил second-order beliefs, bounded counterfactuals, repair proposals и self-in-relationship metrics.
- Outcome learning принимает optional agentAction/actorExpectedAction/repairAttempted.
- Core больше не конвертирует выбранное собственное действие в ложный actualIntent пользователя.
- Social API возвращает second-order beliefs, counterfactuals и repair proposal.
- Добавлен regression test BIG PASS 95.
- Version/release metadata переведены на 34.68.0.

## Что не заявляется
- Нет доказанной Theory of Mind.
- Нет доказанного чтения мыслей/намерений.
- Counterfactuals являются внутренними гипотезами, а не историческими фактами.
- Semantic vision backend остаётся отдельным model backend.
