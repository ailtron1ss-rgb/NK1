# Глубокий аудит B300 — контекстное развитие личности

Дата: 13.09.2026
База: Neuro-Kurisu 35.6.1 / B299 causal-personality bridge
Статус: внедрено в исходники; основной B300 gate проходит. Полный legacy/runtime suite не объявляется полностью зелёным из-за тяжёлого 40-cycle harness.

## 1. Почему выбран B300

Предыдущая перепроверка подтвердила, что B296 действительно выполняется как компактная recurrent spiking/plastic substrate: есть мембранные состояния, пороги, refractory, pre/post traces, eligibility traces, рекуррентные sparse synapses, neuromodulation, STDP-подобный third-factor update, action readout, structural maintenance и lesion.

B299 поверх него уже учился на живых outcomes и менял action bias. Но ранний long-horizon эксперимент показал важный риск: глобальная preference для действия может стать слишком грубой. Например, серия неудачных `respond` не должна автоматически означать «личность не любит отвечать» во всех обстоятельствах.

Поэтому B300 не добавляет ещё одну «личность». Он разделяет credit assignment внутри уже существующего B299.

## 2. Что реально изменено

B299 теперь хранит для каждого действия:

- глобальную preference;
- четыре контекстных preference: social, epistemic, autonomy, maintenance;
- отдельные уровни контекстного evidence.

В каждом живом цикле OrganismCore вычисляет общий контекст из уже существующих сигналов системы: social need, uncertainty, prediction error, novelty pressure, autonomy, energy, cognitive load, наличие внешнего текста и user-requested action.

Перед выбором действия контекст передаётся в единый B299 bridge. После outcome тот же context используется для credit assignment.

Таким образом цепочка стала:

`world/self signals → B296 neural state → executive/action candidates → B299/B300 contextual personality bias → action → outcome → causal/evidence gate → contextual personality update → existing MultiHypothesisPersonality`

Это один контур, а не параллельные personality stores.

## 3. Почему это не декоративное изменение

Изолированный B300 test провёл 80 контекстных updates для одного и того же action `respond`.

Результат:

- social context preference: +0.7867;
- epistemic context preference: -0.5696;
- social action bias после обучения: +0.0691;
- epistemic action bias после отрицательного опыта: -0.0654;
- context credit assignments: 80.

То есть система научилась разделять один и тот же action по контексту.

Это не доказывает человеческую личность и не доказывает сознание. Это доказывает работающий механизм контекстного причинного влияния на поведение.

## 4. Живой runtime evidence

24 live cycles на `OrganismRuntime` / mobile profile:

- B299 cycles: 24;
- B299 learningUpdates: 24;
- verifiedUpdates: 24;
- autonomousUpdates: 20;
- B300 contextCreditAssignments: 24;
- personality influence: 0.03247;
- personality stability: 0.78857;
- self-authored development: 0.43801;
- causal integrity: 0.60343;
- learned action-bias magnitude: 0.02112;
- lesion .95 reduced it to 0.001056.

Это подтверждает, что B300-путь вызывается не только в standalone unit test: он проходит через живой runtime.

## 5. Что осталось неизменным и почему

B296 не заменён B300. Это важно: B300 не имитирует spiking neural substrate, а использует его как один из входов пластичности. В B296 остаётся фактическое обновление синапсов.

B299 не превратился во второй personality ledger. Его causal outcome может по прежнему передаваться в существующий MultiHypothesisPersonality, но только после evidence/causal gate.

## 6. Дубликаты и архитектурный контроль

При проверке не добавлялся второй общий personality database. Контекстные поля являются продолжением B299 action phenotypes.

Внешняя папка Claude очищена от ранее продублированных canonical audit files; оставлен pointer на их canonical location в `docs/audits/`.

## 7. Что B300 НЕ доказывает

- не доказано сознание;
- не доказана субъективность;
- не доказана человекоподобная мотивация;
- не доказана долговременная независимая автономия на днях/неделях;
- физический Android/реальный сенсомоторный контур не доказан;
- полная мобильная память/CPU готовность не доказана.

## 8. Следующий крупный этап

Следующий этап должен закрывать mobile state economy и долгосрочную causal consolidation, а не добавлять ещё один personality module. Главная задача: уменьшить стоимость snapshot/checkpoint и отделить canonical cognitive state от cache/history, сохраняя causal evidence. После этого нужен unseen-context transfer test: показать, что изученная контекстная preference переносится в новый, неиспользованный ранее сценарий.


## 9. Перепроверка документов Claude

Снова просмотрены актуальные MD-документы в `docs/external/claude_2026-09-13/` и визуально проверены первые страницы PDF `DEEP_PROGRESS_AND_PLAN_CLAUDE_RU.pdf` (57 стр.) и `BIG_PASS_CHAIN_B267_B330_RU.pdf` (42 стр.). Старые рекомендации об autonomous live cycle, verification debt и необходимости проверять функцию поведением остаются полезными. Плановые номера B267→B330 уже не являются текущей последовательностью и поэтому не копируются обратно в код.
