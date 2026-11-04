# NeuroCore Completion Kit v0.2.0 — установка в NK1

Полный переносимый архив содержит папку `completion-kit/` со скриптами, исходниками, архитектурным деревом, схемами, шаблонами и тестами.

## Проверка архива

Файл: `NeuroCore_Completion_Kit_v0.2.0-portable.zip`

SHA-256:

```text
6a2aca594f6c97dc4f4ac5dd82f057daa9a3e9766d5b8fabe33b818ff801668a
```

Размер: 65,090 bytes. ZIP содержит 50 записей; CRC-проверка пройдена.

PowerShell:

```powershell
Get-FileHash .\NeuroCore_Completion_Kit_v0.2.0-portable.zip -Algorithm SHA256
```

Linux/macOS:

```bash
sha256sum NeuroCore_Completion_Kit_v0.2.0-portable.zip
```

## Установка

Распакуйте ZIP из корня репозитория NK1 в каталог `runtime/neuro-kurisu/`. Должен появиться путь:

```text
runtime/neuro-kurisu/completion-kit/
```

Windows PowerShell:

```powershell
Expand-Archive -LiteralPath .\NeuroCore_Completion_Kit_v0.2.0-portable.zip -DestinationPath .\runtime\neuro-kurisu -Force
```

Linux/macOS:

```bash
unzip -o NeuroCore_Completion_Kit_v0.2.0-portable.zip -d runtime/neuro-kurisu
```

## Проверки

Требуется Node.js 22.12+. Из `runtime/neuro-kurisu/completion-kit`:

```bash
npm test
npm run gate -- foundation
npm run audit
npm run imports
npm run test-surface
npm run report
npm run verify
```

Gate runner использует clean Git worktree, exact branch/SHA и корневой `npm run neurok-os:evidence` для записи canonical PASS/FAIL receipt. Dirty worktree или stale SHA блокируют PASS/evidence receipt.

## Статус доказательств

Portable suite: **31/31 PASS** на Node.js 22.16.0. Локальный integration fixture проверил PASS receipt, FAIL receipt и блокировку receipt для dirty worktree. Fixture не является запуском настоящего NK1 CLI на полном checkout; это отдельно отмечено в `completion-kit/reports/PORTABLE_TEST_RESULTS_2026-11-04_RU.md`.

Проверка upstream `runtime/neuro-kurisu/package.json` версии `35.90.0` подтвердила, что все команды из Completion Kit gate matrix существуют: **0 missing scripts**.

Completion Kit не создаёт второго memory/identity/goal owner, не изменяет production state и не продвигает навыки автоматически. Внешние проекты и datasets остаются reference-only до проверки exact commit/tag, лицензии, безопасности, совместимости, ablation и rollback.
