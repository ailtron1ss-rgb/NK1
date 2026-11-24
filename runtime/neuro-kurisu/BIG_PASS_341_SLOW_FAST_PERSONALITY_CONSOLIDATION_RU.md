# BIG PASS 341 — Fast/Slow Personality Consolidation
Дата: 2026-09-14
Версия: Neuro-Kurisu 35.6.1

## Зачем этот шаг

B340 доказал, что self-model и endogenous-goal quality меняют plasticity личности. При перепроверке оставалась архитектурная слабость: personality phenotype практически имел один пластичный уровень веса. Это позволяло быстро изменять предпочтение, но не разделяло краткосрочную адаптацию и долгосрочное закрепление.

## Реальное изменение организма

В B299 `CausalPersonalityDevelopmentLoop` введён двухскоростной personality substrate:

- `preference11` — быстрый адаптационный вес;
- `consolidatedPreference11` — медленный устойчивый вес;
- `consolidationEvidence01` — накопленная уверенность, что изменение заслуживает долгосрочного закрепления.

Decision bias использует их совместно. Поэтому единичный опыт не переписывает личность мгновенно, а повторяемый подтверждённый опыт постепенно переносит изменение в slow layer.

Новый механизм:

`experience -> fast personality adaptation -> evidence/stability -> slow consolidation -> future personality decision bias`

При противоположном опыте fast-layer может сменить знак быстрее, чем slow-layer, что создаёт контролируемую инерцию личности вместо мгновенного переписывания.

## Unit evidence — PASS

Сценарий одного отрицательного эпизода:
- fast = `-0.039959`
- slow = `-0.000448`

36 повторяющихся положительных эпизодов:
- fast = `1.000000`
- slow = `0.323767`
- consolidation evidence = `0.321851`

После 36 положительных и 36 противоположных эпизодов:
- fast = `-0.619466`
- slow = `0.159420`
- consolidation evidence = `0.564630`

Это подтверждает slow/fast dissociation и отсутствие мгновенного стирания долгосрочного веса.

## Live OrganismCore — PASS

24 реальных runtime ticks.

- personality learning updates = `24`;
- fast personality magnitude = `0.417990`;
- slow consolidated personality magnitude = `0.057103`;
- consolidation evidence = `0.146336`;
- personality decision bias до обучения = `0`;
- после обучения = `0.029769`.

Следовательно новое slow personality state действительно доходит до decision surface.

## Регрессии

PASS:
- B340 unit;
- B340 live Core;
- B341 unit;
- B341 live Core;
- TypeScript typecheck;
- core ownership;
- architecture;
- integrity;
- release contract;
- executable syntax.

## Что теперь реально улучшилось

До B341 personality learning был в основном быстрым adaptive process. После B341 организм получает динамику:

`быстрая адаптация -> накопление уверенности -> медленная консолидация -> устойчивая индивидуальная склонность`.

Это приближает систему к developmental plasticity: краткосрочные состояния и долгосрочные черты перестают быть одним и тем же временем памяти.

## Что НЕ доказано

Не доказаны сознание, субъективный опыт, human-level personality или Android runtime. Не доказан ещё длинный unseen-task holdout, показывающий, что slow personality layer стабильно меняет поведение на новых задачах после restart.

## Следующий крупный функциональный шаг

Не добавлять ещё один isolated module. Провести developmental holdout:

`baseline -> repeated experience -> slow consolidation -> restart -> unseen context -> action-distribution shift -> ablation slow personality -> loss of the learned shift`.

Именно этот тест должен показать, стала ли история организма частью его будущей индивидуальности.
