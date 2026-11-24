# Независимая перепроверка Neuro-Kurisu 35.6.3

## Главный вывод

35.6.3 является реальным развитием нейронной ветви, а не увеличением числа декоративных модулей. Главная новая работа выполнена вокруг B349 Neural Developmental Spine.

## 1. Что реально есть в организме

Простыми словами проект сейчас обладает:

- памятью и долговременным состоянием;
- self-model и identity continuity;
- world-model и prediction;
- goals, agency и personality signals;
- спайковым нейронным субстратом B269;
- пластичностью и outcome learning;
- causal event/credit механизмами;
- persistence/restart continuity;
- developmental learning infrastructure;
- автономными policy/initiative слоями;
- bounded neural residency перед конституционным выбором.

Это уже настоящий исполняемый когнитивно-нейронный организм-эксперимент. Это всё ещё не доказанное сознание и не биологическая симуляция мозга.

## 2. Что проверено в этом проходе

### Neural substrate
B269 продолжает реально менять spike/synaptic state и участвовать в общей neural branch.

### B349 learning
В standalone эксперименте 158 outcome updates дали устойчивое изменение action-specific neural weight/bias.

### B349 residency
Late residency после обучения действительно изменилась:
- before: ~0.05221
- after: ~0.05282

Это небольшой, но измеримый effect. Он специально bounded.

### Persistence
Новые B349 residency fields имеют backward-compatible normalization. Старый snapshot без новых полей восстанавливается в корректное состояние.

### Core integration
B349 вызывается внутри основного cognitive cycle и сохраняется в organism persistence.

## 3. Что обнаружено как проблема

### Общий runtime слишком тяжёлый
8 mobile-profile cycles проходят примерно за 16 секунд на текущем host runtime с RSS около 234 MB. Более длинные прогоны выходят за контрольное окно.

Это означает, что следующий крупный апдейт должен уменьшать стоимость cognitive cycle.

### Global typecheck / syntax audit
Оба глобальных прохода превышают контрольное окно. Это не доказательство ошибок, но плохой verification latency.

### Neural causality ещё не полностью доказана на конечном выборе
B349 реально учится и реально вносит late residual, но нужен одинаковый A/B experiment:
normal neural residency vs disabled neural residency → same observations → compare final selected actions and future learning.

## 4. Дубли

Сейчас neural branch содержит несколько специализированных уровней:
B269, B289, B293, B294, B296, B349.

Они не считаются полными дублями:
- B269 = dynamics;
- B289 = integration;
- B293 = prediction;
- B294 = causal event/credit;
- B296 = personality/agency readout;
- B349 = developmental consolidation + action-specific learning + late residency.

Дальнейшее добавление новых neural B-модулей без удаления/слияния существующих запрещать на уровне архитектурного правила.

## 5. Реальная следующая цепь

world/sensory state
→ recurrent neural dynamics
→ prediction
→ self/world representation
→ goal/agency
→ candidate actions
→ B297/B291 executive layers
→ B349 late neural residency
→ constitutional arbitration
→ selected action
→ world outcome
→ temporal credit
→ plasticity
→ persistence
→ future decision.

## 6. Что должно считаться следующим доказательством

Не увеличение score и не новый документ.

Следующее сильное доказательство — один и тот же организм в A/B режиме, где выключение B349 residency меняет конечный выбор или long-horizon trajectory, а включение восстанавливает его при тех же входах.
