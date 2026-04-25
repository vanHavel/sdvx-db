# Sub-Task 7: Styling & Visual Design — Detailed Plan

## Overview

Implement the full CSS for SDVX-DB in `web/src/main.css`. The design is dark-themed with neon accents, inspired by the SDVX arcade aesthetic. No CSS frameworks — vanilla CSS only.

---

## Deliverable

| File | Description |
|---|---|
| `web/src/main.css` | Complete stylesheet (rewrite the existing minimal reset) |

---

## 1. Design Tokens (CSS Custom Properties)

Define all colors, spacing, and typography as CSS variables on `:root` for easy theming and consistency.

```css
:root {
  /* Background layers */
  --bg-primary: #0a0a0f;        /* page background — near-black with blue tint */
  --bg-secondary: #12121a;      /* card/panel background */
  --bg-tertiary: #1a1a26;       /* input/select backgrounds */
  --bg-hover: #22222e;          /* hover state for interactive elements */

  /* Text */
  --text-primary: #e8e8f0;      /* main text — warm white */
  --text-secondary: #8888a0;    /* labels, metadata */
  --text-muted: #555568;        /* disabled, placeholder */

  /* Accent — a neon blue/purple inspired by SDVX's UI */
  --accent: #6366f1;            /* primary accent (indigo) */
  --accent-hover: #818cf8;      /* lighter on hover */
  --accent-glow: rgba(99, 102, 241, 0.3); /* glow effect */

  /* Borders */
  --border: #2a2a3a;            /* subtle dividers */
  --border-hover: #3a3a4e;      /* hover state borders */

  /* Difficulty colors */
  --diff-nov: #7b48a8;
  --diff-adv: #e8b831;
  --diff-exh: #c4314b;
  --diff-inf: #d176b6;
  --diff-grv: #e58019;
  --diff-hvn: #29aee6;
  --diff-vvd: #e64593;
  --diff-xcd: #1bb917;
  --diff-mxm: #eeeeee;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;

  /* Layout */
  --max-width: 1200px;
}
```

---

## 2. Base & Reset

Keep the existing reset and extend with dark theme base styles.

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
}

body {
  min-height: 100vh;
}

button, input, select {
  font: inherit;
  color: inherit;
}

::selection {
  background: var(--accent);
  color: white;
}
```

---

## 3. Layout — `#app`

Single-column centered layout with max-width.

```css
#app {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-height: 100vh;
}
```

---

## 4. Header — `#site-header`

Prominent title with subtle glow.

```css
#site-header {
  text-align: center;
  padding: var(--space-xl) 0 var(--space-md);
}

#site-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: linear-gradient(135deg, var(--accent), #a78bfa, var(--accent-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 5. Search Panel — `#search-panel`

Glassmorphism-style card with semi-transparent background and subtle border.

```css
#search-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  backdrop-filter: blur(8px);
}

#search-heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: var(--space-md);
}

/* Search rows — 3 fields per row on desktop */
.search-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.search-row:last-child {
  margin-bottom: 0;
}

/* Individual field */
.search-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.search-field label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Inputs & Selects

```css
.search-field input,
.search-field select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  outline: none;
  width: 100%;
}

.search-field input:focus,
.search-field select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.search-field input::placeholder {
  color: var(--text-muted);
}

/* Style select dropdown arrows */
.search-field select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238888a0' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  cursor: pointer;
}
```

### Search Actions (sort toggle + button)

```css
.search-actions {
  flex-direction: row !important;
  align-items: flex-end;
  gap: var(--space-sm) !important;
}

.sort-toggle {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
  line-height: 1.5;
}

.sort-toggle:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.search-button {
  flex: 1;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-lg);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.search-button:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 16px var(--accent-glow);
}
```

---

## 6. Results Section — `#results`

The results container and individual song rows (built by `render.ts` in Sub-Task 5). The CSS must anticipate the DOM structure that `render.ts` will produce.

### Expected Song Row Structure (from Sub-Task 5)

