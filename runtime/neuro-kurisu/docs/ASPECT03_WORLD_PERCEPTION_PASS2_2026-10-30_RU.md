# NK1 — Аспект 03: восприятие мира — рабочий проход 2

Дата: 30 октября 2026  
Рабочая база: `workpass70-source`  
Ветка реализации: `aspect03-world-perception-truthful-grounding-2026-10-30`  
Целевой PR: Draft в `workpass70-source`

## 1. Цель

Довести восприятие мира от набора сенсорных адаптеров и семантических оценок до честной, непрерывной и проверяемой модели окружающей среды. Перцептивный слой является производителем свидетельств и идентичностей объектов; он не создаёт второе когнитивное ядро и не подменяет владельца мирового состояния.

Основные требования:
- сохранять идентичность отдельных экземпляров при одинаковых названиях;
- не повышать модельную гипотезу до прямого наблюдения;
- сохранять происхождение каждого сигнала и его модальности;
- не считать неизвестное значение измеренным нулём или отрицательным фактом;
- ограничивать влияние старых наблюдений временем их актуальности;
- передавать в пространственную модель только координаты с объявленной системой отсчёта;
- обучать калибровку только по независимому результату или человеческой разметке.

## 2. Подтверждённая база до этого прохода

PR #402 («P41 identity, evidence and runtime integration») уже был слит в рабочую базу. Его полезные решения сохраняются:
- один канонический P41 в OrganismCore;
- отдельная идентичность сущностей по provider track ID;
- временно ограниченное cross-modal association;
- отказ от неоднозначного геометрического сопоставления;
- отдельные service-success, reported-quality и empirical-accuracy;
- калибровка только по проверяемым независимым receipts.

Старые ветки не переносятся целиком. Этот проход создаёт следующий слой корректности поверх уже интегрированной P41.

## 3. Реализовано в этом проходе

### 3.1. Provenance в P41

Файлы:
- `src/organism/cognition/P41SemanticPerception.ts`
- `src/organism/core/OrganismCore.ts`

Добавлено:
- `modalityEvidenceKinds` для сущностей;
- `modalityLastSeenAt` используется для актуальности конкретного канала;
- `sceneEvidenceKind` для сцены;
- per-modality provenance для событий;
- world ingestion использует исходный evidence kind, а при отсутствии данных ставит `unresolved`;
- Core передаёт `evidenceKind` из нормализованного WorldContext;
- same-cycle world summary не может понизить более сильное vision-свидетельство той же сцены до unresolved;
- world event больше не становится observed только из-за того, что он пришёл из поля events.

Legacy snapshots остаются восстанавливаемыми: новые поля необязательны, а отсутствие старого provenance трактуется как unresolved.

### 3.2. Сохранение экземпляров объектов в GroundedWorldState

Файл: `src/organism/world/GroundedWorldState.ts`

Ранее сущности сводились в Map по `kind + label`. Это разрушало различие между двумя объектами одного класса, даже если P41 уже имела разные track IDs.

Теперь:
- первичное сопоставление использует entity ID, provider track ID и aliases;
- координатные поля сохраняют frame ID;
- смена frame ID очищает старую скорость и не смешивает несопоставимые координаты;
- fallback по label разрешён только для legacy untracked entity и только при единственном кандидате;
- повторяющиеся tracked объекты одного класса остаются отдельными;
- старые snapshots без track ID продолжают восстанавливаться.

### 3.3. Честные неизвестные значения

Файлы:
- `src/organism/world/GroundedWorldState.ts`
- `src/organism/core/WorldContextNormalizer.ts`

Исправлено:
- confidence объекта не используется как его числовая ценность;
- placeholder `value: 0` при `valueKnown: false` остаётся неизвестным;
- неизвестная видимость не превращается в «не виден»;
- неизвестный collection/grasp status не превращается в подтверждённое «не получен»;
- нормализатор уважает явные `valueKnown:false`, `visibilityKnown:false`, `collectionKnown:false`.

### 3.4. PerceptualEvidenceCompiler

Файл: `src/organism/body/PerceptualEvidenceCompiler.ts`

Добавлено:
- отдельная запись сущности для каждой модальности;
- ID свидетельства включает entity ID, модальность и timestamp;
- dedup не объединяет разнородные модальности в одну запись только потому, что совпал текст claim;
- события и отношения сохраняют свой исходный evidence kind;
- scene evidence сохраняет kind P41;
- modality считается observed только при явном observed, а не потому, что её название vision/audio/sensor.

### 3.5. Временная актуальность

Файл: `src/organism/world/GroundedWorldState.ts`

Для оценки текущей уверенности используются только свежие evidence (окно 5 секунд). Старые события, отношения и свидетельства остаются в bounded history, но явно помечаются как historical и не увеличивают текущую confidence.

