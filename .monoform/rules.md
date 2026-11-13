# App Artisans — Agent Decision Rules

> Machine-readable. No narrative. Pure conditionals.
> Inject this into agent context when generating App Artisans UI.
> For token values, reference `tokens.json`.

---

## 1. Color

- Monoform has **no official palette**. Each app owns its colours. Every app theme fills the same role names: `bg`, `surface`, `border`, `text-primary`, `text-secondary`, `text-disabled`, `accent`, `on-accent`, `warn`, `error`, `overlay`. Resolve `color.{mode}.<role>` from the active app theme (`tokens.json` → `color.themes`)
- Never hard-code a hex in a component. Reference the role
- `accent`, `warn`, `error` are optional per app. No accent → focus ring and primary fills use `text-primary`, label uses `bg`
- Contrast tiers (APCA Lc): `text-primary` ≥ 90 (500 weight may drop to 75), `text-secondary` ≥ 75, `border` ≥ 15
- Fill labels: text on `accent`, `warn`, `error` fills uses `on-accent`, always weight 500, target Lc 75. Fills that miss it are listed as known deviations in `tokens.json`, never silently accepted
- `text-disabled` is for disabled controls and labels only. It is exempt from readability (Lc 15 floor so it still shows). Never put real information in it. There is no "muted", "faint" or "dimmed" text tier
- `error` → use ONLY for: destructive actions, validation errors, critical alerts. Do NOT use for warnings, info, empty or loading states
- `warn` → cautions. Always add an icon or the word; never colour only
- No gradients — none, ever
- No shadows — none, ever. No glows, no drop-shadows, no `filter: drop-shadow`
- Depth order: color fill first → 1px border second. Floating elements (modals, dropdowns) use surface fill, border and the overlay
- No decorative fills or elements — every visual element must serve a function

---

## 2. Typography

- Font: **JetBrains Mono always** — one variable file, `fonts/JetBrainsMono-VF.woff2`. No Google Fonts, no fallbacks. Only exception: Arabic script → Noto Sans Arabic (ZKR-Countr).
- Weights: **200 / 400 / 500 / 700 only.** Never 100, 300, 600, 800. `font-synthesis: style`: weights are never faked; the browser may slant the roman for taglines and quotes because no italic file ships.
  - 200 → display only (`5xl`) and only in `text-primary`
  - 400 → body and UI text
  - 500 → app names, labels, nav items
  - 700 → brand name, headings, small labels
- Sizes: **rem only**, from the scale (1rem × 1.125ᵗ, t-shirt names): `xs` 0.7901 · `s` 0.8889 · `m` 1 · `l` 1.125 · `xl` 1.2656 · `2xl` 1.4238 · `3xl` 1.6018 · `4xl` 1.802 · `5xl` 2.0273. No other sizes, no px. Exceptions: 1px borders, 9999px pills.
- `xs` is reserved (no colour pair passes APCA at that size). `s` is for labels/metadata only: weight 700, `text-primary`. Weight 200 only from `5xl`.
- Line height comes from the size token (rem). No unitless or px overrides.
- Tracking (t-shirt names): `m` = 0 default · `l` = 0.05em uppercase `s` labels only · `s` = -0.01em on `3xl` and up only. Nothing else.
- No italics in UI — italics only in taglines and block quotes
- Contrast is **APCA**, not WCAG ratios: body 16px/400 ≥ Lc 90 · 16px/500 ≥ Lc 75 · large (`3xl`+) ≥ Lc 60 · weight 200 ≥ Lc 90 · non-text ≥ Lc 15. Check with `apca-w3`.

---

## 3. Border Radius

- Default: **radius 0** — sharp edges everywhere, no exceptions
- Toggles: radius 0 — square, not pill
- Buttons: shape follows content — rectangle (radius 0) when the button contains text, circle (radius 9999) when it is icon-only. See Button.
- Inputs: radius 0 — always
- Cards, modals, panels: radius 0 — always
- **Radius 9999 is allowed on exactly two things:** badges/tags (pills) and icon-only buttons (circles). Nothing else.

