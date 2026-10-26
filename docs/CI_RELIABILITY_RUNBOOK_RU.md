# Диагностика надёжности GitHub Actions в NK1

Обновлено: 2026-10-23. Назначение: не смешивать сбой инфраструктуры GitHub Actions с дефектом NeuroCore и не считать непроверенный код проверенным.

## Три разных состояния

1. **Изменение сохранено:** есть commit SHA в нужной ветке.
2. **Код проверен:** нужная версия commit действительно прошла запускаемые тесты/typecheck/build.
3. **Артефакт обновлён:** новый файл релиза действительно загружен в GitHub Releases, его SHA-256 сверена и asset привязан к ожидаемому tag/commit.

Ни одно из этих состояний автоматически не гарантирует следующее. Новый коммит или зелёный статус старого запуска не подтверждает состояние актуального ZIP.

## Быстрая классификация падений

- **Инфраструктурный startup blocker:** job имеет `runner_id=0`, пустой `runner_name`, `steps=[]` и завершился почти сразу. Ни shell-команда, ни тест, ни компилятор не выполнялись. Не записывать такой запуск как ошибку теста NK1 и не делать вывод, что конкретный тест провален.
- **Сбой внутри workflow:** runner назначен и есть шаги. Открыть первый реально упавший шаг и исправлять конкретную причину; сохранять полный текст ошибки и SHA тестируемого commit.
- **Timeout/cancelled:** отличать собственное ограничение `timeout-minutes`, конкурентную отмену и ручную отмену от падения теста.
- **Падение сборки/теста:** считать подтверждённым только если шаг действительно выполнялся и выдал ошибку.

## Что делать при `runner_id=0` и нулевых шагах

