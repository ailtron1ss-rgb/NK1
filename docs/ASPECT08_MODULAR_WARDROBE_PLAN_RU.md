# NK1 Aspect 08 — Modular wardrobe, clothing and accessories

Date: 2026-10-30  
Branch: `work/nk1-wardrobe-modular-clothing-pass-2026-10-30`  
Base: `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`

## Objective

Turn outfit selection from a legacy visual-profile label into a renderer-independent wardrobe domain that can eventually drive actual Live2D, depth-2D and VRM/3D garment assets. The wardrobe is owned by the organism's presentation/embodiment layer; it must not fork identity, emotion or motor state.

## Verified starting point

- `app/src/legacy/avatar/outfitCatalog.ts` defines six profiles but each profile mainly chooses existing sprite preferences and tags.
- `legacy/kurisu-v56/src/avatar/outfitCatalog.ts` contains six color/palette profiles and optional image paths, but this is legacy code and does not prove those image assets are present in the active runtime.
- `avatarModelStore.ts` stores one active VRM/GLB body model locally; it is not a wardrobe store.
- The canonical Live2D model has expressions/motions but no verified interchangeable clothing mesh/texture pack in the active asset tree.
- No redistributable, verified garment pack was found in the canonical source tree. Therefore no clothing assets are claimed as implemented by this pass.

## Design

### 1. Renderer-independent wardrobe domain

- Garment slots: outerwear, top, bottom, footwear, hair, hair accessory, neck/ear/wrist accessory and handheld item.
- Outfit definitions reference garment IDs rather than duplicating visual properties.
- Every garment can declare independent asset availability for Live2D, depth-2D and VRM/3D.
- Asset state is explicit: missing, concept, authored, verified.
- Only verified assets with safe relative paths may be resolved by a renderer.
- Dependency, exclusion and duplicate-slot validation prevents impossible combinations.

### 2. Selection policy

- A user-pinned outfit always wins.
- Autonomous recommendations are advisory and require `autoChangeEnabled=true`.
- Recommendations use semantic context (sleep/rest, scientific work, presentation, social interaction), energy and thermal comfort—not wall-clock time alone.
- Recommendation is separate from applying a garment. The renderer must acknowledge a successful asset load before the active appearance is changed.
- Never silently replace a user choice, and never claim a garment is displayed if the selected renderer has no verified asset.

### 3. Renderer integration roadmap

**Live2D:** only use Cubism-supported parameter/texture/part switching that the licensed model actually exposes. If the model does not expose a clothing part or drawable, show the limitation; do not simulate a full outfit by changing a profile label.

**2.5D:** use layered art with underdrawn occlusion regions, stable pivots, masks and garment-specific deformation weights. A garment pack must include body-size/rig compatibility metadata.

**VRM/3D:** use modular skinned meshes or validated modular avatar parts, matching humanoid bind pose and skeleton, material slots and collision/cloth constraints. Refit and revalidate weights when changing body models.

### 4. Required data contract for future asset packs

Each pack should declare: pack ID/version, creator/source, license and attribution, target body ID/version, renderer formats, supported slots, garment IDs, texture/material references, skeleton/rig compatibility, dimensions, checksums, and provenance. Reject remote URLs, path traversal, unsupported formats, oversized files, missing licenses and mismatched body rigs.

### 5. Acceptance gates for 100%

1. Six outfit families have real authored assets in each supported renderer (or explicit capability gaps).
2. Garments are independently selectable by slot.
3. At least two compatible variants can be layered without duplicate-slot or dependency conflicts.
4. Clothing follows body deformation and motion without visible clipping in a reviewed pose suite.
5. Hair/accessories remain attached to their anchors during head/body movement.
6. Switching outfits preserves identity, emotion, speech, gaze and motor state.
7. User pin, manual selection, auto opt-in, rollback and persistence work.
8. Invalid/unlicensed/mismatched packs are rejected.
9. Desktop and Android E2E validate the rendered result—not only metadata.
10. The release manifest records asset provenance, licenses and hashes.

## This pass — actual implementation

- Added `wardrobeSystem.ts`: typed garment slots, six outfit families, per-renderer asset status, dependency/exclusion validation, safe asset-path validation, context-aware recommendation and verified-only asset resolution.
- Added focused regression tests for catalog integrity, safe paths, user override, autonomous opt-in and asset resolution.
- Important boundary: the catalog deliberately marks every new garment asset as missing. It does not pretend that metadata equals drawable clothing. Next pass must author/acquire rights-cleared source assets and wire renderer-specific application.

