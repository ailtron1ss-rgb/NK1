# Forensic Audit Guide

## Единый быстрый gate

```bash
npm run release:audit
```

## Детальные проверки

```bash
npm run verify:release-source
npm run doctor
npm run audit:syntax
npm run audit:forensics
npm run audit:full
npm run audit:architecture
npm run audit:contract
npm run audit:hygiene
npm run audit:legacy
npm run typecheck
```

## Что именно ищут проверки

- Несовпадение версии application/core/schema/phase.
- Несовпадение package.json и package-lock.json.
- Появление внешних npm dependencies.
- Неверные или отсутствующие relative imports.
- Runtime import cycles.
- Leakage из legacy/research в canonical.
- Пустые файлы.
- Дублирующееся содержимое.
- Дублирующиеся имена активных файлов (кроме допустимых `index.ts`).
- Абсолютные build paths.
- Исторические version markers.
- CRLF/trailing whitespace/excessive blank lines.
- Некорректный JS/MJS/SH/JSON syntax.
- Повреждение legacy snapshot по историческому SHA-256 manifest.
- Невоспроизводимость semantic TypeScript check. В отсутствие `tsc` используется Node 22 strip-types syntax/runtime-resolution fallback; он помечен как syntax-only.

## Правило истории

Никогда не импортировать код из `legacy-original/`, `history/` или research history в canonical runtime.
