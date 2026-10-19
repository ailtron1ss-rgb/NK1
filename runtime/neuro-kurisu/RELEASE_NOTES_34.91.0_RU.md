# Neuro-Kurisu 34.91.0 — BIG PASS 117

Этот релиз делает следующий шаг после predictive transfer: вместо разрозненных механизмов world/self learning и skill learning появляется единый causal development loop.

Ключевое изменение: подтверждённый outcome теперь может пройти по цепочке `causal evidence → self/world learning signal → cross-context transfer → holdout → skill evidence`, причём transfer остаётся bounded и evidence-gated.

`ProceduralSkillLibrary` поднята до schema v8: подтверждение навыка требует разнообразия контекстов, а не только повторения одного случая.

Добавлен отдельный persistent `CausalDevelopmentLoop`, который связывает уже существующие системы без создания второго canonical world model или второго policy engine.

Встроены regression tests `BIG_PASS_117` и `BIG_PASS_117_CORE`.

Релиз остаётся research-release. Полученные holdout/transfer значения не являются доказательством сознания.