## Второй инженерный проход — pack integrity и безопасное переключение

- Добавлен `wardrobePack.ts`: схема пакета с версией, автором, HTTPS-источником, идентификатором лицензии, атрибуцией, целевой моделью тела и версией рига.
- Для каждого ресурса обязательны уникальные ID/пути, слот, рендерер, SHA-256, размер и MIME; ограничены число файлов, размер одного ресурса и суммарный размер пакета. MIME должен соответствовать расширению файла.
- Валидатор не загружает и не исполняет содержимое. Он проверяет декларации; фактические байты обязан отдельно проверить загрузчик по SHA-256 перед передачей рендереру.
- Добавлен двухфазный протокол переключения: сначала проверка совместимости body/rig и подготовка плана; затем commit только после подтверждения точного request ID и полного набора загруженных ресурсов.
- Ошибка, частичная загрузка или устаревшее подтверждение не меняют текущий outfit; предыдущий образ остаётся активным.
- Тесты покрывают отсутствие лицензии/атрибуции, HTTP-источник, traversal, повторные пути, неверный хэш, несоответствие MIME, повреждённые элементы, размер, несовпадение тела/рига, частичное и устаревшее подтверждение.
- `npm run test:wardrobe` теперь включает оба набора регрессий.

### Точная граница готовности второго прохода

- **Реализовано:** доменная модель, рекомендация, декларативный pack gate, протокол commit/rollback и регрессионные сценарии.
- **Реализовано в третьем проходе:** проверка фактических байтов по SHA-256 и размерам; whole-pack gate требует все заявленные файлы и отклоняет незаявленные.
- **Не реализовано:** файловый/network loader, установка пакетов, долговременное хранение выбора, UI гардероба, подключение к Live2D/Cubism, depth-2D и VRM renderer, физика ткани и визуальные E2E.
- **Не подтверждено:** выполнение новых тестов и typecheck на последнем HEAD через GitHub Actions; пустой ответ commit-scoped workflow lookup не считается успешным CI.

## Progress

- Wardrobe domain/data contract: 90% for the metadata/control foundation.
- Selection policy: 75% for the current implementation slice; recommendations remain advisory until a user-enabled runtime applies them.
- Pack declaration + actual-byte/whole-payload integrity gates: 90% for the validation foundation.
- VRM/3D pack loader and application API: 80% for the isolated loader/rig-preflight/rollback contract; UI and Avatar3DStage integration remain pending.
- Actual interchangeable garment assets: 0% verified.
- Live2D/2.5D renderer application: 0% integrated; Live2D capability inspection is present but no garment switch contract is confirmed.
- Whole Aspect 08: 45% (conservative; real licensed assets, stage UI/state integration, other renderers, visual E2E and device validation remain substantial).

## Next work

1. Inventory the complete canonical and legacy asset trees for clothing-related textures, sprites, model parts and licenses.
2. Confirm whether any source art can legally be separated/repacked.
3. Create a wardrobe-pack validator and persistent selected-outfit state.
4. Author the first rights-cleared modular 3D garment pack for the canonical body.
5. Produce a depth-2D layered garment pack from source art.
6. Only then connect renderer application APIs and visual E2E.

## Second-pass implementation: byte-level integrity

`verifyWardrobeAssetBytes` now checks the actual `ArrayBuffer` / `Uint8Array` received by a future loader against the manifest's declared byte count and SHA-256 digest using Web Crypto. It returns explicit outcomes for verified bytes, size mismatch, hash mismatch, invalid metadata and unavailable crypto. The check is deliberately independent from licensing: a matching digest establishes byte identity only, not rights or attribution.

The focused regression suite includes the published SHA-256 test vector for `abc`, plus tampered-hash, incorrect-size and unavailable-provider cases. The runtime loader still needs to call this gate before renderer acknowledgement; no loader or actual clothing assets are claimed in this pass.

## Третий инженерный проход — проверка полного payload пакета

