# Device-Gate Hardening Report — Neuro-Kurisu Clean 1.1.0

## Why this release exists

После clean-room rebuild следующая опасность — не отсутствие cognitive modules, а эксплуатационные сбои: два процесса на одном state, зависшие LLM/Termux calls, crash-loop supervisor, загрязнение релиза runtime state и плохо диагностируемые отказы.

## Changes

- ProcessLock защищает один canonical state от нескольких daemon instances.
- OperationalJournal пишет bounded JSONL operational events и ротируется по размеру.
- LLM fetch имеет timeout через `LLM_TIMEOUT_MS`.
- HTTP health/metrics показывают минимальный operational state без полного cognitive snapshot.
- Termux supervisor использует exponential backoff до 60 секунд.
- Device preflight проверяет Node, память, state directory и наличие Termux bridges.
- Device Gate runbook + report template добавлены в релиз.
- package-lock обновлён до 1.1.0 с нулевым dependency tree.
- runtime state удаляется перед упаковкой; состояние создаётся на устройстве при первом запуске.

## Verified

- `npm ci --offline` PASS
- `npm run release:audit` PASS
- operational hardening PASS
- HTTP health/metrics PASS
- duplicate process lock rejection PASS
- ZIP/TAR round-trip PASS

## Explicit limitation

Physical Android thermal/battery/process-reclaim soak still requires the target phone.
