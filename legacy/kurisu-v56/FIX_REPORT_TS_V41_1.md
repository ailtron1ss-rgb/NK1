# TypeScript fix report — v41.1

## Errors from `npm run lint` (tsc --noEmit) — FIXED

1. **src/App.tsx:936** — `n.text` → `n.body` (`SMSNotification` uses `body`)
2. **src/App.tsx:1029–1030** — PersonalityMapPanel props:
   - removed invalid `currentExpression`
   - `onSelectExpression` → `onSetExpression` with type `AvatarExpression`
3. **src/components/Avatar2D.tsx:282** — removed invalid expression `'lab_coat_hero'`, use `'lab_lurker'`
4. **src/main.tsx:3** — `import App from './App.tsx'` → `import App from './App'`
5. **src/services/powerGovernor.ts:72** — added `import { runtimeGovernor } from './runtimeGovernor'`

## Extra checks
- Relative imports under `src/`: all resolve (0 missing)
- No remaining `lab_coat_hero` / `.tsx` extension imports / `n.text` in App
- `runtimeGovernor.fps()` exists

## Termux after replace
```bash
cd ~/kurisu_neuro_v40/kurisu_webapp   # or your path
npm run lint
npm run dev
```
