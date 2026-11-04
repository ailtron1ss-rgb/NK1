# NeuroCore Completion Kit v0.1.0 — установка в NK1

Полный переносимый архив содержит папку `completion-kit/` со скриптами, исходниками, архитектурной картой, схемами, шаблонами и тестами.

## Проверка архива

Ожидаемый SHA-256:

```text
b1b3b5a8db38b112ef187ba89fab2b59cb197dd7c8588fd6de639ce4783e4433
```

PowerShell:

```powershell
Get-FileHash .\NeuroCore_Completion_Kit_v0.1.0-portable.zip -Algorithm SHA256
```

Linux/macOS:

```bash
sha256sum NeuroCore_Completion_Kit_v0.1.0-portable.zip
```

## Установка

Распакуйте ZIP из корня репозитория NK1 в каталог `runtime/neuro-kurisu/`. В результате должен появиться путь:

```text
runtime/neuro-kurisu/completion-kit/
```

Windows PowerShell:

```powershell
Expand-Archive -LiteralPath .\NeuroCore_Completion_Kit_v0.1.0-portable.zip -DestinationPath .\runtime\neuro-kurisu -Force
```

Linux/macOS:

```bash
unzip -o NeuroCore_Completion_Kit_v0.1.0-portable.zip -d runtime/neuro-kurisu
```

## Проверки

Требуется Node.js 22.12+. Перейдите в `runtime/neuro-kurisu/completion-kit`:

```bash
npm test
npm run audit
npm run imports
npm run test-surface
npm run report
npm run tree
npm run verify
```

`npm test` проверяет автономную тестовую поверхность Completion Kit. Команды `audit`, `imports` и `test-surface` анализируют соседний исходный код NK1, поэтому их результат имеет смысл только после распаковки внутри полного репозитория.

## Статус доказательств

Локально в чистом staging-каталоге portable suite завершился **24/24 PASS** на Node.js 22.16.0. Для одного теста promotion gate использовалась совместимая изолированная фикстура существующего NK1 bootstrap-контракта, поскольку полный runtime checkout не был подключён к staging-каталогу. Это не означает, что проверки полного NK1 runtime, CI, внешние holdout-наборы, Android/browser E2E или физические soak-тесты прошли.

Completion Kit не создаёт второй memory/identity/goal owner, не изменяет production state и не продвигает навыки автоматически. Внешние проекты и датасеты остаются reference-only до проверки точного commit/tag, лицензии, безопасности, совместимости, ablation и rollback.
