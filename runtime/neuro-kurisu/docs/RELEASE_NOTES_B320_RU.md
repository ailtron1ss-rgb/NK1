# RELEASE NOTES B320 — Mobile Durability

Добавлен адаптивный durability governor для file-backed persistence.

Новая команда:

`npm run test:big-pass-320`

Ключевые изменения:

- `PersistenceDurabilityGovernor`;
- интеграция adaptive dirty-cycle window в `OrganismCore`;
- battery-risk tightening;
- large/slow-state write-cost widening;
- thermal/RAM pressure widening;
- устранён off-by-one на границе dirty-cycle window;
- end-to-end B320 test на реальном durable file.

Verified in this release:

- typecheck PASS;
- B317 PASS;
- B318 PASS;
- B320 PASS.

B319 crash matrix remains separately verified from B319 release; full B319 rerun after B320 is intentionally not promoted to a new PASS because the aggregate exceeds current runtime budget.
