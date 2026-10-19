# B273 — Автономный жизненный цикл целей / иерархия / зарождение навыков

Дата: 2026-09-12
База: B272 Endogenous Goal Genesis
Статус: research-release

## 1. Зачем нужен B273

B272 уже умеет порождать непрерывный эндогенный goal-vector, но цель живёт почти как одноцикловая управляющая переменная. B273 превращает её в длительный жизненный объект:

`goal genesis → commitment → subgoals → plan → action → outcome → progress → revision/completion → skill reuse → next goal`

## 2. Единый контур

`B269 spikes`
→ `B270 self/needs/traits`
→ `B271 autobiographical sequence`
→ `B272 endogenous goal vector`
→ `B273 autonomous goal lifecycle`
→ `action arbitration`
→ `real outcome`
→ `B273 progress/revision`
→ `personality evidence`
→ `skill reuse`
→ `persistent self/goal continuity`

B273 специально не заменяет B264/B267 policy governance. Его action bias ограничен и добавляется к уже существующему decision stack.

## 3. Goal object

Каждая цель содержит:

- 8-D vector;
- parentId;
- source;
- status: candidate/active/paused/completed/abandoned;
- importance;
- urgency;
- confidence;
- progress;
- conflict;
- attempts/successes;
- age;
- subgoal count;
- last reward.

Цель не пересоздаётся на каждом цикле. Состояние удерживается и обновляется bounded blending до тех пор, пока не появится устойчивый конфликт, завершение или доказанный тупик.

## 4. Иерархия

При достаточно выраженном internal goal vector B273 создаёт ограниченный набор subgoals. Subgoals наследуют часть родительского вектора и получают тот же causal lifecycle, но не могут самовольно переписать identity или policy.

## 5. Долгосрочный план

План — это короткая action-sequence длиной 1–4 шага. Первый шаг получает ограниченный bias в общем action arbitration; остальные шаги служат предсказуемой внутренней схемой поведения.

## 6. Skill genesis

Успешная последовательность действий с приемлемой prediction error превращается в skill prototype.

Skill:
- имеет action sequence;
- success/support statistics;
- expected gain;
- use count;
- связывается с goal fingerprint.

На следующих циклах skill может быть переиспользован даже для новой, но совместимой цели. Это отделяет skill learning от фиктивного роста action vocabulary.

## 7. Goal revision

B273 пересматривает цель, когда наблюдается согласованный negative signal:

- высокая prediction error;
- устойчивый conflict;
- низкий independent gain;
- несколько неуспешных попыток.

При revision старая цель переводится в paused/completed состояние, а новая цель строится из модифицированного latent vector.

## 8. Что намеренно ограничено

- action vocabulary остаётся конечным;
- skill prototype не создаёт новый внешний API автоматически;
- goal vector ещё не является самостоятельно возникшей semantic ontology;
- rollout planner пока короткий;
- completion gate использует текущую reward/evaluator инфраструктуру;
- это не доказательство сознания или субъективного опыта.
