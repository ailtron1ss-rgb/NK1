# WorkPass328 — Letta long-term memory bridge

**Статус:** implementation branch; не production-approved и не доказательство полной долговременной надёжности.  
**Источник:** актуальный TypeScript Agent SDK Letta (`@letta-ai/letta-agent-sdk`) и его MemFS-backed persistent-agent flow. Legacy `letta-main.zip` в архиве NK1 остаётся источником происхождения и исторической политики.

## Что изменено

- Добавлен `LettaMemoryBridge`: ленивый TypeScript-адаптер с созданием/повторным использованием Letta agent, `recordExperience`, `recall`, сериализацией обращений к одному агенту, маскированием очевидных секретов, ограничением размера данных и snapshot.
- Мост встраивается в `MemorySubsystemRuntime` как опциональный провайдер внешней долговременной памяти. Его snapshot восстанавливается вместе с `advanced` memory state.
- Ответы recall помечаются `untrusted-candidate`; они не меняют canonical memory, цели, само-модель или решения NK1 автоматически. Ответ агента «записано» не считается независимым доказательством долговременного commit.
- Сохранён существующий governance gate: исследовательские/legacy артефакты не повышаются автоматически до canonical.
- Добавлен изолированный fake-client regression test без сетевого запроса.

## Включение

Окружение проекта закрепляет Node.js 24, что совместимо с требованием SDK Node.js >=22.19.0.

Из каталога `runtime/neuro-kurisu` установите SDK в собственной рабочей копии:

```bash
npm install @letta-ai/letta-agent-sdk
```

Установка зависимости отдельно не меняет NK1 lockfile автоматически; перед выпуском её следует зафиксировать согласованно через npm, не редактируя lockfile вручную.

Переменные:

- `NK1_LETTA_ENABLED=1` — явное включение; по умолчанию интеграция выключена.
- `NK1_LETTA_BACKEND=local` — локальный Letta App Server; это вариант по умолчанию без API-ключа.
- `NK1_LETTA_BACKEND=cloud` и `LETTA_API_KEY` — облачный вариант. Ключ не сохраняется в snapshot.
- `NK1_LETTA_AGENT_ID` — необязательная существующая идентичность агента; иначе агент создаётся при первом обращении.

Первое обращение может запустить локальный Letta runtime или создать облачного агента и требует соответствующего окружения. Конструктор моста сам по себе не создаёт процесс и не делает сетевых вызовов.

## Проверка

```bash
node --experimental-strip-types tests/integration/letta-memory-bridge.mjs
node --experimental-strip-types tests/integration/letta-governance-adaptation.mjs
```

Тест моста использует fake SDK-клиент и проверяет только контракты адаптера: сохранение ID, redaction, порядок операций и классификацию recall. Он не проверяет доступность внешнего сервера, фактическое сохранение MemFS, качество retrieval, production build или end-to-end подключение к OrganismCore.

## Следующие обязательные этапы

1. Закрепить SDK в `package.json` и lockfile через воспроизводимый npm install на Node 24; пройти runtime typecheck и соответствующие memory tests.
2. Выбрать один канонический путь сохранения receipt/agent id в persisted advanced state и подтвердить restart round-trip на рабочем runtime.
3. Проверить MemFS persistence на реальном Letta local/cloud runtime: restart, duplicate record, conflicting/superseded memory, deletion and retention.
4. Сравнить NK1 native-only baseline с native+Letta на парных seeds и независимом holdout. Не продвигать вариант, если recall uplift не доказан или latency/resource cost превышает пороги.
5. После runtime validation — отдельный release asset и license/security review. Этот commit ничего не публикует в GitHub Releases.

## Безопасность и границы

Letta хранит внешнюю память; NK1 native memory, provenance и policy остаются canonical. Пользовательские и внешние записи рассматриваются как данные, не как исполняемые инструкции. Секретные строки маскируются перед отправкой, но регулярный фильтр не гарантирует обнаружение каждого секрета: не передавайте ключи/пароли в summary. Удаление данных должно быть реализовано и проверено отдельно — этот мост пока не обещает автоматическое синхронное удаление между двумя хранилищами.
