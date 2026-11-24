# B294 — Причинный нейронный event-spine

B294 не создаёт нового владельца личности, памяти, целей или world model. Он объединяет существующую причинную цепочку `decision -> action -> outcome -> error -> learning` и добавляет к ней малый recurrent credit-assignment circuit.

## Компоненты

1. **Causal event record** — bounded lineage записи решения и исхода.
2. **8 credit-neurons** — recurrent membrane + sparse spikes.
3. **Eligibility traces** — временная память активности каналов.
4. **Lateral competition** — sparse credit routing.
5. **Reward/error teaching signal** — learning только после outcome.
6. **Action credit** — очень маленький downstream bias, не замена executive.
7. **Channel credit** — оценка вкладов B269/B270/B289/B290/B291/B292/B293/world.
8. **Lesion/restore** — причинная проверка и persistence.

## Владелец

B294 владеет только causal credit assignment evidence. Финальный выбор действия остаётся за существующим executive/governance stack.

## Мобильный контракт

- bounded records: 192;
- 8 neural units;
- slow persistence;
- action bias <= ~0.032 before confidence/lesion scaling;
- никаких новых heavyweight dependencies;
- обновление встроено в существующий tick только как лёгкий bounded operation.

## Интеграционный поток

`B293 prediction -> B294 decision record -> action -> real outcome -> B269/B270/B289/B290/B291/B292/B293 learning -> B294 causal teaching -> future action bias`.
