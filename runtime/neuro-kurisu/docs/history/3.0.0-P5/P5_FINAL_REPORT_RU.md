# Neuro-Kurisu Clean 3.0.0 — P5 Final Report

## Статус

P0, P1, P2, P3, P4 и P5 завершены. P5 не объявляет появление субъективного опыта. Цель P5 — создать и причинно проверить долгосрочную автономную траекторию: собственные проекты, commitments, изменения ценностей и непрерывность идентичности.

## Что добавлено

- SelfProjectEngine: собственные долгосрочные проекты с приоритетом, commitment, прогрессом, setbacks/successes и milestone.
- AgencyDeliberationEngine: отдельный журнал конфликтов внешнего запроса и внутреннего выбора.
- ValueEvolutionEngine: bounded value evolution с evidence threshold, protected floors и применением revision к реальным adaptive values.
- IdentityTrajectoryEngine: траектория идентичности с persistent anchors, continuity и project/value/narrative/authorship continuity.
- AutobiographicalNarrativeEngine: главы автобиографической истории, выводимые из event log и собственных проектов, а не из свободной генерации LLM.
- P5 lesion flags: self-project, agency, value-evolution и identity trajectory можно независимо отключать.
- Schema 6 -> 7 migration.
- Отдельный `research:all`, чтобы тяжёлые исследования не блокировали быстрый release gate.

## Ключевой принцип

LLM остаётся языковым органом. Core формирует состояние, мотивацию, собственные проекты, конфликт целей и выбор; язык реализует уже принятое решение.

## Причинные проверки

P5 lab запускает 3 seeds для baseline и четырёх поражений:

- self-project lesion;
- agency lesion;
- value-evolution lesion;
- identity-trajectory lesion.

Baseline в текущем synthetic run сформировал 6 собственных проектов, 16 value revisions, 144 identity-trajectory samples, 1 narrative chapter и P5 authorship signal ≈ 0.572. Поражения дают ожидаемые нулевые/сниженные значения в соответствующих каналах.

Это архитектурная причинность на синтетической среде, а не доказательство сознания.

## Следующая контрольная точка

После P5 не следует сразу добавлять ещё один слой cognitive coordinators. Следующий шаг — Device Gate и затем долгосрочный P6: intrinsic lifelong learning, социальная модель других агентов, richer world model, self-authored projects с реальными external tools и longitudinal experiments на реальном Android.

## Новый P5 authorship signal

Добавлен `selfProjects.`authorshipScore`: он derived из собственных проектов, commitment, фактических evidence, continuity и завершений. Этот показатель не равен свободной воле и не используется как доказательство сознания; он нужен как причинно тестируемая метрика self-authorship.
