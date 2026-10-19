# Neuro-Kurisu — B378 Recheck Audit

Дата: 2026-09-15
Релиз: 35.6.28

## 1. Цель проверки
Перепроверить физический action/outcome контур после B377 и устранить ложное повышение evidence-класса, при котором успешная actuator-команда могла считаться физически verified лишь из-за свежей post-action телеметрии.

## 2. Реализовано
- `EmbodiedRealityClass` расширен классом `device-actuation`.
- Для каждого embodied outcome записывается `verificationMode`.
- `explore/verify/wait/inspect` могут стать `independent-observation` только при свежем independent Android/Termux post-action measurement.
- `respond` на живом устройстве фиксируется как `actuation-receipt-only`; verified effect остаётся false.
- `rest` фиксируется как `derived-state-transition`, verified effect false.
- Старые persisted states нормализуют отсутствующий `verificationMode` без потери данных.
- Schema поднята 131→132.

## 3. Доказательства
- typecheck: PASS
- B378 device-action causal gate: PASS
- B378 performance: PASS
- B368 full runtime B365 causal regression: PASS
- B377 goal arbitration regression: PASS
- B376 goal ecology regression: PASS
- B375 goal authorship regression: PASS
- B374 recursive self model: PASS
- B373 allostatic neural personality: PASS
- B372 reality-gated learning: PASS
- B371 active perception: PASS
- B369 replay/consolidation: PASS
- B365 causal core: проходил в последнем регрессионном contract chain; отдельно требуется полный release-gate прогон как финальная стадия.

## 4. Текущее ограничение доказательности
Среда выполнения — host (`node-host`), поэтому физическая Android/Termux certification отсутствует. Это не маскируется fallback-режимом.

## 5. Решение аудита
B378 принят как evidence/causal hardening update. Он уменьшает риск ложноположительной физической причинности и делает последующее подключение реального телефона измеримо более строгим.
