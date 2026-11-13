# Working on DTS-Calc

Read README.md and CONTRIBUTING.md before making changes. Preserve calculation accuracy, units, rounding, route segmentation and local-storage data. The fixed mobile viewport and keyboard behavior are intentional; check narrow and short screens when modifying layout. Do not claim installed or offline behavior without testing it on the deployed origin. Run `node --test tests/*.test.mjs` and perform the manual checks described in CONTRIBUTING.md.

<!-- monoform:start -->
## Monoform design system

/DTS-Calc follows Monoform. Read `.monoform/rules.md` before changing UI. Colours, type scale, spacing and motion durations are the CSS variables in `.monoform/theme.css`; use the variables, never a literal.

- `.monoform/` is generated. Do not edit it by hand: change the design system repo and merge the sync PR it opens
- `.monoform/baseline.json` is this app's list of known rule breaks. It may only shrink. Check with `node <design-system>/tools/check scan . --name dts-calc`
- Sync PRs never touch `.github/workflows/**`
<!-- monoform:end -->