### 3.6. Камера и координаты

Файл: `src/organism/body/GeminiVisionSemanticBackend.ts`

Добавлено:
- определение MIME по сигнатуре фактического файла: JPEG, PNG, WebP;
- отказ для неподдерживаемого формата вместо ошибочной отправки с `image/jpeg`;
- удалены неподтверждённые x/y/z из результата Gemini;
- prompt явно запрещает выводить 3D-позиции, глубину и преобразования камеры без калиброванной системы отсчёта.

VisionSemanticBackend всё ещё допускает `trackId`, `sourceId`, `coordinateFrameId` и координаты для настоящего tracker/calibrated backend. Gemini не получает право выдумывать их.

### 3.7. Сохранение калиброванной геометрии

Файлы:
- `src/organism/core/types.ts`
- `src/organism/core/WorldContextNormalizer.ts`
- `src/organism/core/OrganismCore.ts`
- `src/organism/cognition/P41SemanticPerception.ts`
- `src/organism/world/GroundedWorldState.ts`

Добавлено:
- WorldContext objects принимают `x/y/z` и `coordinateFrameId`;
- нормализатор сохраняет геометрию только при полном конечном трёхмерном tuple и непустом frame ID;
- неполные, image-relative или безframe coordinates остаются неизвестными;
- отрицательные и произвольные пространственные значения не clamp'ятся в [0,1];
- Core передаёт позицию и frame в P41;
- P41 допускает пространственную ассоциацию только внутри одинакового frame ID;
- GroundedWorldState сохраняет позицию/frame при консолидации и выдаёт их дальше в WorldContext;
- смена frame ID не смешивает старую скорость с новой системой координат.

Это не добавляет калибровку камеры и не преобразует координаты изображения в world-space. Источник обязан передать откалиброванный frame ID самостоятельно.

### 3.8. Временное отслеживание экземпляров объектов между кадрами

Файлы:
- `src/organism/body/TemporalObjectTracker.ts`
- `src/organism/body/VisionSemanticBackend.ts`
- `src/organism/body/GeminiVisionSemanticBackend.ts`
- `src/organism/core/OrganismRuntime.ts`

Добавлено:
- отдельный runtime tracker с состоянием на каждую камеру;
- нормализованный 2D bbox, отдельная `bboxConfidence01`, camera ID и capture execution receipt;
- сохранение provider-owned track IDs без подмены локальными;
- локальные session-scoped IDs выдаются только при валидной рамке и явной достаточной localization confidence;
- ассоциация по IoU + расстоянию центров + ограничению изменения площади;
- однозначность проверяется в обоих направлениях (detection→track и track→detection);
- при неоднозначности ID не назначается;
- одинаковые подписи сохраняют отдельные экземпляры при разных bbox;
- перекрывающиеся дубли в одном кадре не создают две фиктивные сущности;
- отдельные camera namespaces, max-gap, max-age, stale timestamp и duplicate receipt guards;
- одинаковый SHA изображения не используется как frame ID: неподвижная сцена всё равно даёт новый capture, а идемпотентный повтор одного receipt не удваивает tracking update;
- runtime возвращает tracking metrics вместе с semantic result.

Gemini может вернуть приблизительный normalized 2D bbox только когда объект ясно локализован; при недостаточной уверенности bbox опускается. Уверенность существования объекта не заменяет отдельную уверенность локализации. Эти bbox остаются model-output, не становятся observed и не создают 3D-координат.

Ограничения:
- данный трекер не выполняет optical flow, Kalman prediction, appearance embeddings или re-identification после длительного исчезновения;
- tracking надёжен только настолько, насколько backend даёт согласованные рамки; LLM bbox — это приближённая локализация, не ground truth;
- полноценный production tracker (ByteTrack/BoT-SORT-подобный detector pipeline) и независимые IDF1/HOTA оценки остаются следующим этапом.

## 4. Регрессионные тесты

Новый тест:
- `tests/world-perception-grounded-identity-provenance.mjs`

Он проверяет:
- две сущности «chair» с разными track IDs сохраняются в P41 и GroundedWorldState;
- модельное свидетельство остаётся model-output;
- сцена, событие и объект не повышаются до observed;
- same-cycle unresolved world data не понижает vision result;
- unknown value/visibility/collection не превращаются в ложные утверждения;
- устаревшее observed evidence не считается текущим и сохраняется как historical;
- calibrated x/y/z передаются между Core, P41 и GroundedWorldState только вместе с coordinateFrameId;
- неполная или unframed геометрия остаётся unknown;
- два последовательных кадра с одинаковыми объектами и валидными рамками сохраняют ID при перестановке detection order;
- ambiguous matches, duplicate boxes, stale frame receipts и истёкшие треки не порождают ложных идентификаторов.

