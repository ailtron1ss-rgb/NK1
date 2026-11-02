# NK1 — спецификация тела Neuro Kurisu: 2D / 2.5D / 3D

Версия: 1.0
Статус: production specification; не является утверждением, что готовая модель уже создана.
Назначение: единая идентичность, выражения и анимационная семантика во всех renderer-профилях.

## 1. Инварианты персонажа

- Сохранять узнаваемый образ оригинального персонажа NK1, а не случайно менять лицо/возраст/пропорции между генерациями.
- Отделить неизменяемые признаки идентичности от сменных одежды, поз, эмоций и освещения.
- Создать нейтральный эталон: фронт, 3/4, профиль, полный рост, лицо крупно, нейтральная мимика, A-pose.
- Все производные модели должны иметь один versioned identity sheet, prompt provenance, seed/model metadata и контрольные изображения.
- Не переносить в арт-ресурсы приватные воспоминания или пользовательские данные.

## 2. 2D Live2D — основной гарантированный профиль

**Исходник**
- Многослойный PSD/эквивалент с раздельными слоями: волосы (перед/бок/затылок), лицо, уши, глаза/зрачки/блики/веки, брови, рот/зубы/язык, шея, одежда, руки и аксессуары.
- Обязательные скрытые участки под перекрытиями, без пустот при поворотах.
- Единый atlas/texture set, прозрачность, именованные группы и версия исходника.

**Rig**
- Параметры глаз, бровей, рта, головы X/Y/Z, дыхания, волос и одежды.
- Expressions: neutral, curious, focused, amused, concerned, tired, determined.
- Mouth shapes: A/I/U/E/O + closed/rest; синхронизация только от подтверждённого speech playback.
- Blink, gaze target, hair physics и secondary motion имеют отдельные лимиты и отключаемый reduced-motion режим.

**Приёмка**
- Нет швов/пустот при крайних углах головы; нет перепутанных левого/правого глаза.
- Каждая expression воспроизводима через semantic channels AvatarBrainAffectBridge.
- 60 fps target на desktop; mobile fallback с пониженной физикой.
- Проверить лицензии Cubism/runtime и право использования исходного artwork до включения в релиз.

## 3. 2.5D — глубина без смены идентичности

- Использовать утверждённый 2D master как единственный источник внешности.
- Слои: foreground hair/accessories, face/eyes, torso/clothing, background hair/body; отдельная depth map.
- Параллакс ограничить малым углом; запретить растяжение лица и изменение пропорций при движении камеры.
- Depth breathing и head turn должны принимать те же semantic channels, что и 2D.
- При потере depth map автоматически возвращаться к 2D без потери выражения/состояния.

**Приёмка:** нет разрыва силуэта, пересечений слоёв, открытых дыр и заметного scale drift; на Android не более одного дополнительного render pass относительно 2D baseline.

## 4. 3D — rigged VRM/GLB

**Исходник и геометрия**
- A-pose, humanoid skeleton, нейтральный bind pose, корректные оси/scale/origin.
- Целевой бюджет для первого mobile avatar: до 50k triangles, 1–2 material slots, 2K PBR textures; превышение требует профилирования и отдельного обоснования.
- Facial blendshapes для blink, gaze, brows, smile, frown, mouth open и пяти основных visemes.
- Hair/clothing secondary motion — ограниченная физика с безопасным отключением.

**Экспорт**
- VRM 1.0 для humanoid/expressions/look-at, GLB как interchange/preview asset.
- Сохранять исходный .blend/authoring source, текстуры, rig map, экспортный manifest и SHA-256 каждого артефакта.
- Верифицировать humanoid bone mapping, rest pose, normals, tangents, texture color space, blendshape names и import в целевой runtime.

**Приёмка**
- A-pose без перекрученных плеч/локтей/кистей; стопы и колени ориентированы корректно.
- Все semantic channels отображаются на существующие rig controls; отсутствующие controls не выдумываются.
- 30 fps minimum на целевом Android устройстве при включённых базовых выражениях; 60 fps desktop target.
- Отдельный test: interrupt speech → mouth rest ≤200 ms после подтверждённого interrupt receipt.

## 5. Общий контракт между мозгом и телом

- OrganismState/P2702 остаются владельцами когнитивного состояния и характера.
- AvatarBrainAffectBridge выдаёт bounded renderer-neutral projection.
- Lip-sync использует audio visemes/timing, а не предсказанную эмоцию; эмоция меняет prosody/face, но не подменяет фактический playback.
- Выражения сглаживаются и имеют hysteresis; сон/перегрев/низкая энергия выключают idle и lip-sync.
- Рендерер не получает память/текст эпизодов, приватные сведения или внутренние reasoning traces.

## 6. Asset provenance и релизный gate

Для каждого артефакта обязательны:
- source image/model and prompt provenance;
- provider/model/version/seed and generation job id;
- source license, provider terms and rights holder;
- hashes for source, textures, rig and exports;
- human visual approval;
- automated geometry/texture/rig validation;
- browser + Android runtime evidence.

Запрещено включать модель в публичный Release ZIP при неизвестной лицензии, отсутствии исходников/хешей, неподтверждённом humanoid rig или провале runtime import. Генерация в платном сервисе выполняется только после точной оценки стоимости и подтверждения выделенного бюджета.

## 7. Очередность производства

1. Заморозить identity sheet и проверить лицензионные ограничения.
2. Собрать/проверить полноценный 2D master и Live2D rig; не заменять уже существующий selectable Live2D профиль.
3. Создать 2.5D derived package из того же master и проверить fallback в 2D.
4. Сгенерировать 3D mesh из утверждённого reference, затем rig/retarget, проверить геометрию и экспорт.
5. Подключить каждый renderer к одному AvatarBrainProjection и провести browser/Android E2E.
6. Добавить только проверенные assets в release manifest; сохранить все предыдущие профили selectable.
