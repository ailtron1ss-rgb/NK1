# BIG PASS 122 — PERSONAL CURRICULUM / AUTOBIOGRAPHICAL-SOCIAL LEARNING

## Что внедрено

Neuro-Kurisu получила новый связующий слой `PersonalCurriculumEngine`, который не заменяет память, социальный mind, P67 или Meta-Developmental layer. Он извлекает из уже существующей жизненной истории компактные learning threads и возвращает их обратно в управление развитием.

Контур:

`автобиографический эпизод + социальный исход + цель + causal evidence -> learning thread -> priority -> meta learning allocation -> goal genesis pressure -> следующее действие -> новый outcome`.

### Новые возможности

- устойчивые autobiographical learning threads;
- связь истории результата с identity/social relevance;
- context diversity и verified evidence;
- retention/transfer readiness внутри personal curriculum;
- ranking активных целей по исторической полезности;
- возврат curriculum pressure в P67 Autonomous Goal Genesis;
- ограниченное влияние recommended learning action на action arbitration;
- persistent state + restart recovery;
- runtime diagnostics API через `OrganismCore`.

## Измерения

Новый unit test:

- 1 persistent learning thread;
- 8 различных contexts;
- priority ≈ 0.507;
- learning need ≈ 0.414;
- curriculum pressure ≈ 0.344;
- identity learning ≈ 0.304;
- persistence round-trip PASS.

Core regression:

`BIG_PASS_121_CORE=PASS`

## Ограничения

Это механизм управления обучением и автобиографической непрерывностью, а не доказательство сознания. Personal curriculum не утверждает причинность только по соседству событий; causal signal должен приходить из уже существующих evidence-first систем.

## Следующий крупный рубеж

Связать personal curriculum с реальными мультимодальными эпизодами, социальными последствиями и долгосрочными целями так, чтобы learning threads формировали измеряемые policy/skill changes на новых holdout-задачах.

## Дополнительное усиление runtime surface

В рамках того же прохода добавлены рабочие внешние bridges:

- `/api/organism/personal-curriculum`;
- `/api/runtime/evidence`;
- `/api/organism/subsystems`;
- `/api/organism/projects/active`;
- `/api/organism/projects/tool`;
- `/api/organism/projects/step`.

`OrganismRuntime` получил реальный `executeNextProjectStep` bridge. Исторический BIG-PASS progress audit после синхронизации контрактов: **169/169 PASS**.
