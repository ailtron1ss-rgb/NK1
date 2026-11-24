# Neuro-Kurisu 34.82.0 — BIG PASS 108

## Основной результат
Cognitive Research Battery усилена до реального session-level experimental firewall.

## Добавлено
- preregistered session schedule, генерируемый детерминированно из protocol seed;
- immutable protocol definition: session schedule больше не мутирует protocol capsule;
- slot-level firewall: outcome принимается только для заранее назначенного task/context/condition/delay/phase;
- terminal session seal: после finalize новые исходы отклоняются;
- external evaluator contract с явным источником результата;
- synthetic-test outcomes запрещены для evaluator API;
- trajectory checkpoint ledger хранит независимый runtime-state hash без превращения его в score;
- persistent bounded sessions/schedules/checkpoints;
- migration 116→117;
- Core integration и restart persistence tests;
- reproducibility audit.

## Научная граница
Никакие внутренние score, runtime-state hash, replay counters или synthetic fixtures не считаются доказательством обучения, субъективности или сознания. Для эмпирического вывода требуются реальные независимые task outcomes.

## Проверка
Typecheck, Pass 107 compatibility, Pass 108 functional/migration/Core integration и reproducibility audit проходят отдельно. Длинный composite audit не считается PASS автоматически при timeout.
