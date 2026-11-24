# Release Notes B329 — Causal Promotion Gate

## Главное
B329 добавляет причинный шлюз перед долговременным recovery-strategy promotion.

Новые данные episode:
- causalConfidence01
- counterfactualMargin01
- counterfactualSupport01

Новые счётчики:
- causalBlockedEpisodes
- totalCausalEvaluations

Promotion требует:
- independent evidence;
- causal confidence >= 0.65;
- counterfactual support >= 0.60;
- минимум 3 независимых boot-а.

## Persistence
Исправлена нормализация новых полей в `AdaptivePolicyEngine.restore()` и `StateMigrations`. Теперь causal/counterfactual evidence не исчезает после restart.

## B328 correction
После перепроверки исправлена семантика `reversed`: после первого sign reversal статус больше не возвращается автоматически в `active` при последующих обновлениях того же знака.

## Verified
B329 PASS; B328 PASS; B327 direct PASS; B327 Core safety gate PASS; B326 PASS; typecheck PASS.
