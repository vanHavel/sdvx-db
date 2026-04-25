# Sub-Task 6: Radar Chart Rendering — Detailed Plan

## Overview

Implement `web/src/radar.ts` — a module that draws hexagonal radar charts onto HTML5 Canvas elements. Each chart cell in a song row will contain a small radar visualization of the 6 radar values (Notes, Peak, Tsumami, One Hand, Hand Trip, Tricky).

---

## Deliverable

| File | Description |
|---|---|
| `web/src/radar.ts` | `drawRadar(canvas, radar, color)` function + helpers |

---

## 1. Data Characteristics

Radar values range from 0 to 20,000 across 6 axes:

| Axis | Min | Max | Charts > 10k |
|---|---|---|---|
| Notes | 0 | 20,000 | 1,028 (14.5%) |
| Peak | 0 | 20,000 | 1,439 (20.2%) |
| Tsumami | 0 | 20,000 | 187 (2.6%) |
| One Handed | 0 | 20,000 | 598 (8.4%) |
| Hand Trip | 0 | 20,000 | 132 (1.9%) |
| Tricky | 0 | 20,000 | 168 (2.4%) |

**Key insight**: The hexagon boundary represents 10,000. Values above 10k are common (especially Notes and Peak) and should visually "spike" outside the hexagon. The canvas must not clip these spikes.

---

## 2. Canvas Geometry

### Dimensions

- **Canvas CSS size**: 80×80px (compact, fits in a chart cell)
- **Canvas pixel size**: 160×160px (2x for retina/HiDPI displays)
- **Center**: (80, 80) in canvas coordinates
- **Hexagon radius** (at value = 10,000): ~32px canvas-space (64px pixel-space)
- **Padding**: ~16px on each side for axis labels and spike overflow

### Hexagon Axis Layout

