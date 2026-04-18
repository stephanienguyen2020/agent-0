# Agent Zero — Design System

> Editorial task-feed directory. Warm paper + deep-ink palette, serif display type, monospaced metadata, long horizontal rules. Modern micro-interactions over a calm, library-catalog layout.

---

## 1. Design philosophy

| Principle                                | What it means here                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editorial, not dashboard**             | Long, scannable rows with a big date column on the left and a big bounty on the right — like a paper directory, not a SaaS table.                             |
| **Mono for metadata, serif for meaning** | Every piece of system data (chain, block, timestamp, id, hash) is JetBrains Mono. Every headline or money figure is Instrument Serif. Inter carries the body. |
| **Warm paper / deep ink**                | Light mode is a cream-paper off-white; dark mode is a near-black with a green tint, never pure black. Accent color comes through only in live/active moments. |
| **Motion as affirmation**                | Animations never decorate — they confirm a state change (hover, accept, theme-swap, new listing). All motion uses one of two easings.                         |
| **One column of hierarchy per row**      | Date · content · bounty · CTA. Always four. Never more.                                                                                                       |

---

## 2. Color tokens

All colors live as CSS variables under `:root` (light) and `html[data-theme="dark"]` (dark). **Always use the token, never the hex.**

### 2.1 Light mode — `:root`

| Token        | Value                  | Role                                                 |
| ------------ | ---------------------- | ---------------------------------------------------- |
| `--bg`       | `#f6f5f1`              | Page background. Warm cream.                         |
| `--bg-2`     | `#efede6`              | Row hover, banded sections (ticker, "How it works"). |
| `--ink`      | `#111110`              | Primary text, primary button fills, rules.           |
| `--ink-2`    | `#2a2a27`              | Secondary text (blurbs, descriptions).               |
| `--mute`     | `#6c6a62`              | Tertiary text (timestamps, labels, captions).        |
| `--line`     | `#dcd8ce`              | Primary 1px borders and dividers.                    |
| `--line-2`   | `#e7e3d9`              | Secondary borders (row dividers, dashed rules).      |
| `--card`     | `#fffdf7`              | Card surfaces — slightly lighter than page.          |
| `--accent`   | `oklch(0.62 0.17 145)` | Green. Live/paid/success. Accent bar on hover.       |
| `--accent-2` | `oklch(0.62 0.17 55)`  | Amber. New listings, secondary signal.               |
| `--danger`   | `oklch(0.58 0.18 25)`  | Urgent deadlines, dispute.                           |

### 2.2 Dark mode — `html[data-theme="dark"]`

| Token        | Value                  | Role                                        |
| ------------ | ---------------------- | ------------------------------------------- |
| `--bg`       | `#0d0e0c`              | Page background. Warm near-black.           |
| `--bg-2`     | `#141513`              | Row hover, banded sections.                 |
| `--ink`      | `#f3f1e9`              | Primary text, primary button fills, rules.  |
| `--ink-2`    | `#d6d3c8`              | Secondary text.                             |
| `--mute`     | `#8b887c`              | Tertiary text.                              |
| `--line`     | `#27282a`              | Primary borders.                            |
| `--line-2`   | `#1c1d1e`              | Secondary borders.                          |
| `--card`     | `#17181a`              | Card surfaces — slightly lighter than page. |
| `--accent`   | `oklch(0.72 0.18 145)` | Same hue, brighter L for dark bg.           |
| `--accent-2` | `oklch(0.78 0.16 75)`  | Brighter amber.                             |
| `--danger`   | `oklch(0.70 0.19 25)`  | Brighter red.                               |

### 2.3 Accent swatches (Tweaks-swappable)

Accent hue rotates via OKLCH. Keep L and C fixed; only shift H:

```
green  → H 145
amber  → H 55
blue   → H 240
violet → H 300
```

Apply with `document.documentElement.style.setProperty('--accent', 'oklch(0.62 0.17 <H>)')` in light, `oklch(0.72 0.18 <H>)` in dark.

### 2.4 Chain colors

Chains use their brand hex directly, NOT tokens — they must stay recognizable in both themes. Always rendered as a 6–10px dot next to the chain name, never as fill behind text.

