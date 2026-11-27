# Аудит вторичной физики канонической модели Neuro-Kurisu v5

Дата проверки: 27 ноября 2026 года  
Репозиторий: `ailtron1ss-rgb/NK1`  
Рабочая база: `workpass70-source`  
Канонический asset: `NeuroKurisu_3D_v5.glb`  
Каталог: `app/src/components/avatar/avatarModelCatalog.ts`

## Идентичность ресурса

Проверка выполнена на фактически скачанном GitHub Actions runner hosted GLB, а не на тестовой подмене.

- Размер: **2 035 768 bytes**
- SHA-256: `sha256:4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743`
- glTF nodes: **124**
- meshes: **101**
- Skin-joint nodes: **19**
- Raw morph target records: **10**
- Named morph targets recoverable from glTF extras: **9**
- Animations: **4**
- Container SHA, content length, GLB preflight, humanoid skin and named Kurisu animation: PASS

Source: `app/scripts/verify-hosted-kurisu-model.mjs`, workflow `NK1 Avatar Model Preflight`.

## Результат аудита физики

Реальный аудит semantic bone roles возвратил:

| Слой | Найдено костей | Корней цепочки | Результат |
|---|---:|---:|---|
| Отдельные пряди волос | 0 | 0 | Не готов |
| Панели/полы одежды | 0 | 0 | Не готов |
| Рукава/манжеты | 0 | 0 | Не готов |
| Нейронные волокна | 0 | 0 | Не готов |
| Все распознанные вторичные кости | **0** | — | **Не готов** |

В качестве кандидатов на дальнейшую разметку инвентаризация нашла 14 именованных суставов основного Humanoid:

`leftUpperLeg`, `leftLowerLeg`, `leftFoot`, `rightUpperLeg`, `rightLowerLeg`, `rightFoot`, `leftShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand`, `rightShoulder`, `rightUpperArm`, `rightLowerArm`, `rightHand`.

Они не считаются вторичными цепочками: это основные суставы скелета. Центральные кости и лицо также исключены из списка кандидатов по правилам аудита. **Не переиспользовать основные плечи/руки/шею/голову под имитацию волос или ткани.**

Поддерживаемые morph-алиасы вторичной физики в v5 не обнаружены:

- `NK1_Cloth_Sway` / `ClothSway`
- `NK1_Hair_Sway` / `HairSway`
- `NK1_Tissue_Breath` / `SoftTissueBreath`
- `NK1_Neural_Pulse` / `NeuralPulse`

Специально размеченных emissive-материалов NK1 neural fabric: **0**. Это не означает, что в модели нет обычных материалов или facial morphs; это означает, что нужные каналы вторичной физики не экспортированы/не размечены.

Вывод: текущая v5 — пригодная базовая humanoid-модель с анимацией и лицевыми morph targets, но **не готовый физически-модульный персонаж**. Новая пружинная система не должна заявлять, что двигает несуществующие кости или morph targets. Для этой модели ожидается fail-closed/no-op до добавления геометрии и рига.

## Техническое задание на следующий проход по самому asset

### 1. Волосы

- Сохранить исходную линию волос, форму чёлки, длину, цвет и объём прядей.
- Разделить только существующие визуальные пряди на независимые группы там, где это уже поддерживается геометрией.
- Создать цепочки типа `HairLockL_Root → HairLockL_Mid → HairLockL_Tip`, аналогично для правой стороны и отдельно для чёлки.
- Корни привязать к черепу; физику разрешить только для mid/tip.
- Силуэты вокруг глаз и лица не должны пересекать лицо при крайних поворотах.

### 2. Одежда

- Не менять исходный дизайн лабораторного халата, воротника, лацканов, галстука и общей посадки костюма.
- Для реальных свободных элементов добавить отдельные цепочки типа `CoatPanelL_Root → CoatPanelL_Mid → CoatPanelL_Hem`, `SkirtBackPanel_Root → SkirtBackPanel_Tip`, `SleeveFollowL`, `SleeveCuffR`.
- У каждой цепочки должны быть однозначная сторона, parent hierarchy, корректные skin weights и исключённые из симуляции anchor/root узлы.
- Не применять одинаковую физику к жёстким лацканам, прилегающим рукавам и свободной ткани.

### 3. Кожа и мягкие ткани

- Не деформировать геометрию лица и глаз новым общим soft-body слоем.
- Сначала добавить ограниченные авторские shape keys для дыхания грудной клетки/торса и только тех мягких областей, где деформация анатомически оправдана.
- Для runtime использовать только экспортированные и явно именованные каналы; не угадывать morph по похожему имени.
- Держать амплитуды малыми, ограниченными и независимыми от facial expression/viseme channels.

### 4. Нейронные элементы костюма

- Использовать существующие конструктивные швы и детали, а не добавлять сплошную неоновую поверхность.
- Добавить небольшие авторские эмиссивные вставки/материалы, явно помеченные `NK1_NEURAL_...` либо `userData.nk1DynamicLayer = "neural"`.
- Отдельный morph `NK1_Neural_Pulse` допустим только при наличии отдельной геометрии.
- Не менять базовый цвет, карту нормалей, roughness и metalness остального костюма.

## Что уже реализовано на стороне программного обеспечения

- `AvatarNeuroAdaptiveDynamics`: bounded fixed-step spring-damper для уже размеченных secondary bones.
- Morph mapping для четырёх специальных каналов только если они реально существуют.
- Emissive modulation только для явно размеченного neural fabric.
- Mobile quality tiers, sleep settling, reset при замене модели.
- Runtime audit в 3D панели: bone counts, chain roots, morph aliases, neural materials и имена неразмеченных костей.
- Hosted GLB audit в CI по фактическому бинарному v5: hash/size/preflight + skin joint ancestry + morph/material inventory.

## Границы проверки

- Этот отчёт описывает только закреплённый v5 GLB и его проверенный SHA.
- Он не переносит выводы на v7/v12 preview-кандидаты.
- Бинарный файл v5 этим проходом не менялся; каталог и Release не переопределялись.
- Отсутствующие в модели secondary bones/morph targets не «добавляются» runtime-кодом.
- Это аудит glTF node/skin/morph/material structure, а не визуальное подтверждение правильности skin weights, коллизий, деформации ткани или анатомической формы.
- Полноценная vertex-level cloth/soft-body симуляция ещё не реализована; текущая физика — bounded bone-driven secondary dynamics.