Новый тест:
- `tests/gemini-vision-mime-integrity.mjs`

Он проверяет:
- распознавание MIME JPEG/PNG/WebP;
- отказ от неизвестного формата;
- передача фактического MIME в Gemini request;
- игнорирование 2D image-relative x/y/z как неподтверждённых 3D-координат.

Workflow:
- `.github/workflows/world-perception-integrity.yml`

В workflow добавлены оба новых теста и пути файлов в фильтры запуска.

## 5. Что ещё НЕ завершено

Этот проход не закрывает весь аспект восприятия мира. Следующие пробелы остаются:

1. Реальный Android/Termux soak камеры, микрофона, датчиков движения, proximity и light sensors.
2. Проверка каждого camera capture от ActionGateway receipt до Gemini result, P41, GroundedWorldState и сохранённого snapshot на реальном устройстве.
3. Настоящий object tracker, выдающий стабильные instance IDs при движении камеры, перекрытиях и повторном появлении объектов.
4. Мультикамерная корреляция с калибровкой и transform между frame IDs.
5. 3D-позиции объектов только из глубинной камеры, stereo/SLAM, ARCore либо другого откалиброванного источника.
6. Человечески размеченный holdout для precision/recall, calibration error, ID switches и false merges/splits.
7. Long-horizon evaluation: occlusion, re-identification, camera motion, scene transitions, stale samples, low light, blur.
8. Измерение реального information gain active perception по независимому postcondition, а не только по model confidence.
9. Производительные тесты на Android: CPU, RAM, decode latency, backend latency, queue pressure.
10. Проверка восстановления world state после перезапуска и длительной истории.

Нельзя считать отсутствие tracker IDs недостатком, который нужно скрывать искусственными ID. Пока backend не имеет надёжного трекера, он должен возвращать неизвестную идентичность, а не выдумывать устойчивый ID.

## 6. План следующих проходов до 100%

### Pass 3 — сенсорный ingress и устройство
- capture receipt → hash/file validation → decoder → semantic backend → P41 ingestion → evidence compiler → grounded world persist;
- тесты реального Android и Termux;
- свежесть, дубликаты, отмены, retries и idempotency.

### Pass 4 — object tracking и геометрия
- tracker interface с namespaced IDs;
- source/camera/frame IDs;
- association matrix и assignment с порогом ambiguity;
- occlusion, re-ID и camera motion;
- без перевода image-plane координат в world-space без calibration.

### Pass 5 — multimodal world fusion
- видео, звук, motion/proximity/light;
- синхронизация timestamps;
- независимое подтверждение событий;
- различение корреляции и причинности;
- conflict resolution без потери исходных источников.

### Pass 6 — active perception
- запрос наблюдения по ожидаемой информационной выгоде;
- бюджет по времени, батарее и thermal state;
- post-action information gain;
- проверка, что наблюдение действительно изменило belief/world model.

### Pass 7 — независимая оценка
- фиксированный holdout;
- RU/EN labels;
- precision/recall/F1;
- calibration/ECE/Brier;
- IDF1/HOTA или эквивалент для трекера;
- false merge/split;
- latency и memory budget.

### Pass 8 — release closure
- production build;
- полный world-perception workflow;
- device soak;
- восстановление persistent world state;
- provenance/licence audit;
- новый Release ZIP из проверенного commit SHA.

## 7. Критерий 100%

Аспект получает 100% только когда:
- не теряет идентичность различных экземпляров;
- сохраняет provenance каждого evidence;
- не повышает гипотезу до наблюдения;
- не конвертирует неизвестное в ложный факт;
- корректно оценивает временную актуальность;
- стабильно воспринимает окружающее через реальные подключённые сенсоры;
- строит согласованную модель объектов, отношений и событий;
- может запросить дополнительное наблюдение и измерить его реальную пользу;
- проходит независимую holdout и device evaluation;
- интегрирован в рабочий Release ZIP.

Статус этого прохода: код реализован в отдельной ветке и оформлен в Draft PR #423. Specialized `world-perception-integrity` workflow завершился SUCCESS на кодовом HEAD `1ebc8ed0daf6840ae13fbcfa6006ac50da61a1c2`, включая все новые regression tests и runtime typecheck. Общие PR checks `cognitive-contracts`, `source-lineage-contract`, `verified-promotion`, `metrics`, `verified-experience-lanes`, `correlated-postcondition` и `local-language-resilience` также завершились SUCCESS на том же кодовом HEAD; большой `targeted-and-regression` job ещё выполняется. Локальный запуск в контейнере не заявляется из-за недоступного DNS/GitHub clone. Android/Termux camera soak, реальный tracker, calibration и независимая holdout оценка остаются обязательными до 100%.
