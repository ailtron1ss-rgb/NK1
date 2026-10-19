# Neuro-Kurisu 35.6.0 — Functional Acceptance Sweep

## Цель
Полный поведенческий sweep проекта: не считать функцию работающей по наличию исходника; проверять безопасные функции напрямую, параметризованные функции через semantic contracts, subsystem integration, persistence/restart и runtime/server сценарии.

## Исправления
- P16 world-learning calibration path.
- P35/P41 server/runtime integration contracts.
- P69–P73 snapshotLight compact budget; detailed diagnostics moved under `extended`.
- Functional verification inventory for 2333 function-like declarations.
- Clean test-process handling and source-of-truth release synchronization.

## Статус
Runtime/architectural checks are required to pass before release packaging. Physical Android device-gate and multi-day soak are explicitly not fabricated as container PASS.
