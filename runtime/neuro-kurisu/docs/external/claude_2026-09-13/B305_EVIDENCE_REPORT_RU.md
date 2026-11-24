# B305 Evidence Report
Дата: 13.09.2026

| Метрика | Значение | Простыми словами |
|---|---:|---|
| Critical path ticks | 32 | короткая live-проверка всей цепочки |
| Full cognitive pulses | 16 | 16 раз реально запускался полный cognition |
| Verified world outcomes | 8 | 8 исходов имели внешний/world evidence |
| B296 learning | 16 updates | нейронный пластический цикл учился |
| B296 synaptic updates | 2496 | реально менялись синаптические параметры |
| B299 learning | 16 updates | личность реально получала исходы |
| Policy bias magnitude | 0.02244 | изменение policy уже измеряется |
| Neural→causal | 0.625 | большая часть live neural cycles дошла до causal gate |
| Causal→personality | 0.625 | causal experience дошёл до personality development |
| Personality→policy | 1.0 | наблюдаемые personality updates влияли на bias |
| Policy→outcome | 0.50 | половина measured policy shifts пришла к verified/autonomous outcomes |
| Outcome→persistence | 0.50 | половина таких outcomes была отражена в persistence checkpoints/evidence boundaries |
| Full critical path | 0.475 | цепочка работает, но ещё не закрыта end-to-end |

## Две независимые holdout сессии
Session 0: coherence 0.5424, transfer 0.6200, readiness 0.6063, novel family rate 1.0.
Session 1: использует другой training/holdout split и также сохраняет novel family rate 1.0.

## Termux benchmark
48 ticks: 12 full / 36 micro, mean 23.97 ms, p95 105.25 ms, RSS ~199 MB, payload ~1.96 MB.

Это host-proxy. На Android этот же test launcher собирает реальные `getprop`/Termux/`/proc/meminfo` данные.
