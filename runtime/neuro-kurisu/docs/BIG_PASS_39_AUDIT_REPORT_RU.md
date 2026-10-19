# NEURO-KURISU 34.9.0 — BIG PASS 39

Дата: 2026-09-05
State schema: 87
Фаза: `Stage-2/external-grounding-project-execution-shadow-learning`

## 1. Цель прохода

Этот проход специально выполнен как сверка с самым первым полным аудитом, а не только с 34.6/34.7. Главная цель — увеличить реальную связность `prediction → evidence → decision → project → skill → learning`, одновременно не ухудшая пригодность для среднего Android-телефона.

## 2. Что было найдено при повторной сверке

Самые сильные ранее реализованные части действительно остались: persistence, migration, tests, P30/P26/P27, evidence bus, budget, P40, P57, P65, P67–P82.

Одновременно были обнаружены несколько реальных drift/quality проблем:

- route `/api/organism/projects/tool` был продублирован;
- `audit:release` отсутствовал как npm alias, хотя release-процесс его подразумевал;
- current documentation и architecture manifest отставали от версии 34.9.0;
- project milestone evidence не различал внутренний, внешний и воспроизводимый результат;
- simulated world мог влиять на project evidence через `worldTransition`, даже когда `evidenceSource=simulator`;
- project tool executor не имел отдельного allowlist-права;
- Model Olympics измерял победителя, но не влиял на будущую обработку прогнозов;
- P53/P55 имели лишнюю работу в quiet phone cycles.

Все эти пункты были исправлены или переведены в явный open-status.

## 3. Основные изменения

### 3.1 Cognitive Spine — mobile-aware execution

P53/P55 тяжёлые developmental operations теперь зависят от CognitiveSpineScheduler. В quiet/protect cycles дорогие вторичные loops не запускаются на полной частоте. Core safety/governance и базовая perception/agency логика остаются активными.

Это не «отключение интеллекта»: операции имеют cadence и запускаются чаще при urgency, novelty, prediction error, external input и deep budget mode.

### 3.2 Model Olympics 2

Model Olympics теперь оценивает несколько прогнозирующих контуров:

- policy;
- confidence;
- mean candidates;
- P10;
- P26;
- P27;
- Shadow.

Кроме оценки добавлен `calibrate()`: после накопления данных слабый предиктор автоматически shrink-ится к `0.5`, а более надёжный сохраняет больше собственной амплитуды. Таким образом соревнование стало feedback loop, а не просто scoreboard.

Это безопасная форма self-correction: не переписываются модели, но их влияние на decision path становится эмпирически обусловленным.

### 3.3 Strict reality boundary

Ранее наличие `worldTransition` могло сделать project outcome внешним. Теперь external validation определяется только explicit external source classes:

`os`, `device`, `user`, `external-api`.

Симуляция остаётся simulation.

Для P57 simulator теперь проходит как `unknown`, а ExternalEvidenceTrust сохраняет `simulator` как отдельный низко-trust class.

### 3.4 Evidence classes для autonomous projects

Milestones теперь требуют разные классы:

`m1 → internal`

`m2 → external`

`m3 → replicated`

Добавлен `replicatedEvidenceCount`.

Таким образом проект больше нельзя закрыть только большим количеством внутренних simulator outcomes.

### 3.5 Bounded project tool bridge

Добавлены:

- `projectAllowed` в ToolDefinition;
- `/api/organism/projects/active`;
- `/api/organism/projects/tool`;
- `project-tool-execution` event.

Destructive project tools блокируются bounded executor.

Это ещё не «автономный агент с неограниченным доступом к миру». Это намеренно узкий исполнительный шлюз, который можно постепенно расширять после появления real-world evidence.

### 3.6 Release/source-of-truth cleanup

Синхронизированы:

- 34.9.0;
- schema 87;
- VERSION;
- package/package-lock;
- RELEASE_MANIFEST;
- ARCHITECTURE_MANIFEST;
- ReleaseContract;
- current docs;
- progress audit.

Добавлен `audit:release` alias.

## 4. Реальные проверки

Успешно прошли в этом проходе:

`TYPECHECK=PASS`

