# CHANGELOG V110

- Исправлена реальная ошибка runtime continuity: `prev_latent` теперь сохраняется между одиночными шагами и попадает в runtime checkpoint.
- Synergy feedback усилен до настоящего межветочного консенсуса: вес ветви зависит от сходства со spine и peer-agreement.
- Добавлены `synergy_peer_blend` и `synergy_temperature` как parameter-free research controls.
- Добавлены diagnostics `workspace_disagreement` и `workspace_peer_similarity`.
- Добавлены V110 continuity/consensus tests и benchmark.
- ABI 10, schema 21, neural version 110.
- Default synergy feedback по-прежнему выключен; новые варианты не promoted без квалификации.
