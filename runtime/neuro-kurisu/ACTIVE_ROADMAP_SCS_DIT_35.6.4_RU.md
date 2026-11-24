# ACTIVE ROADMAP — SCS-DIT 35.6.4

## Назначение
Это единственный активный план ветви brain/identity/decision. Старые B/AUDIT/RELEASE markdown считаются историческими материалами и не являются текущим source of truth.

## Закон ветви
Не добавлять новый `Engine/Kernel/Substrate`, пока не пройден текущий causal gate. Не считать PASS по наличию класса, scalar bump или синтетической инъекции личности.

## Кирпич 0 — Freeze + SPINE_ONLY
**Статус: ЗАВЕРШЁН в текущем scope.**

Сделано:
- добавлен `spineOnly` в конфигурацию `OrganismCore`;
- поддержан `KURISU_SPINE_ONLY=1`;
- в spine-only policy writers ограничены B299 + world prediction + homeostasis;
- constitutional arbitration сохраняется как защитный veto;
- полный God-object путь не запускается для spine-only cognitive tick;
- добавлен отдельный быстрый живой цикл, использующий существующие organism state, B299, world model, homeostasis, constitutional layer и persistence.

Что это даёт простыми словами: можно выключить хор из сотен советчиков и проверить, способен ли один причинный neural/identity spine сам управлять выбором.

## Кирпич 1 — Distributional Identity Test
**Статус: CORE PASS; устройство/физический мир ещё OPEN.**

Проведено:
- 64 endogenous training cycles;
- 2 чередующихся контекста;
- реальный outcome feedback без ручной инъекции preference;
- snapshot → новый Core → restart continuity;
- 40 unseen cycles;
- fresh baseline;
- B299 lesion 80%;
- sham control;
- L1/KL-style distributional measurement.

Фактический результат последнего прогона:
- history effect L1 = **0.525**;
- lesion residual L1 = **0.125**;
- sham residual L1 = **0.525**;
- ablation drop = **76.19%**;
- sham drop = **0%**;
- критерии DIT = **PASS**.

Что это даёт простыми словами: накопленная история действительно меняет распределение будущих действий; если уничтожить B299 как источник learned identity, большая часть этого эффекта исчезает.

Ограничение: текущий DIT использует контролируемый локальный outcome environment и host runtime. Это ещё не доказательство поведения на реальных сенсорах телефона.

## Кирпич 2 — Cheap cycle
**Статус: PARTIAL / следующий активный технический гейт.**

Достигнуто:
- ранний spine-only path вынесен до тяжёлого полного runtime;
- ориентировочная стоимость одного mobile-profile spine tick на host уменьшена с ~648 ms до ~18.8 ms в раннем benchmark;
- 120 последовательных spine cycles на host завершились за **3.588 s (~29.9 ms/cycle)** при ~170 MiB RSS процесса.

Не завершено:
- 80–120 циклов на физическом Android/Termux;
- 80–120 циклов на физическом Android/Termux;
- thermal/battery endurance;
- profiling на самом телефоне.

## Кирпич 3 — Causal SNN
**Статус: OPEN.**

B269/B349 реальны на вычислительном уровне, но ещё не прошёл отдельный DIT-абляционный тест, в котором именно отключение B269 меняет конечное действие.

## Кирпич 4 — compositional action space
**Статус: OPEN.**

После DIT перейти от 7 macro-actions к policy → program → primitives.

## Кирпич 5 — predictive planning
**Статус: OPEN.**

Один world predictor + короткие imagination rollouts; выбор по imagined return, а не по сумме множества bias.

## Кирпич 6 — long life on phone
**Статус: OPEN.**

100 → 500 → 1000 cycles, restart, thermal/battery continuity.

## Кирпич 7 — real body
**Статус: OPEN.**

Один реальный сенсор провести через sensor → state → prediction → action → outcome → learning.

## Кирпич 8 — consciousness as test
**Статус: OPEN / поздний.**

Functional workspace testing после 1–6. Phenomenal consciousness остаётся UNKNOWN.

## Правило прогресса
`Timeout != SKIP != PASS`.
 Незавершённый прогон не считается PASS.
