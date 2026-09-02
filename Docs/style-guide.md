# Graphic style guide

This document is the visual source of truth for the yc2925 app. Implement UI against these rules. Do not invent a second accent, a second type family for chrome, or decorative surfaces.

References (attitude, not copies):

- [sub.global](https://sub.global/) — black field, catalog typography, non-hierarchical overlay, almost no chrome
- TouchDesigner — parameter strips, hairline panels, numeric readouts, operator-selected highlight

The product should feel like an **instrument over a viewport**, not a marketing site and not a rounded “glass” dashboard.

---

## Principle

The canvas is the image. The UI is a thin technical overlay.

1. Dark, near-black surfaces. No gradients on chrome.
2. **One highlight color.** Everything else is grayscale.
3. Straight edges, 1px rules, no drop shadows, no blur-glass, no large corner radii.
4. Small type, tight tracking on labels, tabular numbers.
5. Dense information, sparse decoration. If a control does not show a value, it is unfinished.

Particle color on the 3D object is **content**, controlled by the user. It is not a second brand color and must not leak into buttons, borders, or type.

---

## Color

Use CSS variables. Do not hardcode one-off hex in components unless mapping a live parameter.

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#070707` | Page / canvas clear color |
| `--bg-panel` | `#0C0C0C` | Overlay panels, 92–96% opaque (no blur) |
| `--line` | `#2A2A2A` | Hairline borders, ticks, grid |
| `--line-strong` | `#3F3F3F` | Hover / active panel edge |
| `--text` | `#E8E8E8` | Titles, control labels |
| `--text-dim` | `#8A8A8A` | Hints, inactive labels |
| `--text-mute` | `#5C5C5C` | Metadata, units, disabled |
| `--signal` | `#FF3B00` | **Only highlight** |

### Signal (the one highlight)

`--signal: #FF3B00`

Use it only for:

- Slider fill / thumb
- Focus ring
- Active / armed / selected state
- Live numeric value when it is the “current” parameter
- A 1px tick or underline that marks the active section

Do not use it for:

- Body text
- Large fills or backgrounds
- Icons by default
- The 3D particle material (that stays on the Color slider)

Hover on a non-selected control: lighten the border to `--line-strong`, do not paint it signal. Signal means *this is live*.

No second accent (no cyan, purple, or blue in chrome). Error may use the same signal at full intensity plus the word `ERR` — still one hue.

---

## Typography

Technical grotesque for UI. Prefer a single family with a real tabular-nums cut.

**Primary:** `IBM Plex Sans` (fallback: `system-ui`, `Helvetica Neue`, `Arial`)  
**Numeric / code / readouts:** `IBM Plex Mono` (fallback: `ui-monospace`, `Menlo`, `Consolas`)

Do not use display serifs, rounded geometric sans, or variable “marketing” weights.

| Role | Size | Weight | Tracking | Case |
| --- | --- | --- | --- | --- |
| App kicker (`yc2925`) | 10–11px | 400 | `0.18em` | Uppercase |
| Viewport title | 13–15px | 400 | `0.04em` | Sentence, not hero |
| Panel title | 11px | 400 | `0.16em` | Uppercase |
| Control label | 11px | 400 | `0.06em` | Uppercase |
| Hint / help | 11px | 400 | `0` | Sentence |
| Value readout | 11px | 400 | `0` | Tabular, mono |
| Unit | 10px | 400 | `0.08em` | Uppercase, dim |

Line height for chrome: `1.2–1.35`. No 56px marketing headings. The title is a caption over the viewport, closer to SUB’s index line than to a landing-page H1.

---

## Layout

### Viewport

- Canvas is full window. Background `--bg`.
- Scene grid, if any, uses `--line` at low opacity. No colored gizmos unless selected (then `--signal`).

### Overlay

- Header: top-left, padding 16px. Kicker then title. `pointer-events: none`.
- Panel: right edge, full height minus 16px inset. Width **240–260px**. Align to the pixel grid.
- Inset from viewport: **16px** everywhere. Not 20/24 mixed.
- Overlay does not center-stage itself. It is a column of parameters, like a TD parameter window.

### Structure of a panel

```
┌─────────────────────────┐
│ PARTICLES               │  uppercase title + 1px rule under
│ orbit drag · edit params│  one dim hint line, then stop
│─────────────────────────│
│ SPACING          0.28   │
│ ████████░░░░░░░░░░░░░   │
│ COLOR            214°   │
│ SHAPE             20%   │
└─────────────────────────┘
```

No section illustrations. No icons unless they are 10px hairline glyphs.

---

## Shape and surface

| Property | Rule |
| --- | --- |
| Corner radius | **0px** on panels, inputs, sliders. Square system. |
| Border | **1px solid `var(--line)`** |
| Shadow | **none** |
| Backdrop blur | **none** |
| Panel fill | solid `--bg-panel` at ~0.94 alpha |
| Dividers | 1px `--line`, full panel width |

The current rounded, frosted panel is out of spec. Rebuild it as a hard rectangle.

---

## Controls

TouchDesigner parameter row: label left, value right, thin track below.

### Slider

- Track height **2px**, color `--line`
- Fill from left to thumb: `--signal`
- Thumb: **8×8px square**, `--signal`, no circle
- Label uppercase 11px `--text`
- Value right-aligned, `IBM Plex Mono`, tabular
- Color slider: the **track** may show the hue spectrum (content). The **thumb** stays `--signal` so chrome still has one highlight. Show a 8×8 square swatch next to the degree value, not a round pip.

### Focus

`outline: 1px solid var(--signal); outline-offset: 2px;`  
No 2px glow.

### Buttons (when added)

- Rectangular, 1px `--line`, transparent fill
- Hover: `--line-strong`
- Active / pressed: `--signal` border, `--text` label
- Height 24–28px, padding 0 10px, 11px uppercase label

### Inputs

- Same height as buttons
- No inner shadow
- Caret and selection use `--signal`

---

## Motion

- Duration **80–120ms**, easing `linear` or `steps` — not bounce, not long fades.
- Slider values update immediately; no staged animation of the 3D field except the simulation itself.
- Orbit damping may stay on the camera; UI chrome does not ease in.

---

## 3D / viewport graphic rules

- Clear color matches `--bg`.
- Additive particles are allowed; they are the picture, not the UI.
- Default particle hue may start near a cool gray-white (`hsl(0 0% 85%)`) so the **signal red** stays unique to chrome. User Color slider can go anywhere.
- Avoid a second colored light rig (no blue key / orange fill). Neutral lighting if meshes return.
- Grid: grayscale only.

---

## Copy tone

Match the interface: short, operational, unlabeled poetry.

- Prefer `SPACING` over `Distance between particles`
- Prefer `SHAPE` over `Randomizing the outer shape`
- Hints: one line, lowercase or sentence case, no exclamation

---

## Do / don’t

**Do**

- Treat the UI as a legend on an image
- Keep one red-orange live color
- Use hairlines and mono values
- Sit type on the pixel grid (integer px sizes)

**Don’t**

- Rounded cards, pills, or circular slider thumbs
- Frosted glass, gradients on panels, drop shadows
- A second brand color (purple/cyan/blue) in chrome
- Large hero titles, logos, or icon grids
- Light theme

---

## Implementation notes

When restyling the current app, change at least:

1. Tokens in `:root` (`index.css`)
2. Header scale (caption, not 28px bold)
3. Side panel: 0 radius, no blur, 1px `--line`, 16px inset, 240–260px
4. Sliders: 2px track, square signal thumb
5. Fonts: Plex Sans + Plex Mono

Ship tokens first, then components. If a new control has no token, add the token here before adding a hex in CSS.
