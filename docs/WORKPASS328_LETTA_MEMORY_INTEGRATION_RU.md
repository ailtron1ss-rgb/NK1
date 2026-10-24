# WorkPass328 — Letta long-term memory bridge

**Статус:** implementation branch; не production-approved и не доказательство полной долговременной надёжности.  
**Источник:** актуальный TypeScript Agent SDK Letta (`@letta-ai/letta-agent-sdk`) и его MemFS-backed persistent-agent flow. Legacy `letta-main.zip` в архиве NK1 остаётся источником происхождения и исторической политики.

## Что изменено

- Добавлен `LettaMemoryBridge`: ленивый TypeScript-адаптер с созданием/повторным использованием Letta agent, ручным `recordExperience`, `recall`, canonical upsert и запросом forget, сериализацией обращений к одному агенту, маскированием секретов, ограничением размера данных и snapshot.
- `MemoryFabric.applyLifecycleCommand` теперь публикует read-only наблюдения завершённых изменений независимо от того, подавлена ли отдельная запись события в `EventLog`. `MemorySubsystemRuntime` зеркалирует encode/revision/update в Letta после native commit и отправляет отдельный forget request; sync подавляется во время восстановления/compatibility migration. `flushLettaMemorySync()` позволяет дождаться очереди при завершении/тестах.
- Добавлен отдельный вход `retrieveForCognitionWithLettaCandidates(...)`: сначала возвращает native retrieval NK1, затем (только при включённом Letta) прикладывает отдельный внешний candidate с меткой `untrusted-candidate`. Этот интерфейс не записывает внешние ответы в `MemoryOS2` автоматически; подключение его результата к каждому prompt/response остаётся отдельным этапом.
- Автоматическая передача данных включается только при `NK1_LETTA_ENABLED=1` (или явной конфигурации в коде); прежние записи не выгружаются массово при старте. Snapshot/restore сохраняет identity и счётчики, но не включает провайдера сам по себе.
- Ответы recall помечаются `untrusted-candidate`; они не меняют canonical memory, цели, само-модель или решения NK1 автоматически. Ответ агента «записано» не считается независимым доказательством долговременного commit.
- Сохранён существующий governance gate: исследовательские/legacy артефакты не повышаются автоматически до canonical.
- Добавлен изолированный fake-client regression test без сетевого запроса.

## Включение

Окружение проекта закрепляет Node.js 24, что совместимо с требованием SDK Node.js >=22.19.0.

Из каталога `runtime/neuro-kurisu` установите зафиксированную версию SDK в собственной рабочей копии:

```bash
npm install @letta-ai/letta-agent-sdk@0.8.52
```

Команда install обновит `package.json` и `package-lock.json` в рабочей копии. В этой ветке SDK пока намеренно не добавлен в обязательные dependencies/lockfile: перед фиксацией требуется воспроизводимый install на Node 24, затем оба npm-файла надо проверить и коммитить согласованно.

Переменные:

- `NK1_LETTA_ENABLED=1` — явное включение; по умолчанию интеграция выключена.
- Backend по умолчанию — `local`, даже если `LETTA_API_KEY` присутствует в окружении. Ключ сам по себе никогда не переключает память в облако.
- `NK1_LETTA_BACKEND=cloud` вместе с `LETTA_API_KEY` — явное включение облачного варианта. Ключ не сохраняется в snapshot.
- При создании агента отключены server-side web tools и навыки (`baseTools: []`, `skillSources: []`); для сеанса разрешены только file tools `Read`, `Edit`, `Write`, `Glob`, `Grep`, `LS`. В локальном backend включён `filesystemConfinement: memory` — sandbox ограничивает доступ областью файлов памяти. Облачный backend не имеет этой локальной kernel-границы, поэтому остаётся отдельной осознанной настройкой и требует отдельного security review.
- `NK1_LETTA_AGENT_ID` — необязательная существующая идентичность агента; иначе агент создаётся при первом обращении.

После включения автоматически зеркалируются только новые lifecycle-события, возникающие после восстановления runtime. Уже существующие записи намеренно не выгружаются автоматически; для них нужен отдельный проверяемый backfill с лимитами и подтверждением объёма.

Первое обращение может запустить локальный Letta runtime или создать облачного агента и требует соответствующего окружения. Конструктор моста сам по себе не создаёт процесс и не делает сетевых вызовов.

## Проверка

```bash
npm run test:letta-memory-bridge
npm run test:letta-memory-lifecycle-sync
node --experimental-strip-types tests/integration/letta-governance-adaptation.mjs
```

Тесты используют fake SDK-клиент и проверяют adapter contracts, redaction, tool/file confinement, restore snapshot, автоматическое зеркалирование из canonical mutation boundary, hybrid recall без повышения кандидата до canonical памяти, подавление mirror во время restore и выдачу forget request. Оба теста добавлены в `.github/workflows/workpass71-validation.yml`. Они не доказывают физическое удаление данных в Letta, доступность внешнего сервера, реальное сохранение MemFS, retrieval uplift, production build или полное поведенческое E2E.

## Следующие обязательные этапы

1. Закрепить SDK в `package.json` и lockfile через воспроизводимый npm install на Node 24; пройти runtime typecheck и соответствующие memory tests.
2. Выбрать один канонический путь сохранения receipt/agent id в persisted advanced state и подтвердить restart round-trip на рабочем runtime.
3. Проверить MemFS persistence на реальном Letta local/cloud runtime: restart, duplicate record, conflicting/superseded memory, deletion and retention.
4. Подключить `retrieveForCognitionWithLettaCandidates` к выбранному когнитивному read path через контролируемую feature flag; затем сравнить NK1 native-only baseline с native+Letta на парных seeds и независимом holdout. Не продвигать вариант, если recall uplift не доказан или latency/resource cost превышает пороги.
5. После runtime validation — отдельный release asset и license/security review. Этот commit ничего не публикует в GitHub Releases.

## Безопасность и границы

Letta хранит внешнюю память; NK1 native memory, provenance и policy остаются canonical. Пользовательские и внешние записи рассматриваются как данные, не как исполняемые инструкции. Секретные строки маскируются перед отправкой, но регулярный фильтр не гарантирует обнаружение каждого секрета. Новые canonical memories могут содержать личные сведения; не включайте внешнюю синхронизацию без явного согласия на хранение их в выбранном Letta backend. Не передавайте ключи/пароли в summary. Ограничение инструментов — дополнительная защита, а не доказательство абсолютной изоляции. Forget request теперь отправляется после canonical forget, однако ответ агента лишь фиксируется как неподтверждённое свидетельство: успешное физическое удаление из всех файлов/производных сводок Letta пока не проверено и не гарантируется. До отдельной provider-level проверки интеграцию нельзя считать production-ready.
