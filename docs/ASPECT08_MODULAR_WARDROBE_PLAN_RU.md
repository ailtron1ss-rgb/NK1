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
- **Не реализовано:** чтение/хэширование реальных файлов, установка пакетов, долговременное хранение выбора, UI гардероба, подключение к Live2D/Cubism, depth-2D и VRM renderer, физика ткани и визуальные E2E.
- **Не подтверждено:** выполнение новых тестов и typecheck на последнем HEAD через GitHub Actions; пустой ответ commit-scoped workflow lookup не считается успешным CI.

## Progress

- Wardrobe domain/data contract: 80% for the first implementation slice.
- Selection policy: 75% for the first implementation slice.
- Actual interchangeable garment assets: 0% verified.
- Live2D/2.5D/VRM renderer application: 0% integrated by this pass.
- Whole Aspect 08: 25% (conservative; asset creation and visual E2E dominate remaining work).

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