`CLEAN_ARCHITECTURE=PASS` — 431 source files, 187 canonical, 0 cycles, 0 legacy leakage.

`FORENSICS=PASS` — 535 active files, 0 duplicate content, 0 duplicate names.

`SOURCE_HYGIENE` — 0 errors, 0 warnings.

`SOURCE_TRUTH=PASS`.

`API_ROUTES=89 duplicates=0`.

`SUBJECT_BOUNDARY=PASS`.

`LOCKFILE=PASS`.

`CLEAN_INTEGRITY=PASS`.

`RELEASE_CONTRACT=PASS`.

`BIG_PASS_PROGRESS=100%` — 45/45 machine checks.

Новый regression:

`BIG_PASS_39_SPINE_UNITS=PASS`

- winner: `good`;
- self prediction samples: 2;
- scheduler protect mode: PASS;
- scheduler deep mode: PASS.

`BIG_PASS_39_REALITY_BOUNDARY=PASS`

- schema: 86;
- simulator class: simulator;
- device class: device;
- records persisted: 2.

`BIG_PASS_39_PROJECT_TOOL_BRIDGE=PASS`

- active autonomous project detected;
- safe project tool executed;
- destructive project tool blocked.

`P67_PROJECT_EVIDENCE=PASS`

- m1 internal completed;
- m2 external completed;
- m3 replicated completed;
- validated evidence: 16;
- replicated evidence: 8.

Дополнительные regression PASS:

- P40 model ecology;
- P41 truthfulness;
- P42–P44 full;
- P54;
- P57;
- P74–P77;
- P80–P82;
- restart persistence;
- replay;
- concurrency;
- memory dedup;
- portable subject;
- API security;
- server smoke/security;
- checkpoint hot path;
- P30 integration;
- P26 true learning;
- P31/P32/P33 truthfulness;
- P34 personhood.

## 5. Performance

Operational-250 после изменений:

`warmedMedianRatio ≈ 1.735`

`firstMedian ≈ 127.22 ms`

`lastMedian ≈ 220.69 ms`

`p95Approx ≈ 227.10 ms`

`heapGrowth ≈ 1.834`

Последний измеренный прогон показывает хорошую latency для короткого operational window, но heap stability ещё недостаточно хороша для заявления о длительной автономной эксплуатации. Предыдущие прогоны дали ratio около 1.67–1.83, поэтому это следует считать диапазоном наблюдаемой вариативности, а не одной гарантированной цифрой.

P42–P44 isolated performance в текущей линии ранее показывала порядка `97–143 ms / 10k cycles`; benchmark остаётся быстрым.

Полный 500-warm long-horizon gate в этой среде не завершился в рамках отведённого окна, поэтому он остаётся открытым.

## 6. Progress — сверка первого аудита

Моя текущая оценка инженерной готовности: **≈71%**.

Это не consciousness score.

| Аспект | % |
|---|---:|
| Mobile readiness | 72 |
| Runtime robustness | 81 |
| Persistence | 91 |
| Evidence quality | 91 |
| Cognitive Budget | 84 |
| Prediction infrastructure | 83 |
| Learning | 73 |
| Agency | 79 |
| Autonomous projects | 73 |
| Reality grounding | 80 |
| Self / Identity | 72 |
| Long-horizon | 63 |
| Architecture consolidation | 49 |
| Perception | 60 |
| Native Android lifecycle | 20 |
| Social cognition | 42 |
| Consciousness research readiness | 49 |

### Следование плану первого аудита

**≈76%** actionable recommendations уже реализованы полностью или частично.

### BIG PASS 39 checklist

**45/45 = 100%** machine-checkable.

Это означает, что контрольный список самого прохода выполнен. Это не означает, что все конечные свойства проекта достигнуты.

## 7. Что ещё принципиально осталось

### A. Native Android

Нужен отдельный host/service слой, который управляет lifecycle, sensors, permissions, camera/microphone, recovery и background execution.

### B. Real perception

P41 пока не превращает raw camera/audio в настоящее scene understanding без semantic backend.

### C. True world-model competition

