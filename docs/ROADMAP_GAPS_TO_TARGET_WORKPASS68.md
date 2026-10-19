# Открытые задачи — WorkPass68 (2026-10-19)

## Закрыто в этом проходе

- Убран прямой вызов Termux TTS из `EmbodimentRuntime`; физическая речь проходит через `OrganismCore.executeTool` → ActionGateway.
- Зафиксированы stable `speechEventId` и idempotency key для обычного речевого пути.
- Добавлены честные статусы `completed` / `not-started` / `unknown`; timeout или ошибка после старта процесса остаются ambiguous/reconciliation-required.
- Неоднозначный TTS исход не увеличивает failure streak/cooldown и не создаёт ложного отрицательного learning credit.
- Root/runtime release manifests согласованы на 35.88.0 / WorkPass68.

## P0 — требуется окружение или ещё одна сквозная проверка

- **Dependency-complete install/build:** DNS `EAI_AGAIN` к npm registry препятствует `npm ci`; выполнить чистую установку обоих lockfile, app/runtime typecheck и production Vite build при доступной сети.
- **Real speech target:** на Android/Termux выполнить речь с фактическим аудиовыходом, получить независимое postcondition, проверить тайм-аут после старта, kill/restart, reconnect, late result и duplicate replay. Не считать процессный exit proof of audible playback.
- **Real provider/device actions:** acceptance → потерянный ACK → рестарт → read-only reconciliation → независимый postcondition → replay без повторной мутации.
- **Real browser/Live2D:** desktop/mobile journeys, approval/decline/expiry/changed input/reload/orphan/reconnect/errors, audio cancel и связь lip-sync с playback clock.

## P1 — сохраняются

- Независимый labelled RU/EN memory holdout и BM25 comparison; текущий `recallDelta=0`, vector candidate не продвигается.
- Реальный delayed receipt → independent observation → causal projection → ровно один temporal learning credit после restart.
- Длительная инициатива/интерес, voice-viseme synchronization, actual Live2D parameters, Toolmaker promotion/rollback, GPU 4 GB inference profiling.
- Clean-room restore/rollback, полный source/model/dataset license and SBOM sign-off, 24h минимум / 72h рекомендованный soak.

## Решение

`implementation-workpass; release gates remain open`. Weighted roadmap stays `80.1%`. Local fake-process tests are not a live device proof.