1. Открыть конкретный run, зафиксировать ID, workflow, branch, commit SHA, event, время и payload job.
2. Проверить [GitHub Status](https://www.githubstatus.com/) и повторить минимальную диагностику только после проверки инфраструктурного состояния.
3. В настройках GitHub проверить Actions usage/лимиты, доступность hosted runners, billing/spending limits и политики репозитория/организации. Проверять фактические сообщения интерфейса; не предполагать, что проблема точно в оплате.
4. Сравнить с последним заведомо успешным запуском, в котором есть назначенный runner и реальные шаги.
5. Если минимальный workflow с одной shell-командой без сторонних actions тоже не выполняется, не менять код приложения наугад. Зафиксировать проблему как инфраструктурную и обратиться в GitHub Support, приложив run ID и время.
6. После восстановления запустить проверки на текущем HEAD. Не считать старый успешный запуск подтверждением новых коммитов.

## Правила предотвращения повторения

### Контракт TypeScript для runtime и Node.js-зависимостей

- Перед semantic runtime typecheck устанавливать canonical locked toolchain: `npm ci --prefix app` из корня репозитория. Именно `app/package-lock.json` фиксирует версии TypeScript и `@types/node`, а `runtime/neuro-kurisu/tsconfig.clean.json` ищет Node typings в `../../app/node_modules/@types`.
- `runtime/neuro-kurisu/scripts/typecheck-runtime.mjs` должен выбирать pinned compiler из `app/node_modules/typescript/bin/tsc` (или другой явно зафиксированный compiler) и запускать `-p tsconfig.clean.json --noEmit`.
- Если compiler не установлен, результат — `BLOCKED`, а не зелёный status. Не использовать глобальный `tsc` как незаметный fallback и не выдавать Node syntax parsing за semantic TypeScript typecheck.
- После установки зависимостей повторить exact-head check. Если ошибки остаются, классифицировать оставшиеся TS diagnostics как реальные type/contract issues и исправлять их; не ослаблять `strict` и не скрывать ошибки только ради зелёного CI.


- Использовать актуальные версии GitHub Actions, совместимые с текущим runner; Node.js 20 для JavaScript Actions больше не поддерживается на GitHub-hosted runners.
- Версию **Node.js проекта** брать из корневого `.nvmrc`; не смешивать её с Node.js runtime, на котором запускается сама JavaScript Action.
- Сверять выбранную версию Node с `.nvmrc` перед тестами.
- Не скрывать сбои через `continue-on-error` и не публиковать релиз при пропущенных проверках.
- Держать разумные таймауты, чтобы длинные регрессии не завершались ложным timeout.
- Сохранять тестовые доказательства на точном SHA. Для автономных навыков/памяти отдельно оставлять независимую оценку, holdout и проверку регрессий.
- Для публикации проверять существование release tag, безопасность путей архива, целостность ZIP и SHA-256; не перезаписывать существующий релиз молча.

## Подтверждённый результат WorkPass320 — 2026-10-25

На code head 974a8cf5dea2093cad936f76a3fc43c86783ae3e [Actions run 40229027931](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40229027931) завершился success; все шаги прошли. Установлены зависимости из обеих lockfile; app/runtime TypeScript, production build, когнитивный цикл, мотивация, P26 integrity/continual matrix, replay, gateway, HTTP/server security, рестарт и Compose build/boot прошли. Контейнер достиг ready=true, встроенный UI ответил HTTP 200.

Предыдущие 88 диагностических строк WorkPass319 были зафиксированы в старом окружении без установки canonical app toolchain до runtime typecheck. Теперь typecheck использует закреплённый локальный компилятор и корректную Node typings-среду. Это устраняет проблему воспроизводимости окружения, но не доказывает, что все ошибки любых конфигураций или интеграций устранены.

[PR #129](https://github.com/ailtron1ss-rgb/NK1/pull/129) остаётся draft; main не изменён. GitHub Release ZIP ещё не синхронизирован с этим source branch: текущий attachment относится к WorkPass70 от 2026-10-19. Смотрите также [WorkPass320](WORKPASS320_RUNTIME_TYPECHECK_DEPENDENCY_CONTRACTS_2026-10-25.md).

## WorkPass322 — доверенная оценка и source candidate

P26 получает Ed25519-проверяющий callback из `NEURO_P26_HOLDOUT_VERIFIERS_JSON`. Конфигурация связывает `verifierId` с публичным Ed25519 ключом и allowlist протоколов. Публичный ключ может храниться в окружении runtime; **private key принадлежит внешнему независимому оценщику и не должен появляться в NK1**. Канонический endpoint `POST /api/organism/true-learning/holdout-evidence` доступен через Core → P26; score tampering и повторные evidence-ID/sample-set отклоняются. Если allowlist пуст, метрика обобщения не увеличивается — это fail-closed поведение.

После полного успешного Compose smoke workflow выполняет `npm run audit:assets` и `npm run release:verify`, затем собирает source ZIP с точного `GITHUB_SHA`, сканирует пути и секретные файлы, вычисляет SHA-256 и загружает candidate artifact через Actions. В отчёте ZIP указаны точный commit, run URL и SHA. Такой artifact — **кандидат для review, не release publication**.

Текущий code-stack прогон [40251315322](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40251315322) прошёл all steps на `c1d3b149dd8022af39d5b52d829f030526bf9849`, включая Ed25519 unit tests, server/security, clean restart и UI → runtime Compose smoke. Новая упаковка требует отдельного точного run после изменений в workflow.

## Подтверждённый результат WorkPass321 — 2026-10-26

[Actions run 40250314917](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40250314917) завершился `success` на source HEAD `e5bdcaf2732bd38298c27160ff612b66f4d16253`. Проверены установки обеих lockfile, app/runtime TypeScript, production-сборка React UI, когнитивный цикл/мотивация, P26 integrity и continual-learning matrix, causal replay, шлюз и финализация действий, server security, restart persistence, Compose build/boot и same-origin UI → runtime API. Финальный smoke сообщил `gateway=200`, `runtime=true`, `architecture=true`.

Стек использует три сервиса: React/Nitro app, приватный runtime и Caddy gateway. Runtime не опубликован на host-порт; браузерные API идут через один origin и внутренний `NEURO_API_TOKEN`. Локальный bind по умолчанию — `127.0.0.1:8080`. Перед удалённым доступом необходимо заменить демонстрационный токен и добавить подлинную внешнюю аутентификацию/TLS.

P26 holdout evidence fail-closed, пока host-owned independent verifier не настроен. Встроенные численные benchmark результаты — синтетические регрессионные пробы, не production accuracy. Главный ZIP в GitHub Releases всё ещё WorkPass70 от 2026-10-19 и не синхронизирован с этим source HEAD. PR #129 остаётся draft; `main` не изменён. Подробности: [WorkPass321](WORKPASS321_UNIFIED_UI_RUNTIME_AND_P26_TRUST_2026-10-26.md).

## Текущий подтверждённый контекст на 2026-10-23

В NK1 наблюдались массовые завершения до первого шага с `runner_id=0`, пустым `runner_name` и `steps=[]`. В минимальном диагностическом workflow сторонние actions отсутствовали. Это подтверждает отсутствие выполнения шагов, но **не устанавливает точную причину на стороне аккаунта**. Проверка настроек hosted runners/usage/billing остаётся диагностическим действием, а не доказанным диагнозом.

Ссылки для продолжения:
- [NK1 Actions](https://github.com/ailtron1ss-rgb/NK1/actions)
- [WorkPass325 startup diagnostic](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39906315773)
- [Успешный контрольный запуск с назначенным runner](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39473038680)