- Добавлен `verifyWardrobePackPayload`: пакет считается byte-verified только если каждый путь из манифеста присутствует, каждый файл проходит проверку размера и SHA-256, а незаявленные дополнительные файлы отсутствуют.
- Результат возвращает список подтверждённых asset ID и точные причины отказа по путям; повреждённый, неполный или расширенный посторонними файлами пакет не проходит gate.
- Добавлены тесты для корректного полного payload, отсутствующего файла и незаявленного лишнего файла.
- Это ещё не файловый загрузчик и не установка пакета: интеграция должна передать реальные байты в этот gate, а лицензия/подпись/происхождение остаются отдельными проверками.


## Четвёртый инженерный проход — фактическая возможность смены одежды в Live2D

Инвентаризация дерева активной ветки выявила существующую каноническую модель Kurisu:
- Desktop Cubism model3 с одним atlas texture 4096 и общими moc3/physics/CDI;
- Mobile model3 использует отдельную производную текстуру 2048, но те же moc3, physics, CDI, motions и expressions;
- model3 регистрирует 5 motion clips в 4 группах и 8 expressions;
- CDI содержит параметры физики одежды/волос/обуви (например, LowerCoatPhy, TiePhy, ShirtPhy, ShoesPhy), но это параметры деформации, не переключатели независимых предметов;
- expression `Arm Change` меняет `HandChange`, что также не является wardrobe slot.

**Ключевой вывод:** наличие одежды в текстуре и физики пальто/галстука не означает, что Cubism-модель позволяет подменять одежду. В JSON metadata не обнаружен явный wardrobe/outfit/garment switch contract. Реальная проверка drawable/part IDs требует инспекции moc3 через Cubism SDK/Editor; до этого Live2D одежда остаётся `no-switch-contract`, без поддельной активации.

Добавлен `live2dWardrobeCapability.ts` — консервативный анализатор model3/CDI/expression metadata. Он:
- не принимает texture atlas или physics-параметры за сменную одежду;
- сверяет expression-параметры с CDI;
- различает отсутствие контракта, expression-only ограниченные controls и candidate wardrobe-параметр; даже такой параметр не включает одежду без подтверждённой привязки к drawable/part в moc3;
- возвращает ограничения, которые должен обработать будущий renderer adapter.

Добавлен `live2d-wardrobe-capability.test.mjs` с тестами отсутствия контракта, expression-only ограничения, явного outfit-параметра и повреждённого manifest. `npm run test:wardrobe` теперь включает этот набор.

### Реальная оценка после инвентаризации

- Live2D media/physics: уже существует и пригоден для текущей анимации лица/тела.
- Live2D независимая смена одежды: не подтверждена; JSON-level capability inspector добавлен.
- 2D sprite library: 32 полных статичных PNG в четырёх наборах; это готовые позы/сцены, не независимые garment layers.
- 2.5D wardrobe: исходные раздельные слои/маски/пивоты пока не найдены в активном manifest.
- VRM/3D: есть procedural body и пользовательская загрузка модели, но production-ready модульный комплект одежды не подтверждён.

Следующий правильный шаг — проверить фактические drawable/part IDs и texture atlas в Cubism Editor/SDK, а не пытаться подменить части модели через случайные параметры. Параллельно следует подготовить первый настоящий 2.5D layered asset contract: body occlusion masks, garment layers, pivots, deformation weights и per-pose validation.


## Runtime activation boundary — 2026-10-30

Added `wardrobeRuntime.ts`: the runtime now has one preparation entry point that accepts a manifest, byte map and switch request. It verifies the whole payload, ensures each requested ID belongs to the selected renderer and has passed byte verification, then checks body/rig compatibility before returning a ready plan. A helper rejects stale, failed, partial and duplicate renderer acknowledgements. This is an integration contract only: it does not yet fetch files, verify legal rights, persist state, or apply meshes/textures in Live2D/depth-2D/VRM.


## Пятый инженерный проход — VRM skinned-garment adapter (2026-10-30)

Добавлен `vrmWardrobeAdapter.ts` для следующего конкретного этапа после проверки байтов пакета:
- анализирует фактические Bone-иерархии одежды и загруженного аватара, нормализует имена костей и fail-closed отклоняет отсутствующие/неоднозначные кости;
- сравнивает garment inverse bind matrices с target bind pose тела (допуск 1e-4), отклоняет несовпадающие rest poses и использует inverse matrices аватара при remap;
- переносит skinned garment на кости аватара через новый Skeleton, сохраняя bind matrix меша;
- разрешает attachment только при `ready` switch plan и наличии точного asset ID в `expectedAssetIds`;
- сначала клонирует и переназначает весь garment, затем добавляет его в сцену и только после успешного attach скрывает прежний предмет того же slot. Ошибка подготовки не меняет активный образ.