```
base #0052ff · ethereum #627eea · polygon #8247e5 · arbitrum #2d374b
optimism #ff0420 · celo #35d07f · avalanche #e84142 · monad #6f4ff2 · skale #000000
```

### 2.5 Shadow & overlay

```
--shadow-soft (light): 0 1px 0 rgba(0,0,0,.03), 0 10px 30px -12px rgba(0,0,0,.08)
--shadow-soft (dark):  0 1px 0 rgba(255,255,255,.02), 0 20px 40px -18px rgba(0,0,0,.6)

drawer backdrop (light): blur(6px) + rgba(17,17,16,.35)
drawer backdrop (dark):  blur(6px) + rgba(0,0,0,.55)
```

### 2.6 Selection

```css
::selection {
  background: var(--ink);
  color: var(--bg);
}
```

---

## 3. Typography

### 3.1 Families

```
Serif:   Instrument Serif (400 + italic 400) — display, money, dates, section titles
Sans:    Inter (400/500/600/700) — UI, body copy, buttons
Mono:    JetBrains Mono (400/500/600) — metadata, hashes, timestamps, system data
```

Load all three from Google Fonts with `preconnect` hints.

### 3.2 Scale

| Token          | Family | Size                    | Weight  | Leading | Tracking          | Use                              |
| -------------- | ------ | ----------------------- | ------- | ------- | ----------------- | -------------------------------- |
| **Display XL** | Serif  | clamp(60px, 9vw, 140px) | 400     | 0.92    | -0.03em           | Footer showstopper line          |
| **Display L**  | Serif  | clamp(48px, 6vw, 84px)  | 400     | 1.02    | -0.02em           | Hero H1                          |
| **Display M**  | Serif  | 54px                    | 400     | 1.05    | -0.02em           | Dark-section H2 ("18 new tools") |
| **Display S**  | Serif  | 40px                    | 400     | 1.05    | -0.02em           | Band headings                    |
| **Serif-36**   | Serif  | 36px                    | 400     | 1.00    | -0.02em           | Row date column, stat values     |
| **Serif-32**   | Serif  | 32–34px                 | 400     | 1.00    | -0.01em           | Section opener ("Open tasks")    |
| **Serif-22**   | Serif  | 22px                    | 400     | 1.20    | -0.01em           | Deadline group label             |
| **Body L**     | Inter  | 16px                    | 400     | 1.55    | 0                 | Hero paragraph                   |
| **Body**       | Inter  | 14px                    | 400     | 1.50    | 0                 | Default body                     |
| **Body S**     | Inter  | 13px / 13.5px           | 400     | 1.50    | 0                 | Row blurb, nav                   |
| **UI S**       | Inter  | 12px                    | 400/500 | 1.35    | 0                 | Buttons, pills                   |
| **Mono-12**    | Mono   | 12px                    | 400     | 1.45    | 0                 | Live ticker, row meta            |
| **Mono-11**    | Mono   | 11px                    | 400/500 | 1.40    | 0                 | Pill labels, chip copy           |
| **Mono-10**    | Mono   | 10–10.5px               | 400/500 | 1.40    | **.14em** + UPPER | Eyebrow / section labels         |

Feature settings on body: `font-feature-settings: 'ss01','cv11'`.

### 3.3 Rules

- **Italics for contrast inside serif display** — e.g. `Agents have hands / *when you lend them yours.*` The italic half becomes `color: var(--mute)`.
- **Eyebrow pattern**: 10.5px Mono · `.14em` tracking · UPPERCASE · `color: var(--mute)` · 10px bottom margin.
- **Never mix weights within serif** — it's 400 only, variation comes from italic.
- Money values: always serif, always flush-right inside their column.

---

## 4. Spacing, layout, radii

### 4.1 Grid

- Max container: **1360px**, horizontal padding **32px**.
- Main page grid below the hero: **`280px · 1fr`** with 40px gutter. Sidebar sticky at `top: 72px`.
- Section vertical rhythm: **56px** top padding for marketing bands, **28px** for in-page sections.

### 4.2 Spacing scale

4 · 6 · 8 · 10 · 12 · 14 · 18 · 22 · 28 · 32 · 40 · 48 · 56. Stick to these; no arbitrary gaps.

