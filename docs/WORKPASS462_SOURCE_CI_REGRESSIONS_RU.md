# WorkPass462 — исправления точечных блокировок source CI

**Дата:** 2026-10-27  
**Ветка:** `fix/source-ci-fixtures-2026-10-27`  
**Статус:** код и обновлённые регрессии внесены; проверка текущего PR ожидается.

## Исправленные несогласованности

1. `app/src/legacy/avatar/safeLocalStorage.test.mjs`: типизированы аргументы mock-storage, карта значений и безопасное удаление тестового глобального `window`. Это устраняет ошибки `noImplicitAny` и `delete` для обязательного поля.
2. `runtime/neuro-kurisu/tests/big-pass-90-causal-learning-stream.mjs`: trusted outcome fixtures теперь указывают реально наблюдённое действие и `lastActionSuccess`, как требует канонический причинный поток. Проверка повторного outcome использует такую же валидную пост-условную запись, чтобы фактически проверять дедупликацию.
3. `runtime/neuro-kurisu/tests/p23-signed-outcome-artifact.mjs`: тест синхронизирован с контрактом ingestion: точный подписанный повтор идемпотентен и не увеличивает ledger, а другой подписанный результат для того же attempt отклоняется как `conflicting-existing-outcome`.
4. `runtime/neuro-kurisu/src/organism/learning/VersionedSkillCandidateStore.ts`: убраны parameter properties из конструктора. Это второй реально обнаруженный участок, который блокировал Node.js 24 `--experimental-strip-types` при запуске P23 gate.

## Приёмка

Нужен новый прогон app typecheck, причинной stream-регрессии и signed-outcome artifact-регрессии на точном HEAD. Эти изменения исправляют проверочные контракты и фикстуры; они не свидетельствуют сами по себе об улучшении retrieval/learning и не открывают production gate.

`main` и опубликованный Release ZIP не изменялись.
