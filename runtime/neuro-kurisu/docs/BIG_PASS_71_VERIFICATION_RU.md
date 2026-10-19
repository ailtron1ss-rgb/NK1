# BIG PASS 71 — verification

Проверять как минимум:
- `npm run test:big-pass-71`
- `node --experimental-strip-types tests/big-pass-70-contextual-carryover.mjs`
- `npm run test:big-pass-68`
- `npm run test:big-pass-67`
- `npm run audit:pass71`
- `npm run server:smoke`
- operational 250/500/1000

Не считать timeout PASS. Причину long-horizon фиксировать отдельно от функционального verdict.
