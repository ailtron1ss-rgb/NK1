# Neuro-Kurisu 34.68.0 — BIG PASS 95

## Second-order Social Mind / Counterfactual Repair

Главное изменение: существующий SocialMindKernel расширен, а не продублирован.

Добавлено:
- second-order beliefs о том, какой ответ человек вероятно ожидает от организма;
- bounded social counterfactual alternatives после значимой prediction error;
- social repair proposal;
- self-in-relationship metrics;
- agentAction feedback;
- persistence/recovery для новых данных;
- read-only API для second-order/counterfactual/repair diagnostics.

Критическое исправление truthfulness:
предыдущее сопоставление `selected action -> actual user intent` убрано. Собственное действие организма теперь не считается доказательством фактического намерения пользователя. Без независимого evidence actualIntent остаётся неизвестным.

Проверки:
- typecheck PASS;
- BIG PASS 95 PASS;
- BIG PASS 94/93/92 PASS;
- P26 true learning/world PASS;
- mobile 1000/5000 PASS;
- architecture/contract/project-state/source-truth/legacy/hygiene/forensics/integrity/syntax/core-ownership/server/archive PASS.