Добавлен `vrm-wardrobe-adapter.test.mjs`: нормализованные имена костей, отсутствующая и дублирующаяся кость, статический/non-skinned ресурс, запрет asset ID вне switch plan, успешное remap и замена слота. Набор включён в `npm run test:wardrobe`; добавлен отдельный PR workflow `.github/workflows/nk1-wardrobe-validation.yml` (Node 22.12, `npm ci`, focused wardrobe suite).

**Граница:** adapter написан, но пока не подключён к `Avatar3DStage` загрузчику VRM/GLB и не имеет настоящего garment pack для проверки. Требуются loader/UI для выбора pack и asset ID, rights/provenance gate, реальные skinned garment meshes с корректным rig/rest pose, материалы/occlusion, визуальные тесты на нескольких позах и Android/desktop E2E. Никакой фактический outfit-switch на загруженной пользовательской модели пока не заявляется.


## Шестой инженерный проход — verified VRM wardrobe pack loader (2026-10-30)

Добавлен `vrmWardrobePackLoader.ts` — первая исполняемая orchestration-цепочка от байтов пакета до применения одежды к уже загруженному Three.js avatar:
- повторно выполняет структурную, SHA-256/size, whole-pack, renderer, body и rig-проверку через общий runtime gate;
- разрешает только `vrm3d` assets в формате бинарного `.glb`;
- до вызова GLTFLoader проверяет GLB v2 header/length/JSON chunk и блокирует внешние buffer/image URI, чтобы загрузчик не вытягивал произвольные ресурсы по сети;
- парсит и проверяет все ожидаемые garment roots, затем preflight-проверяет их skinned meshes, кости и bind pose относительно текущего avatar;
- применяет комплект как пакетную операцию; если attachment или acknowledgement не проходит, удаляет добавленные элементы и восстанавливает видимость/metadata предыдущих слотов.

Добавлен `vrm-wardrobe-pack-loader.test.mjs`: корректный self-contained GLB, external URI rejection, успешное применение после byte verification и rollback при ошибке parse. Suite подключён к `npm run test:wardrobe` и отдельному GitHub Actions path filter.

**Что теперь реально сделано:** существует production API для проверки, GLB parsing, rig preflight и применения VRM garment pack. **Что ещё не сделано:** UI выбора/импорта пакета, постоянное состояние гардероба, вызов API из `Avatar3DStage`, реальные rights-cleared skinned garment GLB, адаптеры Live2D/2.5D, визуальный E2E и Android/desktop проверки. Тестовый GLB в suite — структурная фикстура, а не одежда для Курису.



## Текущий CI evidence checkpoint — 2026-10-30

- Последний завершённый wardrobe workflow на HEAD `e49bd6eba0c55b37a21571975a521bbfe5417a6e`: 37 tests passed, 0 failed, 0 skipped. Включены новые GLB loader, external URI rejection, rig preflight, successful apply и rollback cases.
- Предыдущий core regression run поймал один TypeScript strict-mode дефект (implicit `any` у callback GLTFLoader); callback типизирован в последующем commit. Повторный core typecheck на обновлённом HEAD обязателен перед заявлением о полной CI-готовности.
- Draft PR остаётся открытым; никаких claims о real garment assets, visual E2E или Release ZIP refresh нет.


## Седьмой инженерный проход — выбор комплектов в реальной Avatar3DStage (2026-10-30)

В `Avatar3DStage.tsx` добавлены три реальные процедурные вариации одежды: лабораторный халат, повседневный верх и худи. Они представлены отдельной геометрией Three.js и переключаются через видимость garment-групп; элементы халата/галстука/рукавов скрываются согласованно, а выбранный вариант применяется к живому процедурному телу. Добавлены видимые элементы управления и регрессионная проверка, что переключение связано с геометрией, а не только с подписью.

**Граница:** переключение работает для встроенного процедурного концепта. Произвольная загруженная VRM-модель не получает эти комплекты автоматически: для неё по-прежнему нужны реальные совместимые skinned GLB, манифест и вызов `applyVerifiedVrmWardrobePack`. Выбор пока не сохраняется между сессиями; Live2D/2.5D не подключены.
