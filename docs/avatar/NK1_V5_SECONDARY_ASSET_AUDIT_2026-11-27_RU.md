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


## Проверка реальных skin weights — hosted preflight 2026-11-27

После инвентаризации выполнен read-only проход по glTF `JOINTS_0/WEIGHTS_0` (и дополнительным наборам, если они присутствуют). Проверка прошла для **99 из 99 skinned mesh nodes**, всего обработано **31 047 вершинных выборок**. Предупреждений о повреждённых accessor, stride, индексах суставов или диапазонах данных нет; лимит аудита не достигнут.

### Волосы

Все перечисленные отдельные hair meshes имеют 100% влияния `head`:

| Mesh node | Вершин в выборке | Текущая привязка |
|---|---:|---|
| `HAIR_back_mass` | 607 | head 100% |
| `HAIR_crown` | 607 | head 100% |
| `HAIR_fringe_center` | 429 | head 100% |
| `HAIR_fringe_left/right` | 429 каждый | head 100% |
| `HAIR_front_strand_L/R` | 637 каждый | head 100% |
| `HAIR_layer_L0–L2/R0–R2` | 637 каждый | head 100% |
| `HAIR_long_lock_L/R` | 423 каждый | head 100% |

Следовательно, волосы уже разделены на независимые геометрические части, но сейчас все они жёстко следуют за головой. Чтобы получить инерцию прядей, нужно добавить новые кости в skin и перераспределить веса внутри соответствующих hair meshes: корни оставить на `head`, середину и кончики плавно перевзвесить на цепочку secondary joints. Одного включения runtime spring solver недостаточно.

### Одежда и тело

| Mesh node | Вершин в выборке | Текущие основные влияния |
|---|---:|---|
| `CLOTH_labcoat_main` | 423 | hips: 52.96% вершин (средний вклад 0.4199); chest: 47.04% (0.3453); spine: 47.28% (0.2348) |
| `CLOTH_skirt` | 423 | hips 100% |
| `CLOTH_upper_sleeve_L/R` | 204 каждый | соответствующие upper/lower arm |
| `CLOTH_lower_sleeve_L/R` | 204 каждый | соответствующие lower arm/hand |
| `CLOTH_lapel_left/right` | 423 каждый | chest 100% |
| `CLOTH_collar_L/R` | 185 каждый | chest 100% |
| `CLOTH_tie_blade/knot` | 423 каждый | chest 100% |
| `CLOTH_pocket_L/R`, `CLOTH_pocket_flap_L/R` | 151–185 каждый | chest 100% |
| `CLOTH_hem_stitch` | 845 | chest 100% |

Верхний и нижний рукава уже имеют распределение между соответствующими суставами руки: каждый из двух соседних суставов влияет примерно на 60.3% выборки. Эти доли перекрываются — это не проценты, которые нужно складывать. Для показанных мешей все вершины имеют веса, а сумма весов на вершину близка к 1; незаполненных вершин в этих выборках нет.

### Вывод для следующей операции с GLB

1. Волосы: добавлять цепочки `HairLockL/R` для длинных прядей и `HairFringeL/R` для свободных участков чёлки; существующую `head`-привязку сохранять на корневых зонах. Не назначать secondary bones на всю голову или face mesh.
2. Юбка: добавить закреплённый waist/root от `hips`, mid и hem joints; плавно переводить веса от hips к mid/hem только к нижней части юбки.
3. Халат: добавить отдельные left/right panel и hem chains; сохранить текущий hips/chest/spine как базу и распределить дополнительные веса по свободным полам, не двигая жёстко лацканы.
4. Рукава: не перепривязывать их заново. Добавить ограниченный secondary follow chain поверх текущих upper/lower-arm weights; основной сустав остаётся источником базового движения.
5. Галстук: отдельная цепочка knot/root → blade tip, с очень небольшой амплитудой.
6. После правки каждого mesh повторять этот sampler и сравнивать сохранение суммы весов, coverage основных joints и отсутствие unweighted vertices.

Это карта текущих skin weights, а не результат изменения GLB: оригинальный v5 не изменён, Release не обновлялся.


## Геометрическая модульность для runtime-диагностики

По полному inventory GLB уже существуют отдельные узлы и meshes:

- Волосы: `HAIR_back_mass`, `HAIR_crown`, `HAIR_fringe_center/left/right`, `HAIR_front_strand_L/R`, `HAIR_layer_L0-L2/R0-R2`, `HAIR_long_lock_L/R`.
- Одежда: `CLOTH_labcoat_main`, `CLOTH_skirt`, `CLOTH_tie_blade/knot`, `CLOTH_lapel_left/right`, `CLOTH_collar_L/R`, `CLOTH_pocket_L/R`, `CLOTH_pocket_flap_L/R`, `CLOTH_button_0-3`, `CLOTH_hem_stitch`.
- Рукава: `CLOTH_upper_sleeve_L/R`, `CLOTH_lower_sleeve_L/R`.

В hosted audit inventory всего 101 mesh-node; 99 из них skinned к общей skin. Автоматическая role-классификация raw GLB находит **15 hair meshes, 19 garment meshes и 4 sleeve meshes** (все 38 привязаны к общей skin). Для текущей runtime-панели введён отдельный подсчёт mesh roles: hair / garment / sleeve. Он специально не повышает состояние `secondaryPhysicsReady`: наличие отдельных meshes не означает наличие вторичных костей или реальной симуляции.

