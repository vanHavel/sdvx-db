# Sub-Task 5: Song Row & Chart Rendering — Detailed Plan

## Overview

Implement `web/src/render.ts` — the module that transforms song data into HTML and renders it into the `#results` container. Each song becomes a row with song info on the left and 4 chart cells on the right, including radar charts.

Reference: [iidx-db/web/render.ts](../iidx-db/web/render.ts)

---

## Deliverable

| File | Description |
|---|---|
| `web/src/render.ts` | `renderSongInfo()` + `updateNav()` functions |

---

## 1. Public API

```typescript
export function renderSongInfo(
  songIds: number[],
  songInfo: Record<number, Song>,
  searchParams: QueryParams
): string;
```

- **`songIds`**: Ordered list of song IDs to render (determines display order)
- **`songInfo`**: Map from song ID to `Song` object with chart data
- **`searchParams`**: Current active search params, used to determine which charts to grey out
- **Returns**: HTML string to set as `innerHTML` of `#results`

**Why return HTML string instead of DOM nodes?** Same as iidx-db — `innerHTML` assignment is simpler and fast enough for 20 rows. After setting innerHTML, we need a second pass to draw canvases (canvas elements can't be serialized to HTML strings with their drawn content).

Therefore the actual flow is:
1. `renderSongInfo()` returns HTML string (with empty `<canvas>` elements)
2. Caller sets `innerHTML`
3. `drawAllRadars()` is called to paint the canvases

Updated API:

```typescript
export function renderSongInfo(
  songIds: number[],
  songInfo: Record<number, Song>,
  searchParams: QueryParams
): string;

export function drawAllRadars(
  songIds: number[],
  songInfo: Record<number, Song>
): void;
```

---

## 2. Song Row HTML Structure

Each song row produces this DOM (matching the CSS classes defined in Step 7):

```html
<div class="song-row" data-song-id="42">
  <!-- Left: Song Info -->
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

  <!-- Right: 4 Chart Cells -->
  <div class="chart-cells">
    <!-- NOV -->
    <div class="chart-cell difficulty-nov selected-true">
      <span class="chart-diff-label">NOV</span>
      <span class="chart-level">5</span>
      <canvas class="chart-radar" id="radar-42-0" width="160" height="160"></canvas>
    </div>
    <!-- ADV -->
    <div class="chart-cell difficulty-adv selected-true">
      <span class="chart-diff-label">ADV</span>
      <span class="chart-level">10</span>
      <canvas class="chart-radar" id="radar-42-1" width="160" height="160"></canvas>
    </div>
    <!-- EXH -->
    <div class="chart-cell difficulty-exh selected-true">
      <span class="chart-diff-label">EXH</span>
      <span class="chart-level">14</span>
      <canvas class="chart-radar" id="radar-42-2" width="160" height="160"></canvas>
    </div>
    <!-- 4th slot (MXM in this case) -->
    <div class="chart-cell difficulty-mxm selected-true">
      <span class="chart-diff-label">MXM</span>
      <span class="chart-level">17</span>
      <canvas class="chart-radar" id="radar-42-8" width="160" height="160"></canvas>
    </div>
  </div>
</div>
```

### Empty chart cell (no chart for that slot):

```html
<div class="chart-cell chart-cell-empty">
  <span class="chart-diff-label">—</span>
</div>
```

---

## 3. Implementation Detail

### `renderSongInfo()`

```typescript
import { Song, Chart, QueryParams } from './model';
import {
  difficultyAbbreviations,
  difficultyColors,
  fourthChartDifficulties,
  getImagePath,
} from './constants';

export function renderSongInfo(
  songIds: number[],
  songInfo: Record<number, Song>,
  searchParams: QueryParams
): string {
  if (songIds.length === 0) {
    return '<div class="no-results">No songs found.</div>';
  }

  return songIds.map(id => {
    const song = songInfo[id];
    if (!song) return '';
    return renderSongRow(id, song, searchParams);
  }).join('');
}
```

### `renderSongRow()`

```typescript
function renderSongRow(songId: number, song: Song, searchParams: QueryParams): string {
  const imagePath = getImagePath(song.unlock_source_code, song.music_pack_name ?? null, song.source_version_code);
  const bpmText = song.min_bpm === song.max_bpm
    ? `BPM ${formatBpm(song.min_bpm)}`
    : `BPM ${formatBpm(song.min_bpm)}–${formatBpm(song.max_bpm)}`;

  return `
    <div class="song-row" data-song-id="${songId}">
      <div class="song-info">
        <img class="song-image" src="${imagePath}" alt="" loading="lazy" />
        <div class="song-meta">
          <span class="song-title">${escapeHtml(song.title)}</span>
          <span class="song-artist">${escapeHtml(song.artist)}</span>
          <span class="song-details">
            <span class="song-bpm">${bpmText}</span>
            <span class="song-version">${escapeHtml(song.source_version)}</span>
          </span>
        </div>
      </div>
      <div class="chart-cells">
        ${renderChartCell(songId, song.novice, 0, searchParams)}
        ${renderChartCell(songId, song.advanced, 1, searchParams)}
        ${renderChartCell(songId, song.exhaust, 2, searchParams)}
        ${renderFourthChartCell(songId, song.fourth, searchParams)}
      </div>
    </div>`;
}
```

### `renderChartCell()`

Renders a single chart cell (NOV, ADV, or EXH slot).

```typescript
function renderChartCell(
  songId: number,
  chart: Chart | undefined,
  difficultyCode: number,
  searchParams: QueryParams
): string {
  if (!chart) {
    return '<div class="chart-cell chart-cell-empty"><span class="chart-diff-label">—</span></div>';
  }

  const abbr = difficultyAbbreviations[difficultyCode];
  const cssClass = getDifficultyClass(difficultyCode);
  const selected = isChartSelected(chart, difficultyCode, searchParams);

  return `
    <div class="chart-cell ${cssClass} selected-${selected}">
      <span class="chart-diff-label">${abbr}</span>
      <span class="chart-level">${chart.level}</span>
      <canvas class="chart-radar" id="radar-${songId}-${difficultyCode}" width="160" height="160"></canvas>
    </div>`;
}
```

### `renderFourthChartCell()`

The 4th slot handles dynamic difficulty labeling (could be INF, GRV, HVN, VVD, XCD, or MXM).

```typescript
function renderFourthChartCell(
  songId: number,
  chart: Chart | undefined,
  searchParams: QueryParams
): string {
  if (!chart) {
    return '<div class="chart-cell chart-cell-empty"><span class="chart-diff-label">—</span></div>';
  }

  const diffCode = chart.difficultyCode!;
  const abbr = difficultyAbbreviations[diffCode];
  const cssClass = getDifficultyClass(diffCode);
  const selected = isChartSelected(chart, diffCode, searchParams);

  return `
    <div class="chart-cell ${cssClass} selected-${selected}">
      <span class="chart-diff-label">${abbr}</span>
      <span class="chart-level">${chart.level}</span>
      <canvas class="chart-radar" id="radar-${songId}-${diffCode}" width="160" height="160"></canvas>
    </div>`;
}
```

---

## 4. Chart Selection (Grey-out Logic)

When a difficulty or level filter is active, charts that don't match are rendered with `selected-false` (greyed out via CSS). Charts that match get `selected-true`.

```typescript
function isChartSelected(chart: Chart, difficultyCode: number, searchParams: QueryParams): boolean {
  // If no difficulty/level filter is active, all charts are "selected"
  if (searchParams.difficulty === undefined && searchParams.level === undefined) {
    return true;
  }

  // If difficulty filter is active, check if this chart's difficulty matches
  if (searchParams.difficulty !== undefined && difficultyCode !== searchParams.difficulty) {
    return false;
  }

  // If level filter is active, check if this chart's level matches
  if (searchParams.level !== undefined && chart.level !== searchParams.level) {
    return false;
  }

  return true;
}
```

---

## 5. Drawing Radar Charts After Render

Canvas elements inserted via `innerHTML` are empty. After the HTML is set, we must iterate over all chart cells and draw their radar charts.

```typescript
export function drawAllRadars(
  songIds: number[],
  songInfo: Record<number, Song>
): void {
  for (const id of songIds) {
    const song = songInfo[id];
    if (!song) continue;

    const slots: [Chart | undefined, number][] = [
      [song.novice, 0],
      [song.advanced, 1],
      [song.exhaust, 2],
      [song.fourth, song.fourth?.difficultyCode ?? 8],
    ];

    for (const [chart, diffCode] of slots) {
      if (!chart) continue;
      const canvas = document.getElementById(`radar-${id}-${diffCode}`) as HTMLCanvasElement | null;
      if (!canvas) continue;
      drawRadar(canvas, chart.radar, difficultyColors[diffCode]);
    }
  }
}
```

### Integration in `main.ts`

The `search()` function in `main.ts` (Sub-Task 4) calls both:

```typescript
async function search(): Promise<void> {
  // ... get songIds, songInfo ...
  document.getElementById('results')!.innerHTML = renderSongInfo(songIds, songInfo, searchParams);
  drawAllRadars(songIds, songInfo);  // <-- added
  updateNav(page, pageSize, totalCount);
}
```

---

## 6. Helper Functions

### `escapeHtml()`

Prevent XSS from song titles/artists that might contain HTML-like characters.

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

### `formatBpm()`

Display BPM as integer if whole, or with one decimal if not.

```typescript
function formatBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}
```

### `getDifficultyClass()`

Maps a difficulty code to the CSS class name.

```typescript
const difficultyClassMap: Record<number, string> = {
  0: 'difficulty-nov',
  1: 'difficulty-adv',
  2: 'difficulty-exh',
  3: 'difficulty-inf',
  4: 'difficulty-grv',
  5: 'difficulty-hvn',
  6: 'difficulty-vvd',
  7: 'difficulty-xcd',
  8: 'difficulty-mxm',
};

function getDifficultyClass(code: number): string {
  return difficultyClassMap[code] ?? '';
}
```

---

## 7. Imports

```typescript
import { Song, Chart, Radar, QueryParams } from './model';
import { drawRadar } from './radar';
import {
  difficultyAbbreviations,
  difficultyColors,
  fourthChartDifficulties,
  getImagePath,
} from './constants';
```

---

## 8. Edge Cases

- **Song with no charts at all**: Possible for broken data. Render the song info but all 4 chart cells empty
- **Song with only 1 chart**: Tutorial songs have only NOV. ADV/EXH/4th cells render as empty ("—")
- **Song titles with HTML characters**: e.g. `"Le ××××"`, `"INF-B《L-aste-R》"` — `escapeHtml()` handles `<`, `>`, `&`, `"`
- **Variable BPM**: When `min_bpm !== max_bpm`, display as a range "BPM 150–200"
- **Floating-point BPM**: Some songs have BPM like 159.5 — `formatBpm()` shows one decimal
- **Missing image**: If a pack/version image doesn't exist, the `<img>` will show nothing (alt=""). Consider adding an `onerror` fallback or CSS fallback background
- **Canvas IDs must be unique**: `radar-{songId}-{difficultyCode}` guarantees uniqueness since each song has at most one chart per difficulty
- **4th slot difficultyCode**: The `difficultyCode` on the fourth chart must be read from the chart data itself (it could be 3, 4, 5, 6, 7, or 8), not hardcoded

---

## 9. Verification

1. **20 songs render**: Initial load shows 20 song rows with all chart data
2. **Song info correct**: Title, artist, BPM, version all display correctly for a known song
3. **Image displays**: Song pack image or version logo appears on the left side of each row
4. **4 chart columns**: Each row has 4 chart cells (NOV, ADV, EXH, 4th)
5. **Dynamic 4th label**: The 4th column shows the correct abbreviation (MXM, GRV, INF, etc.) per song
6. **Empty chart cells**: Songs with fewer than 4 charts show "—" in empty slots
7. **Radar charts render**: Each chart cell shows a hexagonal radar chart with the correct color
8. **Difficulty colors match**: NOV = purple, ADV = yellow, EXH = red, etc.
9. **Grey-out works**: With difficulty filter "Maximum" active, only MXM charts are fully visible; NOV/ADV/EXH are dimmed
10. **Level grey-out**: With level filter "20" active, only level 20 charts are fully visible
11. **No grey-out without filter**: When no difficulty/level filter is active, all charts are fully visible
12. **HTML escaping**: Songs with special characters in titles render correctly without breaking HTML
13. **BPM formatting**: Integer BPMs show without decimals; fractional BPMs show one decimal
14. **No results**: Empty search → "No songs found." message appears
15. **Performance**: Rendering 20 rows + 80 radar canvases completes in < 100ms