### 4.3 Radii

```
pill       999px    chips, buttons, tags
card       10–12px  filter card, drawer blocks, info cards
callout    16px     publish-sheet modal
no radius  0px      row dividers, section rules
```

### 4.4 Borders

- `1px solid var(--line)` is the default divider.
- `1px solid var(--ink)` used ONLY for deadline-group top border (paper-catalog rule).
- `1px dashed var(--line)` for in-card subdividers.
- Never use box-shadow as primary separator in light mode — borders first.

---

## 5. Iconography

- **Glyph set**: UI uses typographic glyphs, not icon fonts: `◉ ▤ ✱ → ◐ ✓ ▦ ✦` for the 8 task categories.
- **Svg stroke**: 1.5–1.6px, `strokeLinecap="square"` to match the editorial tone. No filled icons.
- **No emoji** except 📍 for the city pill (it's intentional — reads as a dropped pin in editorial type).
- **Logo**: 24×24 rounded-corner square + checkmark stroke, 1.5–1.6px strokes.

---

## 6. Components

### 6.1 Buttons

```
.btn (shared) {
  transition: transform .15s var(--ease-spring), background .2s, color .2s;
}
.btn:hover  { transform: translateY(-1px); }
.btn:active { transform: translateY(0) scale(.98); }
```

**Primary** — `1px solid var(--ink)` · `background: var(--ink)` · `color: var(--bg)` · pill · 8×16 or 12×22 for XL.

**Ghost** — `1px solid var(--line)` · transparent fill · `color: var(--ink)` (body) · pill · same paddings.

**Inverse primary** (on `--ink` sections) — `background: var(--bg)` · `color: var(--ink)` · `border: 1px solid var(--bg)`.

**Shine** — add `.shine` class on the hero CTA only; sweeps a soft accent-tinted gradient across every 3.2s.

### 6.2 Pills / chips

```
display: inline-flex; gap:5px; padding:3px 9px;
border:1px solid var(--line); border-radius:999px;
font: 11.5px / 1.4 'JetBrains Mono';
background: var(--card) (default) or transparent (muted);
color: var(--ink-2) or var(--mute);
```

Selected state (filter categories): swap to `background: var(--ink); color: var(--bg)`. Small count number sits at opacity .6.

### 6.3 Task row

Four-column grid `82px · 1fr · 180px · 140px`, 24px gutter, 22px vertical padding, bottom border `1px solid var(--line-2)`.

- **Date column**: serif-36 number + 18px muted unit glyph (`m` / `h` / `d` / `tom.`), below it a 10px uppercase mono label in `--mute`. Urgent rows also show a red pulsing dot + "time-critical".
- **Main column**: row of pills → 19px medium title → 13.5px blurb → 12px mono meta line (posted by · ago · evidence).
- **Bounty column**: right-aligned, Mono-10 eyebrow "BOUNTY", serif-40 "$NN", Mono-11 stable · "gasless", then 4 "bounty dots" (filled up to threshold 30/80/150/250).
- **CTA column**: full-width primary "Accept →", ghost "Watch · save" below, Mono-10 "escrow locked" caption.

Interactions:

- Row lifts **4px right** on hover, 0.35s spring ease.
- 2px accent bar slides down from top of row (`scaleY 0→1`, spring).
- Arrow inside "Accept →" nudges +4px with the hover.
- Background goes `var(--bg-2)`.

### 6.4 Filter rail

Sticky sidebar. Each section = eyebrow label + controls. Order: Search → Mini Calendar → Category (vertical list w/ counts) → Chain (wrap pills) → Bounty (radios) → Evidence (checkboxes) → "Clear all filters" link in `--mute` underline.

### 6.5 Mini calendar

14px padded card, 10px radius, `--card` background, `--line` border.

- Header: "Month **Year**" in serif-20 (year in `--mute`) · right: Mono-10 "wk NN" in `--mute`.
- 7-col grid, 11px Mono, 2px gap. Weekday initials in `--mute`.
- Days with tasks get a 3px accent dot below the number.
- Today is bold, selected day is `background: var(--ink); color: var(--bg)` rounded-4px.

### 6.6 Stats row (hero right column)

Each stat:

- Top row: Mono-10 eyebrow label (flex-1) + serif-36 value (right).
- Sub-line: 12px `--mute` (e.g. "paid out this month").
- Divider: 1px solid `--line-2` bottom border, 12px pb.

### 6.7 Ticker

Full-width band, `var(--bg-2)` background, 1px bottom border. Inner track animates `translateX(0 → -50%)` over 60s linear, looped by rendering the row twice side by side.

Each item: 5px dot (`--accent` / `--accent-2` / `--mute` by kind) · 12px mono timestamp in `--mute` · 12px text in `--ink-2`.

### 6.8 Drawer

Position fixed, right side, `min(640px, 94vw)`. Slides in from right with spring (0.5s). Backdrop fades + blurs (6px) simultaneously.

Inside: sticky header (id + close button), pills row, Serif-34 title, 15px blurb, bounty/deadline info card, evidence checklist (numbered circles), 4-step flow bar (cells fill black as they complete), primary + ghost action pair, 11px mono disclosure text.

### 6.9 Publish sheet

Centered modal, 580px cap, 16px radius, 28px padding. Same `anim-up` spring, dimmed backdrop. Serif-30 prompt, textarea + two short inputs, primary + ghost action.

### 6.10 Integration block (dark inversion)

`background: var(--ink)`, white text. Used regardless of theme to create a brand punctuation moment. Code block: `rgba(255,255,255,.04)` background, `rgba(255,255,255,.18)` border. Syntax colors: keys in accent-2 (`oklch(0.82 0.14 55)`), success in accent (`oklch(0.82 0.14 145)`).

### 6.11 Top nav

Sticky, `backdrop-filter: saturate(1.1) blur(6px)`. 14/32 padding, 28px gap. Logo → nav links (14px, `--ink-2`, active `--ink`) → spacer → live block counter (Mono-12) → theme toggle → "Connect wallet" ghost → "Publish task →" primary.

---

## 7. Motion

### 7.1 Easings (reuse everywhere)

```
--ease-spring: cubic-bezier(.2, .9, .2, 1);   /* hover lifts, drawer slide, reveal */
--ease-smooth: cubic-bezier(.22, .61, .36, 1); /* theme transition, color fades, sweeps */
```

### 7.2 Global transition

Every element auto-transitions color/background/border: `transition: background-color .35s var(--ease-smooth), border-color .35s var(--ease-smooth), color .35s var(--ease-smooth)`. This makes the theme toggle feel like a single synchronized breath.

### 7.3 Animation catalogue

| Name                            | Duration / easing         | Where                     | What                                                                                       |
| ------------------------------- | ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `pulse-dot`                     | 1.6s infinite ease-in-out | Live dots                 | Scale .85↔1, opacity .35↔1                                                                 |
| `ticker`                        | 60s infinite linear       | News ticker track         | translateX 0 → -50%                                                                        |
| `fade-slide` (`.reveal`)        | .7s spring                | Hero text                 | Opacity 0→1, translateY 14→0. Stagger via `.reveal-d1…d4` (60 / 140 / 220 / 300ms delays). |
| `slide-up` (`.anim-up`)         | .4s spring                | Modal, panel              | Opacity 0→1, translateY 8→0                                                                |
| `drawer-in`                     | .5s spring                | Side drawer               | translateX 100%→0                                                                          |
| `backdrop-in`                   | .4s smooth                | Drawer backdrop           | Blur 0→6px, bg 0→.35 alpha (dark: 0→.55)                                                   |
| `digit-pop`                     | .55s spring               | Block counter             | translateY 10→0 + scale .96→1.02→1                                                         |
| `ring-pulse`                    | 2s infinite smooth        | Active status pill        | Expanding translucent halo 0→14px                                                          |
| `shine-sweep` (`.shine::after`) | 3.2s infinite smooth      | Hero CTA                  | 110° gradient slides -100%→100%                                                            |
| `tick-bounce`                   | .35s spring               | Checkmarks/ticks          | scale .6→1.15→1, opacity 0→1                                                               |
| `marching-ants` (`.ants`)       | 1.2s linear infinite      | Optional: dispute borders | Dashed border marches                                                                      |
| Row hover                       | .35s spring               | Task row                  | translateX 0→4px, accent bar scaleY 0→1, arrow nudges                                      |
| Theme toggle icon               | .6s spring                | Nav orb                   | Sun rays fade, moon clip-path slides                                                       |

### 7.4 Prefer-reduced-motion

Gate decorative motion:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal,
  .anim-up,
  .drawer-in,
  .ring-pulse,
  .shine::after,
  .ticker-track,
  .digit-pop {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

---

## 8. Dark mode behavior

- Toggle lives **in the top nav** (circular 34×34 button, sun/moon SVG with a clip-path reveal) AND in the Tweaks panel.
- Toggle sets `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`.
- Persist via the Tweaks edit-mode protocol (`theme` key in the `EDITMODE-BEGIN/END` JSON block).
- Every color uses a token — **do not hardcode** `#fff`, `#000`, `rgba(0,0,0,.x)` in components (except the brand chain dots and the dark Integration block, which is intentionally inverted both ways).
- Borders in dark mode drop saturation; shadows intensify (see `--shadow-soft`).
- Drawer backdrop alpha is higher in dark (`.55`) so cards pop.
- The **dark "Integration" band is NOT themed** — it stays inked in both modes. It's a deliberate brand moment.

---

## 9. Content & copy voice

- **Editorial, not marketing**. Prefer dry precision: "Median release: 11.4 s · evidence → settlement" over "Lightning fast payouts!".
- **Lowercase metadata** always: `posted by agent.logi-7 · 11 min ago · evidence: photo + signed receipt`.
- **Serif display uses one italic clause for contrast**: "Humans today. / _Robots tomorrow._"
- **Money** is always prefixed with `$` or a currency string, never just a number.
- **Never filler sections**. Every band earns its place: stats, chains, how, agents, integration, footer. That's it.

---

## 10. Do / don't

| Do                                                    | Don't                                                |
| ----------------------------------------------------- | ---------------------------------------------------- |
| Use `var(--token)` for every color                    | Hardcode hex/rgba outside the chain colors           |
| Let serif + mono carry contrast                       | Add a third display face                             |
| Put the big number on the right, big date on the left | Rebalance row columns for "visual interest"          |
| Use `.reveal` + stagger on first paint                | Chain reveal animations on every route change        |
| Border-first separation in light mode                 | Lean on drop-shadows for hierarchy                   |
| 40–60px serif for money, 10px mono eyebrows           | Mix weights inside Instrument Serif                  |
| Keep accent color for live/paid/success               | Paint wide backgrounds in accent                     |
| Transition all colors in 350ms smooth for theme-swap  | Animate individual properties with different timings |

---

## 11. Snippets

### Eyebrow label

```jsx
<div
  className="mono"
  style={{
    fontSize: 10.5,
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: "var(--mute)",
    marginBottom: 10,
  }}
>
  SECTION LABEL
</div>
```

### Reveal on mount (stagger children)

```jsx
<h1 className="serif reveal reveal-d2" style={{...}}>…</h1>
<p  className="reveal reveal-d3" style={{...}}>…</p>
<div className="reveal reveal-d4">…buttons…</div>
```

### Theme toggle

```js
const next =
  document.documentElement.getAttribute("data-theme") === "dark"
    ? "light"
    : "dark";
document.documentElement.setAttribute("data-theme", next);
```

### Spotlight hover for cards

```jsx
<div
  className="spot"
  onMouseMove={(e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }}
>
  …
</div>
```

---

## 12. File checklist when porting to a new surface

1. Drop the `:root` + `html[data-theme="dark"]` token block at the top of your stylesheet.
2. Add the three Google Font imports (Instrument Serif, Inter, JetBrains Mono).
3. Paste the keyframes + utility classes from `§7.3`.
4. Build pages using only: `--bg`, `--bg-2`, `--ink`, `--ink-2`, `--mute`, `--line`, `--line-2`, `--card`, `--accent`.
5. Every new component gets a `.btn` / `.reveal` / `.spot` if it has interaction or a mount.
6. Test theme toggle round-trip — nothing should "flash".
7. Test `prefers-reduced-motion` — motion disables, layout doesn't shift.

---

_Agent Zero · design system v0.9 · maintained alongside the live marketplace surface._
