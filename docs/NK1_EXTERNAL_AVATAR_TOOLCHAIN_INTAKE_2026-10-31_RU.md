# NK1 — внешний avatar toolchain: зафиксированный intake

Дата intake: 2026-10-31  
Назначение: локальная авторская проверка GLB/VRM и создание моделей; это не runtime dependencies NK1.

## 1. Khronos glTF Validator — Web bundle

- Предоставленный файл: `gltf_validator-2.0.0-dev.3.10-web.zip`
- SHA-256: `fca5e799652f73ffe3943a907c5ba990f3a1419940b9b72a5b2937b8ce88ace9`
- Встроенная версия отчёта: `2.0.0-dev.3.10`
- Лицензия верхнего уровня: Apache-2.0 (`LICENSE`); bundle содержит `NOTICES` с лицензиями Dart SDK и включённых зависимостей. При копировании отдельных файлов сохранять соответствующие notices.
- Состав: локальная HTML-страница, скомпилированный `scripts/validator.dart.js`, CSS/Prism и логотипы. Это самостоятельная web-страница, не npm-пакет и не Node CLI.
- Страница выполняет валидацию локально в браузере; экспортированный JSON-отчёт можно связать с NK1 evidence-bundle parser.

### Проверка полученного архива

Python `zipfile.testzip()` вернул `None`; все файлы архива читаются. Три нулевые directory-entry вызывают предупреждение в `unzip -t` текущего окружения, но обычные файлы проходят распаковку. Перед включением в публичный Release использовать проверенный исходный релиз или npm/CLI-дистрибутив с отдельным SBOM и notice inventory.

## 2. VRM Add-on for Blender

- Предоставленный файл: `VRM_Addon_for_Blender-4_10_3.zip`
- SHA-256: `dcf6d55f3d28de8c0de2f72abcc7fe06b2b300195e6b4da2e9cf476fd59165a2`
- Версия add-on из `blender_manifest.toml`: `4.10.3`
- Совместимость Blender: `4.2.0 <= version <= 5.3.0`
- Лицензия manifest: `MIT OR GPL-3.0-or-later`; в архиве есть отдельные тексты обеих опций и `LICENSE_MAIN.txt`.
- Для копирования исходников в NK1 выбрать и задокументировать конкретный разрешённый вариант (MIT для совместимого intake допустим только при соблюдении его условий), сохранить copyright/notice и проверить все vendored каталоги отдельно.
- Add-on использовать для authoring/import/export VRM; не встраивать его Python-код в web/runtime.

### Проверка полученного архива

Python `zipfile.testzip()` вернул `None`; ошибок CRC не обнаружено.

## 3. Интеграционное решение NK1

1. Не добавлять эти ZIP в `app/public`, runtime bundle или production Release без отдельного человеческого license/provenance approval.
2. Использовать Khronos Validator как независимый QA-инструмент. Его отчёт связывать с SHA-256 точных байтов и fingerprint конкретной модели.
3. Сначала запускать NK1 preflight (лимиты, GLB 2.0, external URI, graph/reference validation), затем принимать валидаторский отчёт. Ни один gate сам по себе не доказывает художественную корректность или калибровку рига.
4. VRM Add-on использовать для authoring/export и фиксации model/rig metadata; экспортированную модель прогонять через оба validator gates и калибровать конкретный rig.
5. Успешная локальная валидация не означает разрешение публичного распространения. `localViewAllowed` и `redistributionPermitted` — независимые решения.

## 4. Официальные источники

- Khronos glTF Validator: https://github.com/KhronosGroup/glTF-Validator
- Khronos Validator releases: https://github.com/KhronosGroup/glTF-Validator/releases
- VRM Add-on for Blender: https://github.com/saturday06/VRM-Addon-for-Blender
- VRM specification: https://github.com/vrm-c/vrm-specification
- three-vrm runtime: https://github.com/pixiv/three-vrm

## 5. Следующие acceptance gates

- [ ] Человек проверил полный `NOTICES` bundle для конкретной версии Validator.
- [ ] Человек выбрал лицензионный вариант Blender Add-on и проверил transitive/vendor notices.
- [ ] Для production model сохранены source URL/author, exact SHA-256, SPDX expression и отдельное разрешение на redistribution.
- [ ] Khronos report exact-byte digest и NK1 preflight receipt привязаны к одному model fingerprint.
- [ ] VRM calibration bundle создан из измеренной reference session для того же fingerprint и coordinate frame.
- [ ] Browser visual E2E и Android/Termux проверки выполнены на реальной модели.