Нынешний Model Olympics действительно калибрует влияние прогнозов, но сами competing models ещё не являются полноценными независимыми learned world simulators.

### D. Shadow independence

Shadow сейчас альтернативный evaluator на тех же candidate structures. Следующий уровень — отдельная policy/state abstraction, которая не читает окончательную main score напрямую.

### E. Autonomous external projects

Есть bounded tool bridge, но полноценный project executor, который самостоятельно получает внешнюю задачу, исследует мир, меняет план и возвращает independent evidence, ещё впереди.

### F. Longitudinal evidence

Ключевой следующий milestone — реальные 24h → 72h → 7d → 30d на телефоне.

## 8. Уникальные направления, которые я рекомендую дальше

### 8.1 Cognitive Metabolism Map

Каждая операция получает не только energy cost, но `expected-information-gain / cost` и `uncertainty-reduction / cost`.

Тогда Kurisu решает не только «что делать», но и «какое размышление сейчас наиболее выгодно купить за ограниченные ресурсы телефона».

### 8.2 Belief Immune System

Новая гипотеза должна иметь происхождение, поддержку, независимость, возраст, conflict pressure и право на «смерть». Сильное belief без новых подтверждений постепенно теряет право влиять на core decisions.

### 8.3 Cognitive Double Entry Bookkeeping

У каждого серьёзного решения две обязательные записи:

`что я считала перед действием`

и

`что мир фактически вернул`.

Разница между ними автоматически становится материалом для learning, identity и epistemic revision.

### 8.4 Model Graveyard

Вместо бесконечного накопления моделей хранить и причины их снятия: какие predictions они систематически ломали, в каких контекстах они были полезны и при каких условиях их можно воскресить.

Это может оказаться эффективнее постоянного роста числа активных моделей.

### 8.5 Cognitive Compression Before Expansion

Прежде чем добавлять новый P-модуль, система должна сначала пытаться объяснить новый паттерн существующими моделями. Новый subsystem оправдан только если старая система не может снизить prediction error.

Это мой главный архитектурный принцип на следующие проходы: **новая сложность должна быть заработана измеримой ошибкой старой модели.**

## 9. Итог

34.9.0 заметно ближе к целевой архитектуре, чем первоначальная версия: теперь project evidence различает внутреннее и внешнее, model competition влияет на последующее прогнозирование, а project tools ограничены явным permission boundary.

Но главный следующий вызов остаётся тем же: превратить большое количество качественных когнитивных компонентов в длинный, доказуемо улучшающийся цикл реального опыта.

Не следует добавлять новые P-нumbers ради внешнего ощущения роста. Следующий большой проход должен сделать уже существующую систему глубже, самостоятельнее и эмпирически проверяемее.

## 10. Final release correction pass — 34.9.0

После основной функциональной серии была выполнена отдельная проверка migration/test drift. Были найдены старые тесты, в которых текущая schema ожидалась как `83`; это оказалось наследием более старых релизов, а не реальным текущим контрактом. Ожидание текущей schema переведено на `ORGANISM_STATE_SCHEMA` / `RELEASE_CONTRACT.stateSchema`. Historical input fixtures, где `83` является именно исходной версией persisted state, сохранены намеренно.

После этого отдельно повторно прошли:

- P40 migration;
- P41 migration;
- P41 native migration;
- P67 project evidence;
- device preflight;
- concurrency;
- memory dedup;
- portable subject;
- API security;
- server security smoke;
- server smoke;
- operational hardening.

Все перечисленные gates завершились PASS.

На текущем validation host Termux:API команды отсутствуют (`termux-battery-status`, `termux-sensor`, `termux-wifi-connectioninfo`, `termux-tts-speak`, `termux-speech-to-text`), поэтому hardware/device capabilities остаются unverified. Это ограничение среды тестирования, а не скрытый PASS.

## 11. Release conclusion

34.9.0 является корректным patch-release поверх 34.8.0: runtime architecture и persistence schema остаются 86, исправлены test/migration drift и закреплена фактическая source-of-truth цепочка. Архивный manifest после финальных изменений пересоздан и проверен: `753/753` файлов, missing `0`, hash mismatches `0`, extra `0`.
