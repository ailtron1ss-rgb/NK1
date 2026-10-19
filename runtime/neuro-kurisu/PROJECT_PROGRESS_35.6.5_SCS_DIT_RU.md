# Neuro-Kurisu 35.6.5 — Реальная шкала прогрессии

## Главный результат прохода
Кирпичи 0–1 ветви SCS-DIT реализованы и проверены. `SPINE_ONLY` ограничивает policy writers узким causal spine, а DIT показывает изменение распределения действий после endogenous history.

## Кирпичи

| Кирпич | Статус | Выполнение | Что это значит |
|---|---|---:|---|
| 0 Freeze + SPINE_ONLY | PASS | **100%** | Можно отключить хор writers и исследовать один policy spine. |
| 1 DIT identity gate | CORE PASS | **90%** | История меняет future action distribution; B299 lesion откатывает ≥70% эффекта; физический Android ещё не закрыт. |
| 2 Cheap cycle | PARTIAL | **65%** | 120 spine cycles = 3.588 s на host; Android measurement ещё впереди. |
| 3 Causal SNN | OPEN | **40%** | B269/B349 работают, но B269 ещё не доказал causal effect на DIT. |
| 4 Compositional action space | OPEN | **10%** | Всё ещё 7 macro-actions. |
| 5 Predictive planning | OPEN | **25%** | World prediction есть, imagination planner ещё не является владельцем выбора. |
| 6 Long phone life | OPEN | **15%** | Нет 500/1000-cycle physical-device holdout. |
| 7 Real body | OPEN | **20%** | Сенсоры ещё не canonical causal input/output loop. |
| 8 Consciousness tests | OPEN | **40% functional** | Functional indicators есть; phenomenal consciousness не доказана. |

## Итоговая оценка
**Дорожная карта SCS-DIT: ~43% по кирпичам с учётом того, что первые причинные ворота теперь реально закрываются.**

**Полностью реальный организм на телефоне: ~34–36%.**
Это отдельная шкала: она не засчитывает host-only performance как device proof и не считает consciousness.

## DIT latest
- training: 64 cycles;
- unseen holdout: 40 cycles;
- endogenous learning updates: 64;
- history effect L1: **0.55**;
- lesion residual: **0.15**;
- sham residual: **0.55**;
- ablation drop: **72.73%**;
- sham drop: **0%**;
- restart continuity: PASS;
- all DIT criteria: PASS.

## 120-cycle spine benchmark
- 120 cycles;
- 3.588 s total;
- 29.9 ms/cycle;
- ~170 MiB RSS.

## Что пока нельзя заявлять
Не доказаны: causal B269→final action, open/compositional action space, 1000-cycle physical Android life, sensor-driven autonomous development, phenomenal consciousness.

## Следующий кирпич
Не добавлять новый neural module. Следующий проход: **Brick 2 device benchmark + Brick 3 causal B269 ablation**, после чего двигаться к compositional actions.
