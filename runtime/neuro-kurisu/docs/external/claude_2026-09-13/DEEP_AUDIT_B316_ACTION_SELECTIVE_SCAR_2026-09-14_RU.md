# Neuro-Kurisu B316 - Action-Selective Contextual Scar

Дата: 14 сентября 2026

## 0. Источник истины

В работе сохранено правило, которое повторяется в исторических Claude-документах и уже подтверждено текущим проектом: executable evidence имеет приоритет над историческими утверждениями. Поэтому B316 не объявляет незапущенные агрегатные цепочки PASS.

Проверены также четыре внешних PDF в `docs/external/claude_2026-09-13/`:
- `AUDIT_CLAUDE_B266_35_6_1_RU.pdf`
- `BIG_PASS_CHAIN_B267_B330_RU.pdf`
- `BRAIN_BRANCH_CHAIN_PLAN_CLAUDE_RU.pdf`
- `DEEP_PROGRESS_AND_PLAN_CLAUDE_RU.pdf`

Из них повторно подтверждены три постоянных требования: реальная проверка кодом, отдельный physical Android/Termux gate и низкая доказательность consciousness. B316 не отменяет ни одно из них.

## 1. Что именно найдено в B315

B315 уже доказал, что canonical B285 может хранить scar по контексту и переносить его на соседний контекст. Но внутреннее представление контекстного scar было слишком грубым: один контекстный scalar мог влиять на разные действия почти одинаково.

Это создавало риск неправильного обобщения:

`плохой опыт respond` -> `слишком сильное предупреждение против explore/verify/...`

Такой механизм был функциональным, но недостаточно точным.

## 2. Что изменено в B316

B316 не создаёт новый memory owner и не создаёт новый learner.

В существующем B285 `scarContextStates` добавлено additive поле `actionNegative01`, содержащее bounded state для каждого из существующих действий:

`respond / explore / verify / rest / reflect / wait / defer`

При негативном verified outcome:
- глобальный scar продолжает обновляться;
- context scar продолжает обновляться;
- дополнительно растёт только action-specific scar выбранного действия.

При corrective evidence:
- глобальный scar постепенно восстанавливается;
- context scar восстанавливается;
- action-specific scar того же действия ослабляется сильнее, чем unrelated actions.

При actionBias:
- exact context получает полный bounded signal;
- соседний context получает только предусмотренный transfer weight;
- unrelated action больше не получает тот же локальный scar просто из-за совпадения контекста.

## 3. Почему это крупнее обычного патча

B316 меняет качество представления опыта, а не количество файлов.

Раньше B315 отвечал на вопрос: "была ли плохая ситуация в похожем контексте?"

Теперь B316 отвечает более точно: "какое именно действие в этом контексте оказалось плохим, насколько это подтверждено и насколько это предупреждение должно переноситься?"

Это улучшает связь:

`verified outcome -> autobiographical consolidation -> contextual scar -> action arbitration`

и делает это без второго memory ledger.

## 4. Доказательство

Canonical B285:
- 48 verified negative outcomes для `respond`;
- action-specific scar `respond = 0.730736`;
- unrelated `explore = 0`;
- `respond` action bias = `-0.217728`;
- `explore` action bias = `+0.001609`;
- neighbor context bias for `respond = -0.210594`, то есть меньше exact-context влияния;
- после 24 corrective outcomes того же действия action-specific scar снижается `0.730736 -> 0.081296`;
- restore сохраняет action-specific state.

Live `OrganismCore`:
- 12 verified negative outcomes;
- 4 context states;
- action-specific contextual scar реально появляется;
- B296 neural substrate одновременно выполнил 12 learning updates и 1872 synaptic updates.

Таким образом B316 проверяет не только хранение числа в B285, но и реальную live integration с организмом и существующим B296 neural substrate.

## 5. Что B316 НЕ доказывает

B316 не доказывает:
- сознание;
- субъективное переживание;
- sentience;
- human-level cognition;
- независимую жизнь без внешней тестовой рамки;
- физическое выполнение на конкретном Android-телефоне пользователя;
- P7 independent replication.

## 6. Проверка дублей

Новый owner не появился.

Использованы существующие владельцы:
- B285 - autobiographical/life consolidation and scar;
- AdaptivePolicy - existing policy learning;
- B296 - real executable spiking/plastic neural substrate;
- OrganismCore - live integration.

B316 только расширяет структуру B285 additive action-specific state. Это соответствует правилу "consolidation before multiplication".

## 7. Реальная проблема, которая остаётся

Теперь локальная память опыта стала точнее, но главный P6 bottleneck никуда не исчез: нужен длинный контролируемый closed-loop прогон, где изменение опыта приводит к устойчивому изменению целой action distribution организма, а не только диагностик одного механизма.

Следующая работа поэтому должна уходить от дальнейшего увеличения scar-механизма и переходить к multi-phase autonomous endurance, resource pressure и whole-organism behavioral divergence.