---

## 4. Spacing

- Use tokens only, in **rem** (name = multiple of 0.25rem): `0.5` 0.125 · `1` 0.25 · `2` 0.5 · `3` 0.75 · `4` 1 · `6` 1.5 · `8` 2 · `10` 2.5 · `16` 4. Same scale for padding, margin and gap.
- Control height (buttons, inputs, toggles, nav): `xs` 1.5rem · `s` 2rem · **`m` 2.5rem (default)** · `l` 3rem. Use `min-height`, border-box.
- Tap target: every control has a touch area of at least 2.75rem (44px), whatever its visible height. `xs` (e.g. Reset) keeps its small look but extends the hit area with padding or a pseudo-element.
- px only for: 1px borders, 2px selected border, 4px wordmark border, 9999px pills, pixel-grid icon boxes.
- Viewport: `height: 100vh; height: 100dvh;` for the app shell, `svh` for max-height caps, never `vh` alone on mobile. `dvh` ignores the on-screen keyboard — bottom inputs pin to the visual viewport.
- Default to spacious — go dense only when content demands it
- Prefer whitespace over dividers

---

## 5. Layout

- **Mobile first** — design small screen first, scale up
- One job per screen — if a screen is doing two things, split it
- Keyboard-first — all actions achievable without a mouse

---

## 6. Components

### Button
A button is **style × size × content**. Pick one of each.

- **Style:** `primary` (solid), `secondary` (1px border), `ghost` (no border). One primary per view max. Fill = `accent`, label = `on-accent` (no accent: fill = `text-primary`, label = `bg`). No hover colour change beyond what the role set allows: hover swaps to the `surface` fill on secondary/ghost.
- **Size** = control height: `xs` 1.5rem · `s` 2rem · **`m` 2.5rem (default)** · `l` 3rem. Min tap target 2.75rem, always: extend with padding, the caption, or a centred `::after` at `max(100%, 2.75rem)` (needs `position: relative`). Small controls placed side by side may have overlapping hit areas; keep gaps ≥ 0.5rem.
  - Label type: `xs`/`s` → type `s`, weight 700 · `m` → type `m`, weight 500 · `l` → type `l`, weight 500. Never 600.
  - Horizontal padding: `xs` 0.5rem · `s` 0.75rem · `m` 1rem · `l` 1.5rem. Gap between icon and label: `2` (0.5rem).
  - Icon size: 11px at `xs`/`s`, 22px at `m`/`l` (whole multiples of the 11px pixel grid)
  - In code: `Button` and `IconButton` from `@monoform/ui` (`.monoform/ui/`). Do not write your own button.
- **Shape comes from what is inside the button.** Style does not change it.
  | Inside the button | Shape |
  |---|---|
  | Label | Rectangle, radius 0 |
  | Label + icon (label is the main thing) | Rectangle, radius 0 |
  | Icon only | Circle (radius 9999), 1:1 at the control height |
  | Icon + caption (icon is the main thing) | Circle holding **only the icon**; the caption sits outside, below or beside, linked with `<label for>` so it is part of the tap target |
  - If the button box contains text, it is a rectangle. No exceptions.
- **Icon-only is allowed only for universal icons:** close, check, plus, minus, back/forward arrow, delete, copy, maximize/minimize, arrow-down, and enter (submit) **only when it is the submit button attached to an input**. Every other icon needs a label or a caption. Every icon-only button needs an accessible name (`aria-label`) regardless.
- **Border** 1px. **Disabled:** opacity 0.4, no pointer cursor. **Focus:** `outline: 1px solid` accent, offset 0.125rem (`0.5` spacing × 1). No shadow, no gradient.
- Accessibility: native `<button>`; `aria-label` on icon-only; caption linked with `<label for>`; disabled uses the `disabled` attribute.
- Labels: verb-first → `Create Note` not `Note Creation`. Press and enter animation belong to the motion section.

