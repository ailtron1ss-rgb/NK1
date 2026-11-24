# P2641–P2658 — исследовательская база и решения

Дата: 18.09.2026

## Почему этот блок выбран

Проект уже имеет world-model routing, task-free transfer, risk recovery, hierarchical skills, continual dream rehearsal и self-optimizing autobiographical memory. Следующий узкий участок — не ещё один изолированный модуль, а **связка этих механизмов в едином developmental loop**: внутреннее давление цели → выбор/перенос → действие → результат → причинный credit → изменение навыка/цели → восстановление → долговременная идентичность.

## Использованные направления исследований

1. **Actionable world models.** Yao et al., 2026: ценность world model должна проверяться тем, улучшает ли он planning/action/learning/evaluation/verification/recovery/data selection, а не визуальной правдоподобностью. Это поддерживает закрытый feedback loop проекта.
2. **Test-time mixture of world models.** TMoW (2026): prototype-based routing и test-time refinement полезны для адаптации к новым доменам. В проекте уже есть task-free prototype routing; P2641 связывает его с developmental state.
3. **SelfMem (2026):** memory strategy должна сама оптимизироваться по feedback. В проекте это уже реализовано в P2627–P2640; новый контроллер не заменяет memory, а потребляет её сигналы.
4. **FOREVER (ACL 2026):** replay лучше привязывать к model-time/изменению модели, а не только к числу шагов. Это соответствует существующему dream rehearsal и forgetting debt.
5. **Conflict-Aware Memory (ACL 2026):** похожие, но противоречивые memories могут ухудшать planning. P2641 поэтому сохраняет negative-transfer/conflict signals вместо безусловного replay.
6. **Replay can increase forgetting (LLA 2026):** replay не является автоматически полезным; состав replay важен. Это причина для gated consolidation и prototype filtering, а не массового replay.
7. **World Action Models / embodied-brain roadmap (2026):** полезна композиция prediction + intervention + verification + physical/tool grounding. Для Neuro-Kurisu это аргумент в пользу cross-layer controller вместо ещё одного монолитного predictor.

## Ссылки

- https://arxiv.org/abs/2609.16697
- https://arxiv.org/abs/2601.22647
- https://arxiv.org/abs/2607.03726
- https://aclanthology.org/2026.acl-long.1144/
- https://aclanthology.org/2026.acl-long.1306/
- https://proceedings.mlr.press/v330/mahdaviyeh26a.html
- https://arxiv.org/abs/2605.12090
- https://arxiv.org/abs/2607.11689

## Правило внедрения

Исследование не считается внедрённым из-за упоминания в отчёте. Оно должно иметь: producer → consumer → state transition → measurable effect → persistence → regression test.
