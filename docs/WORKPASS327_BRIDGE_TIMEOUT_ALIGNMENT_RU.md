# WorkPass327 — согласование таймаутов research bridge и server approval retry

**Дата:** 2026-10-25  
**Ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**PR:** [#135](https://github.com/ailtron1ss-rgb/NK1/pull/135)

## Второй уровень интеграционного дефекта

WorkPass326 добавил bounded server retry до 8 секунд при коде `approval-storage-busy`. При исследовании bridge выяснилось, что `research/research_bridge.py::runtime_post` жёстко задавал `urllib.request.urlopen(..., timeout=4)` для любых runtime POST. Такой контракт был короче серверного retry бюджета: даже исправленный сервер мог ожидать завершения persistence batch, но bridge прекращал ожидание до того, как сервер вернул явное решение. Это несогласованность timeout budget между процессами.

## Исправление

- Для трёх HTTP permission routes — `request`, `resolve`, `consume` — задаётся `APPROVAL_GATEWAY_TIMEOUT_SECONDS`: значение из `ORGANISM_APPROVAL_TIMEOUT_SECONDS`, default 12 секунд, clamp от 9 до 30 секунд.
- Все обычные POST к runtime продолжают использовать 4 секунды. Это не увеличивает timeout всех исследовательских вызовов и не меняет контракт обычного chat/операционного endpoint.
- Регрессия подменяет urllib transport и проверяет фактический переданный timeout для approval routes (не меньше 8 сек) и обычного route (ровно 4 сек).
- Удалены дубли path filters в pull_request workflow; при push теперь отслеживаются ActionGateway/server/bridge approval tests, Python bridge и torch dependency sources.
- Добавлена явная команда `npm run install:research:cpu` для платформ, где используются полноценные PyTorch research probes. Она не включена в default mobile/Node install из-за потенциального отсутствия подходящих CPU wheel для Android/Termux.

## Evidence

На предыдущем PR head CI подтвердил: Python 3.12 setup, CPU-only torch installation и pip check, Node 24 pin, canonical installer, environment doctor, оба npm workspace install, supervisor tests, app build/typecheck, cognitive integration suite и governed approval/bridge E2E — PASS. Unified runtime/research smoke был ещё in progress при последней проверке; WorkPass327 timeout fix пока не имеет завершённого exact-head результата.

## Остаточные gates

Нужно дождаться нового PR head runner, проверить все per-probe results включая PyTorch NeuroCore/DeepCode, и отдельно оценить независимые continual-learning/held-out tests. Это targeted интеграционная надёжность, не completion certificate для проекта. Полные browser/Live2D/TTS, Android/Termux audio, long soak, license review и release ZIP остаются открытыми.