### Segmented control
Pick exactly one of 2–5 options, all visible, effect immediate. Not for on/off (toggle button), not for navigation, not for more than 5 options (use a select or list).

- **Shape:** rectangle, radius 0. One 1px outer border and 1px dividers between segments, all `text-primary`
- **Content:** text labels only. No icon-only segments (an icon-only control is a circle, which cannot sit inside a rectangle group)
- **Size:** same `xs` / `s` / `m` / `l` control heights, label type and weights as Button. Segments are equal width (the widest label sets it); each segment is at least 2.75rem wide and its hit area is at least 2.75rem tall (extend vertically with an invisible area at `xs` / `s`)
- **Selected:** fill `text-primary`, label `bg`. **Unselected:** transparent, label `text-primary`. Same weight in both states so nothing shifts. Works with no accent
- **None selected** is a valid state (presets whose value was typed instead)
- **Disabled:** opacity 0.4, no pointer cursor
- **Focus:** 1px ring in the label colour, drawn **inside** the segment (offset −0.25rem), so it shows on both selected and unselected segments
- **Motion:** none. The selection snaps; no sliding highlight
- **Build:** native radio inputs sharing one `name`, each inside a `<label>`, in a wrapper with `role="radiogroup"` and an accessible name (a visible label or `aria-label`). One tab stop, arrow keys move and select. Never `aria-pressed` buttons for this
- Switching a whole screen or panel is tabs, not this component
- In code: `Segmented` from `@monoform/ui` (`.monoform/ui/`), controlled (`value`, `onChange`), 2 to 5 options, `aria-label` or `aria-labelledby` required by the types. Do not write your own.

---

### Input
- bg: `color.{mode}.surface`
- border: `1px solid color.{mode}.border`
- focus ring: `1px solid` accent (no accent: `text-primary`)
- font: JetBrains Mono, `m` (1rem)
- height: control `m`
- padding: `0 0.75rem` (3)
- Label position: above the input, static — no floating labels
- Label linked with `for`/`id`; error text linked with `aria-describedby`

### Card / Panel
- bg: `color.{mode}.surface`
- border: `1px solid color.{mode}.border`
- padding: `4` (1rem) or `6` (1.5rem)
- No shadow

### List Item
- padding: `2 4` (0.5rem 1rem)
- hover: bg swaps between `bg` and `surface` (a row on `bg` hovers to `surface`; a row on `surface` hovers to `bg`)
- selected: left border `2px solid` accent (no accent: `text-primary`) only

### Badge
- radius: 9999 (pill). Not interactive; the only non-button element with radius 9999
- default: bg `color.{mode}.surface`, 1px border, text `color.{mode}.text-secondary`, size `s` (0.8889rem), weight 700
- accent: bg `accent`, text `on-accent`
- padding: `0.5 2` (0.125rem 0.5rem)

### Modal
- bg: `color.{mode}.surface`, border: `1px solid color.{mode}.border`, radius: 0
- max-width: 30rem
- Must be closable with Esc; focus moves into the modal and returns to the opener on close
- Use native `<dialog>`; it needs an accessible name (`aria-labelledby` on its title)

### Navigation / Toolbar
- bg: `color.{mode}.bg` (not surface)
- border-bottom: `1px solid color.{mode}.border`
- height: control `m` or `l`
- Max 4 items
- `<nav>` with an accessible name; current item marked `aria-current`

