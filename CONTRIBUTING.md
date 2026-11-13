# Contributing

Node 24 is required (`.nvmrc`). npm 11 is needed for the lockfile.

```sh
nvm install
npm ci
npm run dev            # http://localhost:3000, service worker off
```

Before opening a PR run all of these. CI runs the same set:

```sh
npm run typecheck
npm run lint
npm run test:ci
npm run build
npx playwright install --with-deps chromium   # once
npm run test:e2e:offline
```

The e2e run builds and serves the app, then checks: 10 km in 50 minutes gives 12 km/h and 5:00 min/km, saved values survive a reload, the app works offline from the service worker, the link-preview tags, and an upgrade from the old production build (saved values kept, old caches cleared, a failed install changes nothing).

For calculation changes, check 10 km in 50 minutes gives 12 km/h and 5:00 min/km; exercise both unit systems and invalid inputs. Calculator rules live in `lib/pure` and are pinned by `lib/pure/calculator.golden.json`; see AGENTS.md.

For layout or storage changes, reload and test on a narrow mobile viewport, including the keyboard, and reset. On-screen keyboard behavior and the installed home-screen upgrade can only be checked on a real phone: open the installed copy, launch it once online, then launch it again and check your saved values are still there. These browser and device checks are manual and are not replaced by the test suite.
