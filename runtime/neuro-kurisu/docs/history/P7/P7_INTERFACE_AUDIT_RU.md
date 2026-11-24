# P7 Interface Audit

## Main dashboard
Проверены элементы:
- refresh
- chat form/send
- sleep
- wake
- listen
- speak
- snapshot
- 2D viewer
- state cards
- network panel
- neuromodulation panel
- memory graph panel
- evolution panel

## HTTP handlers
- GET `/`
- GET `/app.js`
- GET `/style.css`
- GET `/avatar.html`
- GET `/api/health`
- GET `/api/metrics`
- GET `/api/organism/status`
- GET `/api/organism/inspect`
- GET `/api/organism/avatar`
- POST `/api/organism/chat`
- POST `/api/organism/sleep`
- POST `/api/organism/wake`
- POST `/api/organism/voice/speak`
- POST `/api/organism/voice/listen`

## 2D
В canonical clean build нет зависимости от стороннего Live2D runtime. Поэтому 2D viewer реализован как локальный CSS/HTML fallback, который читает тот же organism state. Legacy Live2D assets остаются в `legacy-original/` и не влияют на canonical runtime.

## Smoke result
`UI_SMOKE=PASS`
