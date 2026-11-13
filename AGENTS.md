# Working on DTS-Calc

Read README.md and CONTRIBUTING.md before making changes. Preserve calculation accuracy, units, rounding and local-storage data (key `pace-calculator-state`, same JSON shape). The fixed mobile viewport and keyboard behavior are intentional; check narrow and short screens when modifying layout. Do not claim installed or offline behavior without testing it on the deployed origin.

Stack: Next 16 (App Router), React 18, strict TypeScript, Tailwind 4, Vitest, Playwright. Node 24 only (`.nvmrc`).

| Task | Command |
|---|---|
| Install | `nvm install && npm ci` |
| Dev server | `npm run dev` (port 3000; the service worker is off in dev) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm run test:ci` |
| Build (also writes the service worker precache list) | `npm run build` |
| Offline and upgrade e2e (Chromium) | `npm run test:e2e:offline` |

Layering: `lib/pure/*` has no side effects and holds all calculator rules; the screen is `components/PaceCalculator.tsx`; `hooks/useViewportLock.ts` keeps the app above the keyboard. `lib/infra/*` must not be imported by `app`, `components` or `hooks`. Do not loosen the ESLint layering rules to make something pass.

`public/sw.js` is the service worker and `lib/pure/swCacheStrategy.ts` mirrors its rules; change both together. The worker also deletes the old plain-JS worker's caches (`dts-calc-meta`, `dts-calc-<20 hex>`). `e2e/fixtures/old-prod-build` is that old production build, used by the upgrade test; do not edit it.

`lib/pure/calculator.golden.json` was recorded from the old plain-JS calculator and is replayed in `lib/pure/calculator.test.ts`. Do not regenerate it to make a test pass; a mismatch means behavior changed.

<!-- monoform:start -->
## Monoform design system

/DTS-Calc follows Monoform. Read `.monoform/rules.md` before changing UI. Colours, type scale, spacing and motion durations are the CSS variables in `.monoform/theme.css`; use the variables, never a literal.

- `.monoform/` is generated. Do not edit it by hand: change the design system repo and merge the sync PR it opens
- `.monoform/baseline.json` is this app's list of known rule breaks. It may only shrink. Check with `node <design-system>/tools/check scan . --name dts-calc`
- Sync PRs never touch `.github/workflows/**`
<!-- monoform:end -->
