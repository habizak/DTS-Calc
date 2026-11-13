# Contributing

Serve the static site with `python3 -m http.server 8000` and open http://localhost:8000. Node 20 or newer and the locked development dependencies are needed for regression tests. The load tests use Playwright (Chromium and WebKit):

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm test
```

For calculation changes, check 10 km in 50 minutes gives 12 km/h and 5:00 min/km; exercise both unit systems and invalid inputs. For layout or storage changes, reload and test on a narrow mobile viewport, including keyboard, and reset. These browser and device checks are manual and are not replaced by the unit suite.
