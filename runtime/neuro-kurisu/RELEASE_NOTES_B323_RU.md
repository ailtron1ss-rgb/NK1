# RELEASE NOTES B323 — Process Kill / Resume

B323 усиливает persistence proof от обычного process restart до принудительного `SIGKILL` и последующего продолжения в новом Node-процессе.

## PASS

`test:big-pass-323:kill-resume`:
- tick 3 до SIGKILL;
- новый process session 2;
- final tick 7;
- learning 7;
- closures 7.

Regression:
- B318 PASS
- B320 PASS
- B321 PASS (`HOST_ONLY`)
- typecheck PASS

Физическая Android-сертификация остаётся открытой до запуска B321 на реальном устройстве.