### Icons
- Set: `icons/` (30 icons, 11×11 pixel grid). Source of truth is `icons/icons.json`; use `.monoform/icons/sprite.svg` (`<use href="…#mo-icon-<name>">`) or `.monoform/icons/svg/<name>.svg`. Names and functions are in `agent/icons.json`
- Never draw, import or substitute an icon: no Lucide, Heroicons, emoji or text glyphs (↺ ↥ ✕) as icons. Need one that is missing → ask for it to be added to the set
- Grid: 11×11, `fill: currentColor`, `shape-rendering: crispEdges`, no stroke, no `preserveAspectRatio="none"`. Default render is 2px per cell (22px = 1.375rem). Only whole-pixel cells: 1, 2 or 3px per cell (11, 22, 33px). Never fractional scale
- Colour is the text role of the context (`text-primary`, `text-secondary`, `text-disabled`; `on-accent` on accent fills). Icons never take their own colour
- An icon never stands alone: icon-only buttons need `aria-label`; the SVG is `aria-hidden`. Hit area stays 2.75rem regardless of icon size
- Logos and brand marks are not icons: they sit outside the grid and keep their own file
- In code: `Icon` from `@monoform/ui` (`<Icon name="plus" size={22} />`, sizes 11, 22, 33). It draws the path from `.monoform/ui/icons.ts`, so there is no file to serve and nothing to copy
- Meaning is fixed: one function → one icon (`plus` adds, `x` closes, `trash` deletes, `check` confirms). Do not reuse an icon for another function

---

## 6a. Accessibility

Part of the spec, not an extra. Use the native element first (`<button>`, `<dialog>`, `<label>`, `<input>`), which already carries most roles and keyboard behaviour. ARIA only fills gaps.

- **Every interactive control has an accessible name.** Icon-only buttons need `aria-label`; icon + caption buttons link the caption with `<label for>`.
- **Keyboard:** everything reachable and operable by keyboard, in visual order. Esc closes modals and returns focus to the control that opened them.
- **Focus is always visible:** 1px accent ring, 0.125rem offset. Never `outline: none` without a replacement.
- **Touch:** minimum hit area 2.75rem, whatever the visible size.
- **Contrast:** APCA targets in Typography, checked per size and weight.
- **Colour is never the only signal** (selected, error, disabled also change shape, weight, border or text).
- **Motion:** `prefers-reduced-motion` turns every animation off; the marquee slows to 3× duration instead. Moving content that runs over five seconds can be paused (hover, focus, tap)
- **Language and direction:** Arabic-script text carries `lang="ar"` and `dir="rtl"`; set on the element, not the page.
- **Forms:** every input has a visible label above it, linked with `for`/`id`; errors are text, linked with `aria-describedby`.
- **Components that announce changes** (counters, live results) use `aria-live="polite"`, never `assertive` unless it is an error.

---

## 6b. Motion

Stepped motion: every animation is a sequence of hard jumps, never a curve. Two families.

**Stepped In** — how things appear. The decorative background layer grows through four stages (width 2 / 28 / 55 / 82 / 100%, height 6 / 25 / 50 / 78 / 100%), each one a hard jump (`steps(1, end)` between keyframes). Text and hit areas stay at their final size. Then the text appears in one step (at 200ms, 40ms long), then each action pops in (scale 0.5 → 1, 40ms, `steps(2, end)`, first at 220ms, second at 280ms). These sequence times are absolute and the same everywhere: they do not scale with the duration. A 1px outline at 50% shows while growing.

Stepped In and Out take two variables:
- **Direction** — where it grows from: `center`, `top`, `bottom`, `left` or `right` (sets `transform-origin` to 50% 50%, 50% 0, 50% 100%, 0 50%, 100% 50%). The command bar is `bottom`. Stepped Out shrinks back to the same point
- **Speed** — chosen by the object's size, never by hand: `l` 220ms or `s` 130ms (below)

**Stepped Out** — Stepped In played backwards over the same duration. Text and actions hide at once, then the layer shrinks and the last frame is hidden (`opacity: 0; visibility: hidden`), so no stub is left on screen. Use it for **permanent or large** things: the command bar, Focus mode, side panels.