```html
<div class="song-row">
  <div class="song-info">
    <img class="song-image" src="/img/version_booth.webp" alt="" loading="lazy" />
    <div class="song-meta">
      <span class="song-title">ALBIDA Powerless Mix</span>
      <span class="song-artist">無力P</span>
      <span class="song-details">
        <span class="song-bpm">BPM 156</span>
        <span class="song-version">BOOTH</span>
      </span>
    </div>
  </div>
  <div class="chart-cells">
    <div class="chart-cell difficulty-nov">
      <span class="chart-diff-label">NOV</span>
      <span class="chart-level">5</span>
      <span class="chart-effector">BING-WANG-FX</span>
      <span class="chart-exscore">EX 1,745</span>
      <canvas class="chart-radar" width="160" height="160"></canvas>
    </div>
    <div class="chart-cell difficulty-adv">...</div>
    <div class="chart-cell difficulty-exh">...</div>
    <div class="chart-cell difficulty-mxm">...</div>
  </div>
</div>
```

### Song Row Styles

```css
#results {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.song-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  transition: all var(--transition-fast);
}

.song-row:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
```

### Song Info (left side)

```css
.song-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  min-width: 0; /* allow text truncation */
}

.song-image {
  width: 60px;
  height: auto;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  opacity: 0.85;
}

.song-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.song-title {
  font-weight: 600;
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-details {
  display: flex;
  gap: var(--space-md);
  font-size: 0.75rem;
  color: var(--text-muted);
}
```

### Chart Cells (right side — 4 columns)

```css
.chart-cells {
  display: grid;
  grid-template-columns: repeat(4, 100px);
  gap: var(--space-xs);
}

.chart-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  text-align: center;
  transition: opacity var(--transition-fast);
}

/* Level number */
.chart-level {
  font-size: 1.125rem;
  font-weight: 700;
}

/* Difficulty label (e.g. NOV, MXM) */
.chart-diff-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

/* Effector name */
.chart-effector {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Max EX score */
.chart-exscore {
  font-size: 0.625rem;
  color: var(--text-muted);
}

/* Radar canvas */
.chart-radar {
  width: 80px;
  height: 80px;
}

/* Empty chart slot */
.chart-cell-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
```

### Difficulty Color Accents

Each chart cell gets a top border in the difficulty color, and the level number is colored.

```css
.difficulty-nov { border-top: 3px solid var(--diff-nov); }
.difficulty-nov .chart-level { color: var(--diff-nov); }

.difficulty-adv { border-top: 3px solid var(--diff-adv); }
.difficulty-adv .chart-level { color: var(--diff-adv); }

.difficulty-exh { border-top: 3px solid var(--diff-exh); }
.difficulty-exh .chart-level { color: var(--diff-exh); }

.difficulty-inf { border-top: 3px solid var(--diff-inf); }
.difficulty-inf .chart-level { color: var(--diff-inf); }

.difficulty-grv { border-top: 3px solid var(--diff-grv); }
.difficulty-grv .chart-level { color: var(--diff-grv); }

.difficulty-hvn { border-top: 3px solid var(--diff-hvn); }
.difficulty-hvn .chart-level { color: var(--diff-hvn); }

.difficulty-vvd { border-top: 3px solid var(--diff-vvd); }
.difficulty-vvd .chart-level { color: var(--diff-vvd); }

.difficulty-xcd { border-top: 3px solid var(--diff-xcd); }
.difficulty-xcd .chart-level { color: var(--diff-xcd); }

.difficulty-mxm { border-top: 3px solid var(--diff-mxm); }
.difficulty-mxm .chart-level { color: var(--diff-mxm); }
```

### Greyed-out Charts (unmatched filter)

When a difficulty/level filter is active, non-matching charts get reduced opacity.

```css
.chart-cell.selected-false {
  opacity: 0.3;
  filter: grayscale(0.5);
}
```

---

## 7. Pagination — `#pagination`

```css
#pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md) 0;
}

#pagination button {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-md);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all var(--transition-fast);
  min-width: 36px;
}

#pagination button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--bg-hover);
}

#pagination button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

#page-info {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  padding: 0 var(--space-sm);
}
```

---

## 8. Footer — `#site-footer`

