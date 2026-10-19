# V115 — актуальные research sources

1. **Gated DeltaNet-2 — Decoupling Erase and Write in Linear Attention**  
   Paper: https://arxiv.org/abs/2605.22791  
   Official code: https://github.com/NVlabs/GatedDeltaNet-2  
   Использован как reference для channel-wise erase/write и memory-editing semantics.

2. **Preconditioned DeltaNet**  
   Paper: https://arxiv.org/abs/2604.21100  
   Code: https://github.com/ntumm120/preconditioned-deltanet  
   Использован для проверки curvature-aware / online-regression preconditioning.

3. **Kalman Delta Networks — Uncertainty-aware Associative Memory** (2026-09-07)  
   Paper: https://arxiv.org/abs/2609.07816  
   Code: https://github.com/ngocbh/kalman-delta-networks  
   Использован как reference для uncertainty-aware write gain и явного uncertainty state.

4. **Mamba-3**  
   Paper: https://arxiv.org/abs/2603.15569  
   Code: https://github.com/state-spaces/mamba  
   Использован как recurrent/SSM reference; не интегрирован автоматически.

5. **TTTLA / Test-Time Learning as Learned Linear Attention**  
   Paper: https://arxiv.org/abs/2602.21204  
   Official code: https://github.com/nv-tlabs/tttla  
   Использован для анализа связи test-time updates и recurrent linear-attention substrate.

6. **Titans — Learning to Memorize at Test Time**  
   Paper: https://arxiv.org/abs/2501.00663  
   Использован как reference для long-term test-time memory и surprise-driven memorization.

7. **Cascading Eligibility Traces**  
   Paper: https://arxiv.org/abs/2506.14598  
   Использован как reference для temporally focused eligibility dynamics; текущий cascade является независимой реализацией.

8. **Gradient-Update Alignment (GUA)**  
   Paper: https://arxiv.org/abs/2609.01558  
   Code: https://github.com/JingXiao10/GUA  
   Использован для анализа рассогласования между objective gradients и фактическим optimizer update.

9. **Raven — sparse persistent-memory routing**  
   Code: https://github.com/goombalab/raven  
   Использован как reference для selective/sparse persistent state updates.

## Правило источников
Внешний paper или repository не является доказательством полезности механизма для NeuroCore. Перед promotion обязательны локальная реализация или воспроизводимый probe, matched baseline, ablation, multi-seed, stress/interference и resource evidence. Лицензия и происхождение заимствованного кода должны быть проверены отдельно.