**Terminal Pop** — how things are dismissed or deleted. Swell in two steps (40ms), hold one bigger frame (65ms), then gone: 105ms total. Use it for **small and transient** things: modal, note, message bar, toast, cell. The growth is `min(0.18, 0.5rem ÷ longest side)`: a cell swells to 1.18, a 15rem modal grows about 0.5rem in total. Clearing many items cascades them over a random 0–120ms.

- **Speed follows size:** `l` = 220ms for surfaces spanning the full width or height of the screen (command bar, Focus mode, bead ring); `s` = 130ms for everything else (cells, buttons, dialogs, panels, bars, rows)
- **In code:** `Stepped` and `SteppedAction` from `@monoform/ui` (props: `open`, `speed`, `direction`, `exit` = `out` or `pop`). Use them instead of writing keyframes
- **Entrances play, exits depend on the thing:** permanent or large → Stepped Out, small or transient → Terminal Pop
- **Beads (ZKR-Countr):** 9° per count, stepped over `l` with `steps(3, end)`. No smooth rotation
- **No easing keywords.** `ease`, `ease-in`, `ease-out`, `ease-in-out` are banned. Hover, press and colour changes have no transition
- **Animate only** `transform`, `clip-path`, `opacity`, `visibility`. Never width, height, margin, padding or position. Layout and hit targets are always at final size
- **A press or keystroke finishes an entrance at once**
- **Marquee:** the one continuous animation and the only place `linear` is allowed: `linear infinite alternate`, duration `max(6s, distance ÷ 25 + 4s)`. It pauses on hover, keyboard focus and tap (tap toggles)
- **Reduced motion:** everything off, straight to the resting state. The marquee slows to 3× its duration and is never turned off

---

## 7. Copy

- Direct — no preamble, say what it does
- Plain — no jargon, simple but not simplistic
- Every word must earn its place
- Placeholders: action-oriented → `Type and press Enter` not `What's on your mind?`
- Error messages: calm, not cold → `Invalid input. Use numbers only.` not `Error: Invalid input.`
- Empty states: explain the action, trigger next step → `Press N to create your first note.`
- Tone modes:
  - Neutral → CMD-Note, DTS-Calc, core system UI
  - Warm → empty states, onboarding, ZKR-Countr
  - Expressive → delight moments only, non-critical surfaces — still sharp, no emoji fluff

---

## 8. App Naming

- Format: `/ALLCAPS-TitleCase` — e.g. `/CMD-Note`, `/DTS-Calc`, `/ZKR-Countr`
- Always include leading `/` in prose and UI
- Never: `cmd-note`, `CMDNote`, `CMD note`
- Descriptions: one clause, no period

---

## 9. Architecture (code output)

- Dependency direction: `UI → application → infrastructure`; domain imports nothing
- One hook = one concern — no God hooks
- Domain logic is pure — no I/O, no framework imports
- UI imports hooks only, never infrastructure directly
- Use named constants — no magic numbers in code
- `lib/services` is the composition root

---

## 10. Validation Checklist

Before outputting any UI, verify:
- [ ] JetBrains Mono font throughout
- [ ] Correct bg/surface tokens for the mode
- [ ] accent used sparingly; every colour is a role, never a hex
- [ ] error token used only for destructive / validation / critical
- [ ] radius 0 everywhere; 9999 only for badges and icon-only buttons
- [ ] no gradients, no shadows or glows, no decorative elements
- [ ] mobile-first layout
- [ ] accessible names, keyboard focus order, visible focus, 2.75rem tap targets (section 6a)
- [ ] motion: stepped only, no easing keywords, Stepped In/Out or Terminal Pop, reduced motion handled (section 6b)
- [ ] icons come from the Monoform set at whole-pixel scale; no outside icons or text glyphs (section 6, Icons)
- [ ] one job per screen
- [ ] `node tools/check scan <app>` reports nothing over baseline (docs/checker.md)
- [ ] copy is direct, plain, verb-first
- [ ] app name uses `/CMD-Style` format if referenced
