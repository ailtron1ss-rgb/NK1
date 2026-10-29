# [NK1][WorkPass623] Hardening аватара, локальных 3D-моделей и браузерной просодии

**Дата:** 29 октября 2026 г.  
**Рабочая ветка:** `feature/embodiment-model-hardening-2026-10-29`  
**База при создании ветки:** `workpass70-source` @ `f084f6c0637d9d30b3c43106c4c47e8a17f1e102`  
**Статус:** изменения внесены в feature-ветку; CI/production/browser/device gates должны подтвердить результат. Release ZIP не изменён.

## Цель прохода

Улучшать действующее воплощение NK1, а не создавать ещё один независимый рендерер или эмоциональный движок. В этом проходе закрыты два конкретных engineering gap:
1. безопасная предварительная проверка пользовательского VRM/GLB до передачи данных Three.js;
2. связка эмоционального состояния организма с браузерной TTS-просодией при сохранении той же скорости для генерации mouth-viseme timeline.

## Изменения в коде

### 1. Preflight для локальных VRM/GLB

Новый модуль: `app/src/components/avatar/avatarModelValidation.ts`.

Перед `GLTFLoader.parse(...)` выполняется проверка:

- сигнатура `glTF`, версия GLB 2.0, объявленная длина и границы каждого chunk;
- ровно один корректно расположенный JSON chunk и корректный UTF-8/JSON;
- отсутствие невалидных / повторных / обрезанных chunk-ов;
- запрет сетевых и файловых URI для буферов и изображений; допустимы встроенные `data:` ресурсы;
- корректность размеров buffers, индексов bufferViews, byteOffset и диапазона `byteOffset + byteLength`;
- лимиты числа узлов, meshes, primitives, accessors, текстур, материалов, изображений, анимаций и каналов;
- верхний предел агрегированного количества элементов accessors;
- проверка иерархии на цикл, нескольких родителей и чрезмерную глубину.

Это важно потому, что «файл читается локально» не гарантирует, что GLTFLoader не попытается получить внешний ресурс по URI, и не защищает от абсурдно большой/некорректной геометрии. Модель остаётся локальной: её байты не отправляются на сервер NK1.

### 2. Восстановление при ошибочной модели

В `app/src/components/Avatar3DStage.tsx`:
- preflight запускается до `GLTFLoader.parse`;
- ошибочный/несовместимый новый файл не должен скрывать существующую успешно загруженную модель;
- когда предыдущей модели нет, сохраняется процедурное 3D-тело;
- сообщение и статус отражают реально оставшийся активный режим;
- неправильное расширение файла также не переводит уже работающую модель в ложный статус ошибки.

Ограничение: preflight — это защитный слой до parser, а не формальная проверка всех требований glTF/VRM. GLTFLoader и рендерер всё равно должны отработать безопасно, а модель нужно визуально проверить. VRM extensions, MToon, spring bones и полная humanoid retargeting-семантика этим проходом не реализованы.

### 2.1. Совместимость имён humanoid-костей

Новый модуль `app/src/components/avatar/humanoidBoneMap.ts` переводит распространённые имена VRM `J_Bip_L_UpperArm` / `J_Bip_R_UpperArm`, Blender `upper_arm.L/R` и Mixamo `LeftArm/RightArm` в семантические роли, которые уже понимает моторный адаптер. Это закрывает конкретное расхождение: раньше контроллер искал подстроки `leftupperarm` / `rightupperarm`, поэтому стандартные VRM bone names могли загружаться, но не получать жесты рук.

Это совместимость по именам, не полноценная VRM Humanoid API-интеграция: для произвольных имён костей, humanoid retargeting, VRM constraints и expression manager всё ещё нужен VRM-aware runtime.

### 3. Браузерная голосовая просодия от состояния организма

Новый модуль: `app/src/components/avatar/browserVoiceProsody.ts`.

`AvatarStage.tsx` теперь строит просодию для браузерного TTS из уже имеющихся полей:
- метка эмоции, валентность, возбуждение и доминантность;
- действие организма (explore / verify / reflect / rest / respond);
- уже существующие черты личности (warmth / composure / sarcasm).

Множители ограничены консервативными диапазонами:
- pitch: 0.82–1.18;
- rate: 0.78–1.15;
- volume: 0.50–0.98.

Высокое отрицательное возбуждение не повышает автоматически громкость/скорость и мягко регулирует подачу. Полученная `rate` используется **и** в `SpeechSynthesisUtterance`, **и** в `buildVisemeTimeline`, чтобы mouth timeline не предполагала другую скорость речи. Неправильные/нечисловые appraisal values ограничиваются.

Важная граница: это только browser `window.speechSynthesis`. Серверный/Android Termux voice runtime пока отдельный путь; данный проход не доказывает его аудиорезультат и не объединяет два speech provider-а в один контроллер.

