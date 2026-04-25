# Sub-Task 4: Search/Filter UI Wiring — Detailed Plan

## Overview

Implement `web/src/main.ts` — the application entry point that wires up the search panel, pagination, and results rendering. This is the controller that connects the DB layer (Sub-Task 3) to the render layer (Sub-Task 5).

Reference: [iidx-db/web/main.ts](../iidx-db/web/main.ts)

---

## Deliverable

| File | Description |
|---|---|
| `web/src/main.ts` | Full application wiring (rewrite the stub) |

---

## 1. Application State

```typescript
let page = 1;
let maxPage = 1;
let searchParams: QueryParams = {};
let currentSort: SortConfig = { field: 'title', direction: 'asc' };
```

---

## 2. Extracting Query Parameters from DOM

### `getQueryParams(): QueryParams`

Reads all search/filter form values from the DOM and constructs a `QueryParams` object.

```typescript
function getQueryParams(): QueryParams {
  const params: QueryParams = {};

  // Text search fields — strip FTS special characters
  const title = (document.getElementById('title') as HTMLInputElement).value.trim();
  if (title) params.title = title;

  const artist = (document.getElementById('artist') as HTMLInputElement).value.trim();
  if (artist) params.artist = artist;

  const effector = (document.getElementById('effector') as HTMLInputElement).value.trim();
  if (effector) params.effector = effector;

  // Dropdown filters
  const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value;
  if (difficulty) params.difficulty = Number(difficulty);

  const level = (document.getElementById('level') as HTMLSelectElement).value;
  if (level) params.level = Number(level);

  const sourceVersion = (document.getElementById('source-version') as HTMLSelectElement).value;
  if (sourceVersion) params.sourceVersion = Number(sourceVersion);

  // Unlock source — special handling for "default", "blaster_gate", or specific pack name
  const unlockSource = (document.getElementById('unlock-source') as HTMLSelectElement).value;
  if (unlockSource === 'default') {
    params.unlockSource = 0;
  } else if (unlockSource === 'blaster_gate') {
    params.unlockSource = 2;
  } else if (unlockSource) {
    // It's a specific music pack name
    params.unlockSource = 1;
    params.musicPackName = unlockSource;
  }

  return params;
}
```

### `getSortConfig(): SortConfig`

```typescript
function getSortConfig(): SortConfig {
  const field = (document.getElementById('order') as HTMLSelectElement).value;
  const directionBtn = document.getElementById('sort-direction') as HTMLButtonElement;
  const direction = directionBtn.dataset.direction as 'asc' | 'desc';
  return { field, direction };
}
```

---

## 3. Initial View Detection

The "initial view" is the default state: no filters, sort by title ascending, page 1. In this case we can skip the WASM DB and use `initial-data.json` for instant rendering.

```typescript
function isInitialView(): boolean {
  return (
    Object.keys(searchParams).length === 0 &&
    currentSort.field === 'title' &&
    currentSort.direction === 'asc' &&
    page === 1
  );
}
```

---

## 4. Main Search Function

```typescript
async function search(): Promise<void> {
  if (isInitialView()) {
    // Fast path: use pre-baked initial data
    const { songIds, songInfo, totalCount } = await loadInitialData();
    maxPage = Math.ceil(totalCount / pageSize);
    document.getElementById('results')!.innerHTML = renderSongInfo(songIds, songInfo, searchParams);
    updateNav(page, pageSize, totalCount);
    // Load full DB in background for subsequent queries
    setTimeout(() => loadDatabase(), 100);
  } else {
    // Full path: query the WASM SQLite database
    const [ids, totalCount] = await getSongIds(searchParams, currentSort, page, pageSize);
    maxPage = Math.ceil(totalCount / pageSize);
    const songInfo = await getSongInfo(ids);
    document.getElementById('results')!.innerHTML = renderSongInfo(ids, songInfo, searchParams);
    updateNav(page, pageSize, totalCount);
  }
}
```

