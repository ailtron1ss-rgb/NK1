# B383 — Контекстная память → противоречие → ревизия личности

Дата: 2026-09-16
Release: 35.6.33
State schema: 137

## Цель

B383 развивает single causal spine проекта без создания нового decision owner. Новый слой расширяет B382 contextual developmental memory и связывает её с allostatic personality traits внутри canonical B365.

Главная цепочка:

`verified experience → context index → retrieval → contextual value → contradiction hypotheses → resolution → personality trait revision → future B365 policy`

## Что изменено

1. Контекстные профили получили positive/negative evidence, stable score и bounded history.
2. Добавлен ограниченный hypothesis layer для конкурирующих интерпретаций одного context/action.
3. Добавлен explicit contextual memory query.
4. Добавлен explicit contradiction resolution.
5. Verified contextual experience может причинно менять curiosity/caution/persistence/noveltySeeking/restSeeking/socialAttunement.
6. Unverified experience остаётся заблокированным.
7. Contextual memory и hypotheses persistent/restart-safe.
8. B365 остаётся единственным canonical neural decision owner.

## Почему это важно для цели Kurisu

Личность не должна быть декларативным набором traits. Она должна постепенно становиться следствием истории, памяти, целей, self-model и адаптации. B383 закрывает дополнительное звено: не просто «опыт изменил среднее предпочтение», а «опыт в данном контексте изменил локальную гипотезу и затем причинил устойчивую ревизию personality traits».

## Causal evidence

B383 memory causal:
- context separation L1-like probability difference: ~0.5594;
- near-context delta: ~0.000327;
- explicit memory queries: 1;
- retrievals during policy evaluation: 3;
- contradictions: 51;
- contradictions resolved counter: 276;
- personality adaptations: 218;
- trait impact: ~0.001418;
- pre-conflict history knockout delta: ~0.5573;
- restart delta: 0;
- unverified learning blocked.

B383 runtime:
- verified contextual adaptations: 80;
- restart exact equality: PASS;
- unverified blocked: PASS.

B383 performance, 2000 cycles:
- p50 ~0.713 ms;
- p95 ~3.546 ms;
- p99 ~6.630 ms;
- max ~34.20 ms;
- heap ~18.04 MiB.

## Known limitation

После специально введённого сильного alternating contradiction profile value возвращается близко к неопределённости. Поэтому knockout после contradiction может быть малым. Главный causal knockout измеряется ДО conflict-resolution, когда history должна быть причиной отличающейся policy.

Реальный Android/Termux physical certification в этой среде отсутствует и не подменяется host simulation.
