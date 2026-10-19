# NeuroCore V109 — Changelog

- Добавлен parameter-free consensus feedback между уже существующими ветвями trunk.
- Feedback строится из predictive/world/self/memory/multiscale через agreement-weighted consensus и не создаёт второго recurrent state owner.
- Default `synergy_feedback_strength=0.0`, поэтому базовая математика V108 сохраняется; кандидат продвигается только после benchmark gates.
- Исправлен checkpoint migration threshold: V108 теперь явно считается legacy относительно V109.
- ABI current trunk/core повышен 8 → 9.
- Исправлен public `__all__` для delta integrator.
- Исправлено диагностическое сообщение GradientArbitrator для `anchor_project`.
