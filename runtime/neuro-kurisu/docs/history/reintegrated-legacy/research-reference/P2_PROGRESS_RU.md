# Neuro-Kurisu Organism Core 2.3.0-p2 — прогресс

## Статус: P2 6/6 (код завершён)

1. Body state + physiology — выполнено.
2. Android/Termux telemetry — выполнено с безопасными timeouts и graceful fallback.
3. Embodied coupling — выполнено: ресурсы тела влияют на homeostasis, attention и action utility.
4. Sleep/wake lifecycle — выполнено с persistent sleep session history.
5. Voice boundary — выполнено через optional Termux TTS/STT; отсутствие API не выдаётся за наличие.
6. Android service/bootstrap surface — выполнено; добавлены service/body-check scripts и API endpoints.

## Честное ограничение

Физические сенсоры не проверяются в контейнере. P2 включает реальные команды Termux:API как bridge, но фактическая доступность зависит от установленного Termux/Termux:API, разрешений Android и модели телефона. Команды имеют timeout, потому что в актуальном upstream есть открытая проблема периодического зависания .

## Версия

Application: 99.80.3
Organism Core: 2.3.0-p2
Organism State Schema: 4
World Schema: 1

## Финальный release gate

P2 functional status: **6/6**.

Static/release checks: PASS.
`verify-organism-p0-release.mjs`: PASS_WITH_WARNINGS only because `package-lock.json` cannot be generated in the offline build environment.