## Добавленные регрессионные проверки

- `app/scripts/avatar-model-validation.test.mjs` — валидный GLB, повреждённые заголовки/chunks/JSON, external URL, некорректные buffer и bufferView, выход за объявленные границы, лимиты сложности, циклическая/много-родительская/глубокая иерархия.
- `app/scripts/avatar-3d-stage.test.mjs` — preflight до parser, запрет внешних URI и preservation существующего тела при отклонении новой модели.
- `app/scripts/avatar-humanoid-bone-map.test.mjs` — common VRM, Blender и Mixamo bone aliases должны попадать в тот же моторный vocabulary.
- `app/scripts/avatar-browser-voice-prosody.test.mjs` — детерминизм, диапазоны, позитивная просодия, деэскалация отрицательного возбуждения, влияние действия/черт и общий rate для TTS/lip timing.
- `app/package.json` — команды `test:avatar-model-validation`, `test:avatar-3d-stage`, `test:browser-voice-prosody`. Type stripping включён для test-script path, так как новая pure logic импортируется непосредственно из TypeScript-модулей.
- `.github/workflows/embodiment-quality-gates.yml` — отдельная проверка сборки и тестов воплощения на push/PR/ручном запуске. Она выполняет модельные проверки, voice prosody, Live2D timeline/expression cache, motor-intent regressions, app scripts, typecheck и build:dev.

## Проверка и статус доказательств

В этой рабочей сессии изменения записаны в GitHub feature-ветку. Публикация ветки/PR и успешный локальный файл-тест не должны подменять evidence от GitHub Actions. После создания PR нужно проверить:
1. exact head SHA в run;
2. `test:avatar-model-validation`, `test:avatar-3d-stage` и `test:browser-voice-prosody`;
3. существующие `test:embodiment-timeline`, `test:avatar-motor-intent`, `test:live2d-expression-cache`;
4. полный `test:scripts`, app typecheck и Vite build;
5. отсутствие регрессий в соседнем cognitive/runtime CI.

Пока exact-SHA run не завершился, состояние этих проверок — **ожидают независимого подтверждения**, а не PASS.

## Следующие необходимые этапы — направление не завершено

### Voice / audio
- единый UI/controller для browser TTS и Android/Termux runtime: provider capability, state, utterance ID, start/end/cancel/error, один lifecycle и достоверное разделение `interrupt requested` vs `playback stopped verified`;
- реальный RU/EN browser/phone test для speech boundary drift, долгих высказываний, tab backgrounding, remount, repeated interruption и новый ответ во время текущей речи;
- измерить lip-sync offset p50/p95 и cancellation latency; текущие таймлайны остаются приближёнными, пока provider не выдаёт фактические фонемы/PCM position.

### Live2D
- проверить на скриншотах/устройстве движение лица, рта, взгляда и выражения; быстрые переходы эмоций и restart viewer;
- расширить авторскую motion/expression library по смысловым состояниям вместо многократного переиспользования двух Special clips;
- проверить quality/mobile asset profile, DPR, FPS, memory, WebGL loss/recovery и отсутствие накопления listener/RAF/texture resources.

### Настоящий 2.5D
- отдельно создать оригинальный послойный artwork/PSD с дорисованными скрытыми участками, масками перекрытия, pivot metadata и outfit layers;
- подготовить глубинный rig, лицо/рот/взгляд, голова/корпус/руки, физику волос/ткани и bounds/IK;
- выбрать рендер-путь и контракт, но использовать общий организм-state; не называть текущий SVG-прототип 2.5D-ригом.

### Полноценный 3D
- отдельный художественно одобренный, лицензионно пригодный персонажный VRM/GLB; текущий procedural mesh — концепт, а не каноническая 3D Курису;
- VRM-aware adapter/runtime для humanoid bones, expression presets, look-at, spring bones, анимаций и корректной retargeting-семантики;
- валидация skeleton/morph mapping, сцены без костей, отсутствующих action-clips, восстановление модели, low-memory phone и очистка ресурсов;
- тесты на реальном браузере/устройстве, а не только проверка исходного кода.

### Релиз
- проверка лицензий/происхождения всех изображений, MOC3/Cubism SDK, шрифтов, моделей и VRM/GLB;
- чистая установка, полный app build, браузерный E2E, Android/Termux audio, длительный soak;
- только после exact-SHA gates — пересборка архивного артефакта, manifest/SHA-256 и публикация нового versioned Release ZIP. Этот проход Release ZIP не обновляет.

## Критерий закрытия

Направление не считается завершённым, пока Live2D, browser voice, runtime/Termux voice, 2.5D/3D mode selection, состояние организма, speech interruption, fallback, clean build и device tests не пройдут на одних и тех же проверяемых исходниках. Ни наличие компонента, ни unit test не заменяют реальный E2E и лицензионную проверку.