---

## 5. Populate Song Pack Dropdown

The `<optgroup label="Song Packs">` in the HTML is empty — it needs to be populated with the 38 pack names. These can be hardcoded in `constants.ts` or fetched from the DB.

### Approach: Hardcode in `constants.ts`

```typescript
// constants.ts
export const musicPackNames: string[] = [
  '10th Anniversary Music Pack',
  'BEMANI Selection Music Pack vol.1',
  'BEMANI Selection Music Pack vol.2',
  'BEMANI Selection Music Pack vol.3',
  'COCONATSU Selection Music Pack',
  'Music Pack vol.1',
  'Music Pack vol.2',
  // ... all 38 packs, sorted alphabetically
  'beatmania IIDX Selection Music Pack vol.1',
  'jubeat Selection Music Pack vol.1',
];
```

### Populate on page load

```typescript
function populatePackDropdown(): void {
  const select = document.getElementById('unlock-source') as HTMLSelectElement;
  const optgroup = select.querySelector('optgroup[label="Song Packs"]') as HTMLOptGroupElement;

  for (const packName of musicPackNames) {
    const option = document.createElement('option');
    option.value = packName;
    option.textContent = packName;
    optgroup.appendChild(option);
  }
}
```

---

## 6. Event Listeners

### Search Button

```typescript
document.getElementById('search')!.addEventListener('click', async () => {
  page = 1;
  searchParams = getQueryParams();
  currentSort = getSortConfig();
  await search();
});
```

### Enter Key in Text Fields

```typescript
for (const fieldId of ['title', 'artist', 'effector']) {
  document.getElementById(fieldId)!.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      document.getElementById('search')!.click();
    }
  });
}
```

### Sort Direction Toggle

```typescript
document.getElementById('sort-direction')!.addEventListener('click', () => {
  const btn = document.getElementById('sort-direction') as HTMLButtonElement;
  if (btn.dataset.direction === 'asc') {
    btn.dataset.direction = 'desc';
    btn.textContent = '▼';
  } else {
    btn.dataset.direction = 'asc';
    btn.textContent = '▲';
  }
});
```

### Pagination

```typescript
document.getElementById('first-page')!.addEventListener('click', async () => {
  page = 1;
  await search();
});

document.getElementById('prev-page')!.addEventListener('click', async () => {
  if (page > 1) { page--; await search(); }
});

document.getElementById('next-page')!.addEventListener('click', async () => {
  if (page < maxPage) { page++; await search(); }
});

document.getElementById('last-page')!.addEventListener('click', async () => {
  page = maxPage;
  await search();
});
```

---

## 7. `updateNav` Function

Updates the pagination text and enables/disables buttons. This could live in `main.ts` or be exported from `render.ts`.

```typescript
function updateNav(page: number, pageSize: number, totalCount: number): void {
  const firstOffset = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOffset = Math.min(page * pageSize, totalCount);

  document.getElementById('first-offset')!.textContent = String(firstOffset);
  document.getElementById('last-offset')!.textContent = String(lastOffset);
  document.getElementById('total-count')!.textContent = String(totalCount);

  const firstBtn = document.getElementById('first-page') as HTMLButtonElement;
  const prevBtn = document.getElementById('prev-page') as HTMLButtonElement;
  const nextBtn = document.getElementById('next-page') as HTMLButtonElement;
  const lastBtn = document.getElementById('last-page') as HTMLButtonElement;

  firstBtn.disabled = page <= 1;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= maxPage;
  lastBtn.disabled = page >= maxPage;
}
```

---

## 8. Full `main.ts` Structure

