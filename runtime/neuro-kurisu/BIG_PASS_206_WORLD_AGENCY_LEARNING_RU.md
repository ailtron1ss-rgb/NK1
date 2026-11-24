# BIG PASS 206 — World → Agency → Outcome → Learning

## Цель
Перевести проект от доказанной связи `Memory → World` к следующему causal bridge: `World → Agency → Outcome → Learning`.

## Внедрение
Добавлен `src/organism/system/WorldAgencyLearningCausalBridge.ts`.

Bridge:
- собирает live evidence из Core;
- связывает world-confidence, выбранное действие, альтернативу, outcome и learning signal;
- хранит lineage и provenance;
- сохраняется через `StateMigrations`;
- не повышает live candidate до VERIFIED без контролируемого ablation witness.

Интегрирован в `OrganismCore`, persistence snapshot/restore и release pipeline.

## Строгое causal правило
`VERIFIED` разрешён только если одновременно наблюдаются:
1. material difference world ON/OFF;
2. смена выбранного действия;
3. measurable learning delta;
4. подтверждённая смена learning state.

Совместная активность модулей сама по себе не является causal proof.

## Реальный результат
Контролируемый ablation:
- world confidence ON = 0.92;
- world confidence OFF = 0.12;
- CognitiveQuorum score: 0.869 → 0.741;
- causal witness status = `verified`;
- learning delta = 0.08;
- action changed = true;
- learning changed = true.

Live Core:
- 4 causal applications собраны;
- 0 live VERIFIED links — это ожидаемо, потому что live run не является контролируемым ablation.

Restart:
- bridge state сохраняется и восстанавливается без потери записей.

## Regression
PASS:
- TypeScript
- BIG PASS 193
- BIG PASS 197
- BIG PASS 200 Core
- BIG PASS 201
- BIG PASS 202
- BIG PASS 203
- BIG PASS 204
- BIG PASS 205
- BIG PASS 206
- Function Passport Gate
- Architecture
- Integrity
- Hygiene
- Syntax
- Release Contract
- Forensics
- Release Source
- Archive Manifest

## Function Passport
Текущий inventory: 2704 функции.

- VERIFIED: 15
- INTEGRATION_ONLY: 27
- UNSAFE_TO_AUTO_RUN: 129
- UNVERIFIED: 2533

Новые causal классы не объявляются VERIFIED автоматически: для этого требуется индивидуальный function-level proof.

## Следующий шаг
Закрыть `Agency → Action → Outcome → Learning` на уровне настоящего action-ablation/replay, а затем связать его с существующим causal experience, P26 learning и persistence. Цель — получить не просто subsystem correlation, а воспроизводимый causal chain под одинаковыми внешними условиями.
