# DTS-Calc

**Distance–Time–Speed calculator for runners.** Features two distinct modes: a **Single** pace calculator (enter any two of time, distance, or speed/pace to compute the third) and a **Multi** pace workout planner (upload a GPX route, divide it into segments, and plan varying paces across elevation profiles). Metric and imperial units. Offline-first, static HTML with modular ES modules. Mobile-first layout with responsive design.

## Features

- **Two calculation modes**: Single pace (classic calculator) and Multi pace (GPX route planner)
- **Single Mode**:
  - Four linked fields: Time (HH:MM:SS), Distance (KM/MI), Speed (KM/H or MPH), Pace (MIN/KM or MIN/MI)
  - Target selector: TIME, DISTANCE, or SPEED — the selected target is computed from the others
- **Multi Mode**:
  - GPX Upload: Parse `.gpx` routes (5km to 45km) into 100m pace blocks
  - Elevation Chart: Visualise the route's elevation profile
  - Pace Zones: Select segments of the route and assign distinct paces to plan your final finishing time
  - Zone Controls: `+ Add Zone` and `Delete` actions to manage pace zones
- Unit toggle: METRIC (km, km/h, min/km) or IMPERIAL (mi, mph, min/mi)
- Smart input: digits auto-format to time (e.g. `123456` → `01:23:45`) or pace (e.g. `530` → `05:30`)
- Offline-first with localStorage persistence
- Reset: click clears values; long-press (≥500ms) factory resets
- Mobile-first frame (393×852), responsive on desktop
- Document scroll is locked. The header stays in the app column, and only an inner container scrolls, so iOS does not frost the header under the status bar
- Accessible: ARIA labels, focus-visible, high-contrast support

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | Static HTML, vanilla JS ES modules |
| Styling | CSS custom properties, JetBrains Mono font |
| Persistence | localStorage |
| Hosting | Vercel (static) |

## Architecture Overview

```mermaid
flowchart TB
    subgraph UI [UI Layer]
        Mode[Mode Toggle]
        subgraph SingleUI [Single Mode]
            Fields[Fields: Time/Dist/Speed/Pace]
            Circles[Target Circles]
        end
        subgraph MultiUI [Multi Mode]
            Upload[GPX Upload]
            Chart[Elevation Chart]
            Zones[Pace Zones]
        end
        Toggles[Unit Toggle]
        Reset[Reset Buttons]
    end

    subgraph Logic [JS Modules]
        Calculator[calculator.js]
        Normalize[normalize.js]
        Convert[convert.js]
        GPX[gpx.js]
        Multi[multi-pace.js]
    end

    subgraph Storage [Local Storage]
        LS[(localStorage)]
    end

    Mode --> Calculator
    SingleUI --> Calculator
    MultiUI --> Multi
    Upload --> GPX
    GPX --> Multi
    Calculator --> Normalize
    Calculator --> Convert
    Multi --> Convert
    Multi --> Normalize
    Calculator --> LS
    Multi --> LS
```

## Directory Structure

```
DTS-Calc/
├── index.html       # App entrypoint
├── css/
│   └── styles.css   # Extracted app styles
├── js/
│   ├── calculator.js
│   ├── viewport-lock.js       # Keeps the fixed app above the keyboard
│   ├── normalize.js
│   ├── convert.js
│   ├── gpx.js
│   └── multi-pace.js
├── assets/
│   ├── icon.svg               # Source 8×8 artwork (transparent, black pixels)
│   ├── favicon.svg            # Same cells on a white tile
│   ├── apple-touch-icon.png   # 180×180
│   ├── icon-192.png           # 192×192
│   ├── icon-512.png           # 512×512
│   └── icon-maskable-512.png  # 512×512, maskable safe zone
├── manifest.json    # App name and icon set
├── vercel.json      # Vercel rewrites (root → index.html)
└── README.md
```

`assets/icon.svg` is the source artwork. The favicon, apple-touch icon, and manifest PNGs are generated from those same cells.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Main calculator (rewrites to `index.html`) |

## Data Flow and Compute Model

- **Modes**: Toggling Single/Multi switches the UI shell and initializes the respective persistence logic.
- **Single Mode**:
  - **Input**: User edits a non-target field → debounced `compute()` (200ms)
  - **Blur**: Normalize value (time/pace auto-format from digits), then `compute()`
  - **Target**: TIME, DISTANCE, or SPEED — target field is read-only; others drive it
  - **Speed vs Pace**: When both time and distance exist, speed and pace stay in sync; `lastEdited` (PACE or SPEED) decides which drives the other
- **Multi Mode**:
  - **GPX Data**: GPX strings parsed and downsampled to 100m chunks. Elevation mapped onto segments.
  - **Planner**: Users define distinct paces for groups of segments ("Zones"), and a total run time is computed by accumulating segment durations.
- **Persistence**: `saveState()` / `loadState()` applied on init, compute, clear, and reset events for both modes separately.

## Viewport and scrolling

iOS 26 draws a frosted scroll-edge over the header of an installed home-screen app when `html` / `body` can scroll. That was happening here because `.ctds-multi-shell` was `100dvh` *under* the header (about 82px past the viewport) and the chart height subtracted a hardcoded `--mp-header-h` of 48px.

`html` and `body` now fill the viewport with `overflow: hidden` and `overscroll-behavior: none` (no rubber-band). The header stays a flex row at the top of `.ctds-app`, padded by the existing safe-area inset. `.ctds-scroll` is the only scroller (`overflow-y: auto`, `overscroll-behavior: contain`). Multi mode fills the space under the header when it fits. On a short or landscape screen the elevation panel keeps a minimum height and `.ctds-scroll` moves so the totals, chart, and footer stay reachable. `viewport-fit=cover` lets the existing safe-area padding clear the status bar. `theme-color` is the solid app red and there is no status-bar meta — neither one is the frost.

When the keyboard opens, `viewport-lock.js` sizes the app to the visible viewport so inputs and the pace sheet stay reachable. The document does not scroll.

## Key Concepts

- **Target field**: The computed value. TIME = from distance + speed/pace; DISTANCE = from time + speed/pace; SPEED = locks both speed and pace (derived from time + distance)
- **Unit conversion**: 1 mi = 1.609344 km; applied on toggle between METRIC and IMPERIAL
- **Digits-to-time**: Raw digits (e.g. `123456`) → `01:23:45` on blur
- **Digits-to-pace**: Raw digits (e.g. `530`) → `05:30` on blur

## Getting Started

**Prerequisites:** None (static HTML; open in browser or serve locally)

```bash
# Option 1: Open directly
open index.html

# Option 2: Local server (e.g. Python)
python3 -m http.server 8000
# Visit http://localhost:8000/index.html
```

**Deploy to Vercel:**

```bash
vercel
```

`vercel.json` rewrites `/` to `/index.html`.