```typescript
import { getSongIds, getSongInfo, loadInitialData, loadDatabase, QueryParams, SortConfig } from './db';
import { pageSize, musicPackNames } from './constants';
import { renderSongInfo } from './render';

// --- State ---
let page = 1;
let maxPage = 1;
let searchParams: QueryParams = {};
let currentSort: SortConfig = { field: 'title', direction: 'asc' };

// --- Functions ---
function getQueryParams(): QueryParams { ... }
function getSortConfig(): SortConfig { ... }
function isInitialView(): boolean { ... }
async function search(): Promise<void> { ... }
function updateNav(page: number, pageSize: number, totalCount: number): void { ... }
function populatePackDropdown(): void { ... }

// --- Init ---
populatePackDropdown();

// --- Event listeners ---
// Search button
// Enter key on text fields
// Sort direction toggle
// Pagination buttons

// --- Initial search ---
await search();
```

**Note**: The file uses top-level `await` which is supported because Vite is configured with `target: 'esnext'` and the script tag has `type="module"`.

---

## 9. Imports from Other Modules

From `db.ts` (Sub-Task 3):
- `loadInitialData()` → `{songIds, songInfo, totalCount}`
- `loadDatabase()` → loads WASM DB (returns promise, cached)
- `getSongIds(params, sort, page, pageSize)` → `[ids, totalCount]`
- `getSongInfo(ids)` → `Record<number, Song>`
- `QueryParams`, `SortConfig` types

From `constants.ts` (Sub-Task 3):
- `pageSize` → `20`
- `musicPackNames` → `string[]` (38 pack names)

From `render.ts` (Sub-Task 5):
- `renderSongInfo(songIds, songInfo, searchParams)` → HTML string

---

## 10. Edge Cases

- **Empty search results**: If `getSongIds` returns empty `ids`, `renderSongInfo` should return an empty/no-results state. `updateNav` shows "Showing 0 to 0 of 0"
- **FTS empty input**: If a user clears a text field and searches, the parameter should be omitted (not passed as empty string). The `if (title)` check in `getQueryParams` handles this
- **Unlock source "All"**: The `<select>` value is `""` → no filter applied
- **First page load**: The default state matches `isInitialView()` → uses `loadInitialData()` for instant render, then `loadDatabase()` in background
- **Rapid clicking**: Multiple simultaneous `search()` calls could interleave. This is acceptable — the last result wins. If desired, a simple `isSearching` flag could prevent concurrent calls, but iidx-db doesn't bother with this
- **Pack names in dropdown matching DB**: The pack name strings used as `<option value="">` must exactly match the `music_pack_name` column in the DB. Both come from the same JSONL source, so they should match

---

## 11. Verification

1. **Page loads with initial data**: Open the page → 20 songs appear immediately (before WASM loads)
2. **Search by title**: Type "ALBIDA" → click Search → correct results
3. **Enter key triggers search**: Type in title field → press Enter → search executes
4. **Filter by difficulty**: Select "Maximum" → click Search → only songs with MXM shown
5. **Filter by level**: Select "20" → click Search → only level 20 songs shown
6. **Filter by version**: Select "BOOTH" → only BOOTH songs shown
7. **Filter by unlock source**: Select "Default" → default-unlock songs shown
8. **Filter by pack**: Select "Music Pack vol.17" → only songs from that pack shown
9. **Sort by release date desc**: Change order to "Release Date" → click ▲ to ▼ → click Search → newest songs first
10. **Sort by BPM**: Change order to "BPM" → sorted by BPM
11. **Pagination next**: Click ❯ → page 2 loads, "Showing 21 to 40 of 1926"
12. **Pagination first/last**: Click ❮❮ → page 1; Click ❯❯ → last page
13. **Pagination disabled states**: On page 1, ❮❮ and ❮ are disabled. On last page, ❯ and ❯❯ are disabled
14. **Combined filters**: Title + difficulty + level → results correctly narrowed
15. **Reset to initial view**: Clear all fields, set order to Title asc, click Search → initial data renders again (fast path)
16. **Song pack dropdown populated**: The "Song Packs" optgroup has 38 options
17. **TypeScript compiles**: `npx tsc --noEmit` → no errors
