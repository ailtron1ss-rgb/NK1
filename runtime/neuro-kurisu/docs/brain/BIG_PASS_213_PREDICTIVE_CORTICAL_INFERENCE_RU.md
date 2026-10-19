# BIG PASS 213 — Замкнутый predictive-cortical inference, precision control и selective abstention

Дата: 2026-09-11
База: Neuro-Kurisu 35.6.1 / B212
Статус: IMPLEMENTED + VERIFIED PASS

## 1. Цель

B213 переводит B212 из локального механизма конкуренции/стабилизации в замкнутый обучающий контур. Корковый слой теперь не только сравнивает вход и prediction, но и сохраняет route-specific posterior, precision и error history; после внешнего outcome эти параметры ограниченно корректируются и затем проверяются на независимом holdout-сценарии.

Главный принцип: prediction learning не должен заменять внешнюю реальность внутренней моделью. Поэтому обучение bounded, selective и persistence-aware, а низкоуверенные/противоречивые варианты получают abstention risk вместо безусловного усиления.

## 2. Что добавлено

`src/organism/system/CorticalHierarchyEngine.ts` получил:

- route-specific predictive posterior;
- bounded learned/prior blend, зависящий от количества образцов и precision;
- precision-weighted prediction error;
- calibration score;
- selective abstention risk;
- information-gain estimate для приоритизации неожиданной информации;
- event-triggered learning: микроскопические и малосюрпризные ошибки пропускаются, чтобы не тратить мобильный compute на бессмысленную мутацию состояния;
- backward-compatible restore для старых route models без новых полей.

Это computational mechanism, а не утверждение биологической эквивалентности.

## 3. Реальный holdout-результат

Тренировочный контур получил 24 outcome updates для route `explore`, после чего был подан новый route-сценарий, не участвовавший в этих update-вызовах.

До обучения:

`predictionError01 = 0.1978673758`

После обучения:

`predictionError01 = 0.0896928676`

Снижение absolute error: примерно `54.65%` в данном тестовом сценарии.

Обученный posterior:

`0.6221425437`

при исходном входном prediction `0.48`, в сторону наблюдавшегося outcome около `0.72`.

Calibration:

`0.8754077135`

Selective abstention risk:

`0.1895090873`

Таким образом, обучение меняет последующее поведение на holdout, а не только внутренний счётчик samples.

## 4. Причинный proof

Для отдельного trained/holdout сравнения:

`causalDelta01 = 0.1951036295`

где сравнивается trained predictive route с cold route.
Posterior:

- trained: `0.6438094217`
- cold: `0.48`

Это подтверждает причинное влияние learned posterior на route output.

## 5. Event-triggered learning

При `targetError < 0.06` и `surprise < 0.12` update пропускается.

B213 отдельно проверяет этот режим и подтверждает:

- `predictiveUpdates = 0`
- `predictiveSkips = 1`

для тихого события.

Это не биологический claim; это engineering policy для экономии CPU/memory write pressure на телефоне.

## 6. Интеграция с организмом

Текущая цепочка остаётся:

`compute governor -> thalamic gate -> cortical hierarchy -> cortical microcircuit -> cerebellar calibration -> basal ganglia -> P61/P64 arbitration`

B213 изменяет внутреннюю predictive state коры, а downstream arbitration по-прежнему остаётся главным ограничителем действия.

Selective risk не может сам по себе заставить систему выполнить действие: он входит в bounded cortical gain, тогда как финальная arbitration остаётся ниже по контуру.

## 7. Persistence и совместимость

Проверено:

- `OrganismCore` сохраняет predictive metrics;
- restart восстанавливает `predictiveUpdates` и `predictiveSkips`;
- старый route model без `posterior01` и `precision01` успешно мигрирует через sanitize/restore.

Это предотвращает разрушение сохранённого мозга при добавлении новых состояний.

## 8. Научная перепроверка

B213 опирается на несколько независимых направлений:

1. Predictive coding: top-down prediction + bottom-up error как способ ограничивать обработку и концентрировать compute на неожиданном сигнале.
2. Dynamic sparsity: selective updates и attention/gating как путь к уменьшению вычислительной нагрузки на edge/mobile systems.
3. Uncertainty-aware inference: полезность explicit uncertainty/abstention для систем, которые должны знать границы собственной уверенности.
4. Adaptive precision/resource allocation: изменение вычислительной глубины и ресурса в зависимости от качества сигнала и состояния системы.

Системные решения B213 не выдаются за доказанную биологическую реализацию этих механизмов.

## 9. Ограничения

B213 не доказывает сознание, субъективный опыт или биологическую кору.

54.65% improvement относится только к заданному synthetic holdout test; это не переносится автоматически на реальные задачи, пользователя, устройство или батарею.

Реальная экономия энергии по-прежнему требует device-level measurement на целевом Android/Termux устройстве.

## 10. Дополнительный инженерный результат

Во время release-аудита обнаружен дефект самого аудитора `scripts/audit-full-project.mjs`: использование spread в `Math.max(...lines.map(...))` приводило к `RangeError: Maximum call stack size exceeded` на большом проекте.

Исправлено на итеративный `reduce`. После исправления:

`AUDIT_FULL = PASS`

без ошибок и предупреждений.

Это не косметический фикс: теперь полноразмерный release-аудит действительно может пройти на текущем масштабе проекта.

## 11. Release evidence

- B212 regression: PASS
- B213 predictive holdout: PASS
- Typecheck: PASS
- Architecture: PASS
- Integrity: PASS
- Hygiene: PASS
- Syntax: PASS
- Release contract: PASS
- Forensics: PASS
- Release source: PASS
- Lockfile: PASS
- Full project audit: PASS
- Brain audit: PASS
- Function liveness: PASS
- Parameterized function probe: PASS
- Semantic coverage: PASS
- Function passports: PASS

На текущем снимке function passport сообщает:

- total functions: `2746`
- VERIFIED: `14`
- INTEGRATION_ONLY: `27`
- UNSAFE_TO_AUTO_RUN: `129`
- UNVERIFIED: `2576`

Semantic coverage audit отдельно видит более широкий corpus из `2759` function-like entries и потому не должен смешиваться с strict Function Passport count.

## 12. Следующий этап

B214: замкнуть thalamo-cortical loop — сделать learned cortical posterior совместимым с routing/gating состоянием таламуса и проверить, что predictive learning улучшает не только local cortical score, но и downstream information routing, при этом не создавая runaway feedback loop.
