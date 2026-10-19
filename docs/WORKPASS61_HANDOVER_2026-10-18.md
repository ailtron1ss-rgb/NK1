# Передача работ — WorkPass61 → следующий проход

## Базовая версия

`Neuro_Kurisu_WORKPASS61_2026-10-18.zip`; runtime `35.81.0`, persisted schema `225`. Официальная взвешенная дорожная карта `79.3%`; WorkPass61 scoped work `8/8 = 100%`.

## Главное закрытие

Кодовый конфликт authoritative provider-found receipt с уже записанным `executionId` projection fingerprint закрыт без ослабления защиты: base outcome остаётся immutable, receipt добавляет append-only evidence revision, causal `supersedes` node и CEF `tool-reconciliation` revision event. Повтор receipt идемпотентен; изменённое содержимое под тем же receipt identity fail-closed. Реальный `OrganismCore` integration test подтверждает отсутствие второго side effect.

## Следующий P0: проверить границу на реальном restart/provider

1. Поднять конфигурированный provider/device и выполнить одну мутацию с одноразовым approval + устойчивым `Idempotency-Key`.
2. Сымитировать timeout/потерю ACK после возможного side effect; сохранённый шаг должен остаться pending/ambiguous.
3. Завершить процесс, поднять runtime из persisted state и продолжить с теми же `decisionId`/`executionId`/operation key.
4. Выполнить read-only provider reconciliation. При `found` сохранить revision, не вызывать executor повторно; при `unknown` оставить `reconciliation-required`; при `not-found` допускать retry только если provider контракт однозначно доказывает отсутствие эффекта.
5. Проверить read-after-write независимым postcondition, snapshot после ревизии, replay после второго рестарта и отсутствие секретов в UI/trace.

## Далее

- production Vite/browser/Live2D approval journey;
- multi-step skill/project executor end-to-end;
- independent Russian/English temporal memory holdout (пока `recallDelta=0`, `not-promoted`);
- llama.cpp на целевой машине, voice/phoneme synchronisation;
- fault-injected clean-room rollback, nested upstream license review и endurance soak.

Не повышать официальный roadmap без новой наблюдаемой возможности или доказательства закрытого gate. Не считать юнит-тест или simulated provider эквивалентом live provider/device.