```css
#site-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-lg) 0 var(--space-md);
  border-top: 1px solid var(--border);
  margin-top: auto;
}

.last-updated {
  font-size: 0.75rem;
  color: var(--text-muted);
}

#site-footer a {
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

#site-footer a:hover {
  color: var(--accent);
}
```

---

## 9. Loading / Empty States

```css
/* Loading indicator */
.loading {
  text-align: center;
  padding: var(--space-xl);
  color: var(--text-secondary);
}

.loading::after {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: var(--space-sm);
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* No results */
.no-results {
  text-align: center;
  padding: var(--space-xl);
  color: var(--text-muted);
  font-size: 0.875rem;
}
```

---

## 10. Responsive Design

Desktop-first, with breakpoints for smaller screens.

```css
/* Tablet: stack search rows to 2 columns */
@media (max-width: 900px) {
  .search-row {
    grid-template-columns: 1fr 1fr;
  }

  .chart-cells {
    grid-template-columns: repeat(4, 80px);
  }
}

/* Mobile: single column */
@media (max-width: 600px) {
  .search-row {
    grid-template-columns: 1fr;
  }

  .song-row {
    grid-template-columns: 1fr;
    gap: var(--space-sm);
  }

  .chart-cells {
    grid-template-columns: repeat(4, 1fr);
  }

  #site-header h1 {
    font-size: 1.25rem;
  }
}
```

---

## 11. Micro-Animations

Subtle animations for polish.

```css
/* Fade-in for newly loaded results */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.song-row {
  animation: fadeIn var(--transition-normal) ease-out;
}

/* Stagger animation for song rows */
.song-row:nth-child(1)  { animation-delay: 0ms; }
.song-row:nth-child(2)  { animation-delay: 20ms; }
.song-row:nth-child(3)  { animation-delay: 40ms; }
.song-row:nth-child(4)  { animation-delay: 60ms; }
.song-row:nth-child(5)  { animation-delay: 80ms; }
.song-row:nth-child(6)  { animation-delay: 100ms; }
.song-row:nth-child(7)  { animation-delay: 120ms; }
.song-row:nth-child(8)  { animation-delay: 140ms; }
.song-row:nth-child(9)  { animation-delay: 160ms; }
.song-row:nth-child(10) { animation-delay: 180ms; }
/* rows 11-20 keep 180ms — no further stagger needed */
.song-row:nth-child(n+11) { animation-delay: 180ms; }
```

---

## 12. Verification

1. **Dark theme renders**: Page has dark background, white text, no flash-of-unstyled-content
2. **Search panel**: Glassmorphism effect visible, inputs styled with dark backgrounds, focus glow works
3. **Custom select arrows**: Dropdowns show the custom SVG chevron, not native browser arrows
4. **Difficulty colors**: Each of the 9 difficulty classes shows the correct color on border + level number
5. **Song row hover**: Rows highlight on hover with subtle border and shadow change
6. **Grey-out**: `.selected-false` class reduces opacity correctly
7. **Pagination**: Buttons styled, disabled state visible (dimmed)
8. **Loading spinner**: `.loading` class shows animated spinner
9. **Responsive**: At 600px width, search fields stack to single column, chart cells shrink
10. **Animations**: Song rows fade in with slight stagger on page load / search
11. **Typography**: Inter font loads and displays correctly, hierarchy clear (h1 > labels > body text > metadata)
12. **Gradient title**: The h1 shows a gradient text effect (purple/indigo)

---

## 13. Notes for Implementation

- **Do NOT modify `index.html`** — only modify `main.css`
- **CSS classes for song rows** are defined here but the actual DOM elements are created by `render.ts` (Sub-Task 5). This plan documents the expected class names so both Sub-Tasks 5 and 7 align
- **The `difficulty-*` classes** should use the abbreviated lowercase names matching the constants: `nov`, `adv`, `exh`, `inf`, `grv`, `hvn`, `vvd`, `xcd`, `mxm`
- **`selected-false`** class name matches iidx-db's convention
- Keep total CSS under ~500 lines — vanilla CSS should be concise