6 axes at 60° intervals, starting from the top (12 o'clock position). Going clockwise:

```
         Notes (0°)
        /          \
 Tricky            Peak
 (300°)            (60°)
  |                  |
 Hand Trip        Tsumami
 (240°)            (120°)
        \          /
      One Handed (180°)
```

Axis angles (starting from top, clockwise):
```typescript
const AXES = [
  { key: 'notes',       label: 'NOT', angle: -Math.PI / 2 },          // top (12 o'clock)
  { key: 'peak',        label: 'PEK', angle: -Math.PI / 2 + Math.PI / 3 },  // 2 o'clock
  { key: 'tsumami',     label: 'TSU', angle: -Math.PI / 2 + 2 * Math.PI / 3 }, // 4 o'clock
  { key: 'one_handed',  label: 'ONE', angle: Math.PI / 2 },           // bottom (6 o'clock)
  { key: 'hand_trip',   label: 'HND', angle: Math.PI / 2 + Math.PI / 3 },  // 8 o'clock
  { key: 'tricky',      label: 'TRK', angle: Math.PI / 2 + 2 * Math.PI / 3 }, // 10 o'clock
];
```

### Coordinate Calculation

For a given value on a given axis:
```typescript
function getPoint(cx: number, cy: number, angle: number, value: number, maxRadius: number): [number, number] {
  const ratio = value / 10000; // 10k = hexagon boundary
  const r = ratio * maxRadius;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}
```

Values > 10,000 produce points beyond the hexagon (r > maxRadius). Values up to 20,000 will extend up to 2× the hexagon radius.

---

## 3. Drawing Steps

The `drawRadar` function performs these steps in order:

### Step 1: Set up Canvas

```typescript
export function drawRadar(canvas: HTMLCanvasElement, radar: Radar, color: string): void {
  const size = 160; // pixel size (2x for retina)
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 54; // hexagon radius in pixels (leaves room for labels + spikes)
}
```

### Step 2: Draw Hexagon Grid

Draw the boundary hexagon (value = 10,000) and optionally inner grid lines (e.g. at 5,000).

```typescript
// Outer hexagon (10k boundary)
ctx.beginPath();
for (let i = 0; i < 6; i++) {
  const [x, y] = getPoint(cx, cy, AXES[i].angle, 10000, maxRadius);
  if (i === 0) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}
ctx.closePath();
ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
ctx.lineWidth = 1;
ctx.stroke();

// Inner hexagon (5k guideline)
ctx.beginPath();
for (let i = 0; i < 6; i++) {
  const [x, y] = getPoint(cx, cy, AXES[i].angle, 5000, maxRadius);
  if (i === 0) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}
ctx.closePath();
ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
ctx.lineWidth = 0.5;
ctx.stroke();

// Axis lines from center to boundary
ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
ctx.lineWidth = 0.5;
for (let i = 0; i < 6; i++) {
  const [x, y] = getPoint(cx, cy, AXES[i].angle, 10000, maxRadius);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x, y);
  ctx.stroke();
}
```

### Step 3: Draw Data Polygon

The filled polygon connecting all 6 radar values.

```typescript
const values = [
  radar.notes, radar.peak, radar.tsumami,
  radar.one_handed, radar.hand_trip, radar.tricky,
];

ctx.beginPath();
for (let i = 0; i < 6; i++) {
  const [x, y] = getPoint(cx, cy, AXES[i].angle, values[i], maxRadius);
  if (i === 0) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}
ctx.closePath();

// Semi-transparent fill
ctx.fillStyle = colorWithAlpha(color, 0.25);
ctx.fill();

// Solid stroke
ctx.strokeStyle = color;
ctx.lineWidth = 1.5;
ctx.stroke();
```

### Step 4: Draw Axis Labels

Small 3-letter abbreviations outside each hexagon vertex.

```typescript
ctx.font = '16px Inter, system-ui, sans-serif';
ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

const labelOffset = maxRadius + 16; // push labels outside the hexagon
for (let i = 0; i < 6; i++) {
  const [lx, ly] = getPoint(cx, cy, AXES[i].angle, 10000 * (labelOffset / maxRadius), maxRadius);
  ctx.fillText(AXES[i].label, lx, ly);
}
```

---

## 4. Helper Functions

### `colorWithAlpha(hex, alpha)`

Convert a hex color string to an rgba string.

```typescript
function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

### Difficulty Colors (from `constants.ts`)

The `color` parameter passed to `drawRadar` comes from:

```typescript
export const difficultyColors: Record<number, string> = {
  0: '#7b48a8',  // NOV - purple
  1: '#e8b831',  // ADV - yellow
  2: '#c4314b',  // EXH - red
  3: '#d176b6',  // INF - pink
  4: '#e58019',  // GRV - orange
  5: '#29aee6',  // HVN - cyan
  6: '#e64593',  // VVD - magenta
  7: '#1bb917',  // XCD - green
  8: '#eeeeee',  // MXM - white/silver
};
```

---

## 5. Public API

```typescript
// radar.ts exports:

export function drawRadar(canvas: HTMLCanvasElement, radar: Radar, color: string): void;
```

**Usage from render.ts (Sub-Task 5):**

```typescript
import { drawRadar } from './radar';
import { difficultyColors } from './constants';

// For each chart cell:
const canvas = document.createElement('canvas');
canvas.style.width = '80px';
canvas.style.height = '80px';
drawRadar(canvas, chart.radar, difficultyColors[chart.difficultyCode]);
cell.appendChild(canvas);
```

---

## 6. Edge Cases

- **All zeros**: If all radar values are 0 (e.g. tutorial charts), the polygon collapses to a point at center. This is fine — the hexagon grid is still visible showing it's an empty chart.
- **All maxed at 20k**: The polygon extends to 2× the hexagon boundary in all directions. The `maxRadius` (54px) plus padding (26px each side) allows up to ~2× radius = 108px from center, which fits within the 160px canvas (center at 80).
- **Single spike**: One axis at 20k, others at 0 — produces a thin spike. Visually distinctive and correct.
- **Non-integer values**: Radar values are always integers in the data, but the math works with any numeric value.
- **HiDPI rendering**: Canvas pixel size is 2× the CSS size. Set `canvas.width/height = 160` and `canvas.style.width/height = '80px'` for crisp rendering on retina displays.

---

## 7. Verification

1. **Visual check**: Render a few known charts and verify the shapes look reasonable:
   - A balanced chart (all values ~5000) should show a regular hexagon inside the boundary
   - A notes-heavy chart (notes=18000, others=2000) should show a spike upward
   - An all-zero chart should show just the hexagon grid
2. **Color check**: Each difficulty should render in its correct color (purple for NOV, yellow for ADV, etc.)
3. **Label readability**: The 3-letter axis labels should be visible and correctly positioned outside each vertex
4. **Retina sharpness**: On a HiDPI display, lines and text should be crisp, not blurry
5. **Performance**: Rendering ~80 radar charts (20 songs × 4 charts) on a page should be near-instant (<50ms total)
6. **Canvas cleanup**: Each call to `drawRadar` should `clearRect` first so re-rendering works correctly
