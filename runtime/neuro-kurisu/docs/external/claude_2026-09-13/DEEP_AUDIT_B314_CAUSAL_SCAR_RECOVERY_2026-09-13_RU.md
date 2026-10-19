# NEURO-KURISU 35.6.1 — B314 DEEP AUDIT
## Controlled Negative Experience / Causal Scar / Recovery
Дата: 13.09.2026

## 1. Решение этапа
B314 выбран не как новый memory subsystem, а как развитие существующего canonical owner B285 Neural Life Consolidation.

Цель:
`проверенный отрицательный опыт -> controlled autobiographical scar -> action-specific warning -> будущее поведение -> подтверждённый корректирующий опыт -> частичное восстановление`.

Главное правило:
новая ветвь не имеет права владеть собственной долговременной памятью, если соответствующее состояние уже принадлежит B285.

## 2. Что изменено
B285 теперь дополнительно содержит:
- negativeScar01;
- negativeScarConfidence01;
- negativeScarCount;
- recovery01;
- recoveryCount;
- lastScarTick;
- signed scarActionBiases;
- bounded scarHistory.

Добавлены методы:
- `recordNegativeOutcome()`;
- `recordRecovery()`;
- `lesionScar()` / `clearScarLesion()`.

Scar влияет на существующий `B285.actionBias()`, а значит попадает в уже существующую decision chain и не создаёт отдельного policy owner.

## 3. Causal gating
Scar создаётся только при verified evidence и достаточной тяжести ошибки.
Порог зависит от:
- reward/success;
- prediction error;
- importance;
- evidence.

Recovery создаётся только при verified corrective evidence и достаточно высокой future consistency.
Одна положительная реакция не стирает scar полностью.

Это intentional controlled plasticity: сильный опыт изменяет систему, но восстановление происходит постепенно.

## 4. Standalone evidence
B314 standalone test:
- 12 verified negative outcomes для `respond`;
- scar01 = `0.60861456`;
- action-specific scar bias = `-0.04071475`;
- 16 corrective outcomes;
- recovery01 = `1.0`;
- scar after recovery = `0.24592086`;
- lesion removes scar action contribution;
- lesion blocks new scar updates.

После tuning формулы scar больше не мгновенно насыщается 1.0 на короткой серии.

## 5. Live OrganismCore evidence
Live mobile-profile test:
- 16 verified negative world-transition feedback cycles;
- negativeScarCount = `16`;
- negativeScar01 = `0.62706220`;
- action-specific scar bias present;
- restart сохраняет scar count и strength;
- 20 verified corrective outcomes;
- recoveryCount = `20`;
- recovery01 = `0.54795398`;
- scar после recovery = `0.39465422`;
- lesion блокирует дальнейшее увеличение scar.

Это доказывает, что B314 проходит через настоящий `OrganismCore -> feedback -> B285 -> persistence`, а не только standalone class.

## 6. Persistence
Migration test:
- schema `127`;
- marker scar `0.62` сохранён;
- negativeScarCount `7` сохранён;
- recoveryCount `3` сохранён;
- `respond` scar bias `-0.08` сохранён;
- scarHistory сохранён.

Restart/live test также сохраняет реальные B314 values.

## 7. Neural reality
B314 не создаёт второй neural substrate.
После изменений B298:
- 36 learning updates;
- 5616 synaptic updates;
- 71 learned transitions;
- 3 dreams;
- lesion effect;
- restore learning state.

B314 только изменяет downstream autobiographical consolidation owner B285.

## 8. Regression evidence
После B314 отдельно прошли:
- B313 longitudinal divergence — PASS;
- B312 decision handoff — PASS;
- B306 autonomous causal verification — PASS;
- B305 critical path — PASS;
- B298 closed loop — PASS.

B313 сохраняет action distribution divergence:
positive branch `12 explore / 2 verify / 2 respond`;
negative branch `12 explore / 4 verify / 0 respond`.

## 9. Архитектурное решение
Не создавался новый `B314Memory`.
B314 является capability extension существующего B285.

Это уменьшает число competing owners и сохраняет принцип проекта:
`consolidation before multiplication`.

## 10. Ограничения
B314 не доказывает:
- сознание;
- субъективный опыт;
- human-equivalent cognition;
- AGI.

B314 также не доказывает реальный Android performance. Hardware evidence остаётся отдельной задачей.

## 11. Verification debt
Последний semantic coverage:
- total functions `3789`;
- VERIFIED `38`;
- INTEGRATION_ONLY `858`;
- UNSAFE_TO_AUTO_RUN `260`;
- UNVERIFIED `2633`;
- evidenceCoverage `0.0666`.

Это большой оставшийся долг и следующая работа не должна просто добавлять код поверх него.

## 12. Verdict
B314 — реальное функциональное усиление проекта: проверенный отрицательный опыт теперь может становиться ограниченным долговременным action-specific warning внутри существующей autobiographical memory и постепенно ослабляться подтверждённым хорошим опытом.
