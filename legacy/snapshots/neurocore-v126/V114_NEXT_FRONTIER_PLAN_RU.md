# Следующий фронт после V114

1. State-aligned optimizer update correction: согласовать применённый update и AdamW state, не создавая второго optimizer owner.
2. Long-horizon 16/32/64/128/256 с одинаковыми initial states и несколькими seeds.
3. Event-bank promotion gate на multi-event interference + noisy target + capacity pressure.
4. Проверка rank 8/12/16/24/32 совместно с temporal credit и mobile CPU profile.
5. Измерение реальной энергоёмкости/latency на Android после стабилизации архитектуры.
