# Эксплуатационная карта Neuro-Kurisu

## Canonical source of truth

1. `src/organism/system/ReleaseContract.ts` — runtime release contract.
2. `VERSION.json` — машиночитаемая release metadata.
3. `package.json` — npm package metadata; проверяется против contract.
4. `package-lock.json` — воспроизводимый npm lockfile.

## Единый цикл

`observe → predict → deliberate → decide → authorize → act → feedback → learn → batch checkpoint → replay/integrity`

## Порядок перед изменением

```text
edit
↓
npm run verify:release-source
↓
npm run audit:syntax
↓
npm run audit:forensics
↓
npm run test:smoke
↓
npm run test:restart
↓
npm run release:audit
```

Тяжёлые `research:*` не являются обязательной частью production gate.

## Политика истории

Legacy и старые отчёты никогда не импортируются canonical runtime. Они находятся в `legacy-original/` и `docs/history/` и рассматриваются как immutable provenance.
