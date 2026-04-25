# Sub-Task 3: Database Layer — Detailed Plan

## Overview

Implement the full database layer in TypeScript: constants/mappings, DB loading/querying, and the `loadInitialData` fast-path. This sub-task fills in the stubs created in Sub-Task 2 (`constants.ts`, `db.ts`) and finalizes `model.ts`.

Reference: [iidx-db/web/db.ts](../iidx-db/web/db.ts), [iidx-db/web/constants.ts](../iidx-db/web/constants.ts)

---

## Files to Modify

| File | Status | Description |
|---|---|---|
| `web/src/constants.ts` | **Rewrite** | Full mappings and configuration |
| `web/src/db.ts` | **Rewrite** | DB loading, query builder, data fetching |
| `web/src/model.ts` | **Minor update** | May need minor adjustments after integration |

---

## 1. Constants & Mappings (`web/src/constants.ts`)

### Difficulty Mapping

Maps between the integer codes stored in DB/JSON and human-readable names/abbreviations.

```typescript
export const difficultyNames: Record<number, string> = {
  0: 'Novice',
  1: 'Advanced',
  2: 'Exhaust',
  3: 'Infinite',
  4: 'Gravity',
  5: 'Heavenly',
  6: 'Vivid',
  7: 'Exceed',
  8: 'Maximum',
};

export const difficultyAbbreviations: Record<number, string> = {
  0: 'NOV',
  1: 'ADV',
  2: 'EXH',
  3: 'INF',
  4: 'GRV',
  5: 'HVN',
  6: 'VVD',
  7: 'XCD',
  8: 'MXM',
};

// Difficulties 3-8 all occupy the "4th chart" slot
export const fourthChartDifficulties = new Set([3, 4, 5, 6, 7, 8]);
```

### Source Version Mapping

```typescript
export const sourceVersionNames: Record<number, string> = {
  0: 'BOOTH',
  1: 'Infinite Infection',
  2: 'Gravity Wars',
  3: 'Heavenly Haven',
  4: 'Vivid Wave',
  5: 'Exceed Gear',
  [-1]: 'Unknown',
};
```

### Unlock Source Mapping

```typescript
export const unlockSourceNames: Record<number, string> = {
  0: 'Default',
  1: 'Song Pack',
  2: 'Blaster Gate',
};
```

### Sort Order SQL Mappings

Maps the `<select id="order">` values + direction to SQL ORDER BY clauses.

```typescript
export const sortOrders: Record<string, { asc: string; desc: string }> = {
  title:        { asc: 's.sort_key ASC',      desc: 's.sort_key DESC' },
  release_date: { asc: 's.release_date ASC',  desc: 's.release_date DESC' },
  bpm:          { asc: 's.min_bpm ASC',        desc: 's.max_bpm DESC' },
};
```

### Image Path Helper

Maps a song's unlock source / music pack / version to the correct image path.

```typescript
export function getImagePath(unlockSource: number, musicPackName: string | null, sourceVersion: number): string {
  if (unlockSource === 1 && musicPackName) {
    const slug = musicPackName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `/img/pack_${slug}.webp`;
  }
  const versionSlugs: Record<number, string> = {
    0: 'booth', 1: 'infinite_infection', 2: 'gravity_wars',
    3: 'heavenly_haven', 4: 'vivid_wave', 5: 'exceed_gear',
  };
  return `/img/version_${versionSlugs[sourceVersion] ?? 'unknown'}.webp`;
}
```

### Page Size

```typescript
export const pageSize = 20;
```

---

## 2. Database Module (`web/src/db.ts`)

### 2.1 Database Loading

Same pattern as iidx-db: fetch the gzipped DB, decompress via `DecompressionStream`, deserialize into SQLite WASM.

```typescript
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db: any = null;

export async function loadDatabase() {
  if (db) return db;

  const sqlite3 = await sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  });

  const res = await fetch('/db.sqlite3.gzipped');
  const ds = new DecompressionStream('gzip');
  const decompressedStream = res.body!.pipeThrough(ds);
  const raw = new Uint8Array(await new Response(decompressedStream).arrayBuffer());

  const p = sqlite3.wasm.allocFromTypedArray(raw);
  const deserialize_flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE;
  db = new sqlite3.oo1.DB(raw);
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer, 'main', p, raw.byteLength, raw.byteLength, deserialize_flags
  );
  db.checkRc(rc);
  return db;
}
```

### 2.2 Query Builder

The query builder constructs a SQL query based on search/filter parameters. This is the core of the DB layer.

#### Query Parameters Interface

```typescript
export interface QueryParams {
  title?: string;       // FTS search on title
  artist?: string;      // FTS search on artist
  effector?: string;    // FTS search on effectors (denormalized)
  difficulty?: number;  // filter: exact match on chart difficulty
  level?: number;       // filter: exact match on chart level
  unlockSource?: number;     // filter: 0=default, 2=blaster_gate
  musicPackName?: string;    // filter: specific music pack name
  sourceVersion?: number;    // filter: exact match on source version
}

export interface SortConfig {
  field: string;        // 'title' | 'release_date' | 'bpm'
  direction: 'asc' | 'desc';
}
```

#### Query Building Logic

```typescript
function buildQuery(params: QueryParams, returnCount: boolean, sort?: SortConfig): string {
  let query: string;

  if (returnCount) {
    query = `SELECT COUNT(DISTINCT s.id) AS countSongs`;
  } else {
    query = `SELECT DISTINCT s.id`;
  }

  query += `
    FROM song s
    JOIN song_search ss ON s.id = ss.rowid`;

  // Only join chart table if we need chart-level filters
  const needsChartJoin = params.difficulty !== undefined || params.level !== undefined;
  if (needsChartJoin) {
    query += `\n    JOIN chart c ON s.id = c.id_song`;
  }

  query += `\n    WHERE 1=1`;

  // FTS search fields
  if (params.title) {
    // Support both Japanese title (LIKE) and English title (FTS MATCH)
    query += ` AND (s.title LIKE '%' || $title || '%'
      OR s.id IN (
        SELECT rowid FROM song_search WHERE title MATCH $title
      ))`;
  }
  if (params.artist) {
    query += ` AND s.id IN (SELECT rowid FROM song_search WHERE artist MATCH $artist)`;
  }
  if (params.effector) {
    query += ` AND s.id IN (SELECT rowid FROM song_search WHERE effectors MATCH $effector)`;
  }

  // Exact filters
  if (params.difficulty !== undefined) {
    query += ` AND c.difficulty = $difficulty`;
  }
  if (params.level !== undefined) {
    query += ` AND c.level = $level`;
  }
  if (params.unlockSource !== undefined) {
    query += ` AND s.unlock_source = $unlockSource`;
  }
  if (params.musicPackName !== undefined) {
    query += ` AND s.music_pack_name = $musicPackName`;
  }
  if (params.sourceVersion !== undefined) {
    query += ` AND s.source_version = $sourceVersion`;
  }

  if (!returnCount) {
    const orderBy = sort
      ? sortOrders[sort.field]?.[sort.direction] ?? 's.sort_key ASC'
      : 's.sort_key ASC';
    query += `\n    ORDER BY ${orderBy}\n    LIMIT $limit\n    OFFSET $offset`;
  }

  return query;
}
```

**Key design decisions:**

1. **FTS subqueries for each field**: FTS5 does not allow mixing MATCH across different columns in the same query easily, so we use subqueries (`s.id IN (SELECT rowid FROM song_search WHERE ... MATCH ...)`) for each field. This is clean and allows independent searching.

2. **Japanese title support**: Like iidx-db, the title search uses both `LIKE` (for Japanese characters that FTS may not tokenize well) and FTS `MATCH` (for English text). The `OR` ensures both work.

3. **Chart join only when needed**: If no difficulty or level filter is active, we skip the chart table join for better performance.

4. **Special handling for unlock source filter**: The HTML `<select id="unlock-source">` has values `"default"`, `"blaster_gate"`, and specific pack names. The `main.ts` (Sub-Task 4) will parse these into either `unlockSource` (int) or `musicPackName` (string) parameters.

#### Bind Parameters

Build bind parameters from `QueryParams`:

```typescript
function buildBindParams(params: QueryParams, page: number, pageSize: number): Record<string, any> {
  const bind: Record<string, any> = {};

  if (params.title) {
    // Strip FTS5 special characters for MATCH safety
    bind.$title = params.title.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ').trim();
  }
  if (params.artist) {
    bind.$artist = params.artist.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ').trim();
  }
  if (params.effector) {
    bind.$effector = params.effector.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ').trim();
  }
  if (params.difficulty !== undefined) bind.$difficulty = params.difficulty;
  if (params.level !== undefined) bind.$level = params.level;
  if (params.unlockSource !== undefined) bind.$unlockSource = params.unlockSource;
  if (params.musicPackName !== undefined) bind.$musicPackName = params.musicPackName;
  if (params.sourceVersion !== undefined) bind.$sourceVersion = params.sourceVersion;

  bind.$limit = pageSize;
  bind.$offset = (page - 1) * pageSize;

  return bind;
}
```

**FTS special character stripping**: The raw search text from the user must have FTS5 metacharacters removed before using in a `MATCH` query. These characters (`"`, `*`, `(`, `)`, etc.) have special meaning in FTS5 syntax and would cause query errors. We replace them with spaces (same approach as iidx-db).

### 2.3 Public API Functions

#### `getSongIds(params, sort, page, pageSize)`

Returns `[songIds: number[], totalCount: number]`.

```typescript
export async function getSongIds(
  params: QueryParams, sort: SortConfig, page: number, pageSize: number
): Promise<[number[], number]> {
  const database = await loadDatabase();

  // Get paginated IDs
  const query = buildQuery(params, false, sort);
  const bind = buildBindParams(params, page, pageSize);
  const resultRows: any[] = [];
  database.exec({ sql: query, bind, rowMode: 'object', resultRows });

  // Get total count
  const countQuery = buildQuery(params, true);
  const countBind = { ...bind };
  delete countBind.$limit;
  delete countBind.$offset;
  const countRows: any[] = [];
  database.exec({ sql: countQuery, bind: countBind, rowMode: 'object', resultRows: countRows });

  const ids = resultRows.map((row: any) => row.id);
  const totalCount = countRows[0]?.countSongs ?? 0;
  return [ids, totalCount];
}
```

#### `getSongInfo(songIds)`

Fetches full song + chart data for a list of song IDs. Returns a `Record<number, Song>`.

```typescript
export async function getSongInfo(songIds: number[]): Promise<Record<number, Song>> {
  if (!songIds.length) return {};

  const database = await loadDatabase();
  const placeholders = songIds.map(() => '?').join(', ');
  const query = `
    SELECT s.id, s.title, s.artist, s.min_bpm, s.max_bpm,
           s.release_date, s.source_version, s.unlock_source, s.music_pack_name,
           c.difficulty, c.level, c.effected_by, c.max_ex_score,
           c.radar_notes, c.radar_peak, c.radar_tsumami,
           c.radar_one_handed, c.radar_hand_trip, c.radar_tricky
    FROM song s
    JOIN chart c ON s.id = c.id_song
    WHERE s.id IN (${placeholders})
    ORDER BY c.difficulty
  `;
  const resultRows: any[] = [];
  database.exec({ sql: query, bind: songIds, rowMode: 'object', resultRows });

  return createSongMap(resultRows);
}
```

#### `createSongMap(rows)` — internal helper

Transforms flat DB rows into the `Song` model with charts organized by slot.

```typescript
function createSongMap(rows: any[]): Record<number, Song> {
  const songs: Record<number, Song> = {};

  for (const row of rows) {
    if (!songs[row.id]) {
      songs[row.id] = {
        title: row.title,
        artist: row.artist,
        min_bpm: row.min_bpm,
        max_bpm: row.max_bpm,
        release_date: row.release_date,
        source_version: sourceVersionNames[row.source_version] ?? 'Unknown',
        unlock_source: unlockSourceNames[row.unlock_source] ?? 'Unknown',
        music_pack_name: row.music_pack_name ?? undefined,
      };
    }

    const chart: Chart = {
      difficulty: difficultyNames[row.difficulty] ?? 'Unknown',
      level: row.level,
      effected_by: row.effected_by,
      max_ex_score: row.max_ex_score,
      radar: {
        notes: row.radar_notes,
        peak: row.radar_peak,
        tsumami: row.radar_tsumami,
        one_handed: row.radar_one_handed,
        hand_trip: row.radar_hand_trip,
        tricky: row.radar_tricky,
      },
    };

    // Assign chart to the correct slot
    const diff = row.difficulty;
    if (diff === 0) songs[row.id].novice = chart;
    else if (diff === 1) songs[row.id].advanced = chart;
    else if (diff === 2) songs[row.id].exhaust = chart;
    else if (fourthChartDifficulties.has(diff)) songs[row.id].fourth = chart;
  }

  return songs;
}
```

### 2.4 Initial Data Loading

Fast path: fetch `initial-data.json` and transform it into the same `Song` model, avoiding WASM loading on first page load.

```typescript
export async function loadInitialData(): Promise<{
  songIds: number[];
  songInfo: Record<number, Song>;
  totalCount: number;
}> {
  const response = await fetch('/initial-data.json');
  const data = await response.json();

  const songInfo: Record<number, Song> = {};
  for (const [songId, song] of Object.entries(data.songs)) {
    const s = song as any;
    const songObj: Song = {
      title: s.title,
      artist: s.artist,
      min_bpm: s.minBpm,
      max_bpm: s.maxBpm,
      release_date: s.releaseDate,
      source_version: sourceVersionNames[s.sourceVersion] ?? 'Unknown',
      unlock_source: unlockSourceNames[s.unlockSource] ?? 'Unknown',
      music_pack_name: s.musicPackName ?? undefined,
    };

    for (const chart of s.charts) {
      const chartObj: Chart = {
        difficulty: difficultyNames[chart.difficulty] ?? 'Unknown',
        level: chart.level,
        effected_by: chart.effectedBy,
        max_ex_score: chart.maxExScore,
        radar: {
          notes: chart.radar.notes,
          peak: chart.radar.peak,
          tsumami: chart.radar.tsumami,
          one_handed: chart.radar.oneHanded,
          hand_trip: chart.radar.handTrip,
          tricky: chart.radar.tricky,
        },
      };

      const diff = chart.difficulty;
      if (diff === 0) songObj.novice = chartObj;
      else if (diff === 1) songObj.advanced = chartObj;
      else if (diff === 2) songObj.exhaust = chartObj;
      else songObj.fourth = chartObj;
    }

    songInfo[Number(songId)] = songObj;
  }

  return {
    songIds: data.songIds,
    songInfo,
    totalCount: data.totalCount,
  };
}
```

**Key difference from `createSongMap`**: The initial data JSON uses **camelCase** keys (`minBpm`, `effectedBy`, `oneHanded`, etc.) while the DB rows use **snake_case** (`min_bpm`, `effected_by`, `one_handed`). Both must be mapped to the same `Song`/`Chart`/`Radar` types.

---

## 3. Model Types (`web/src/model.ts`)

The current model.ts is already correct. One potential addition is storing the raw numeric values for use in filtering/greying-out logic:

```typescript
export type Chart = {
  difficulty: string;         // display name: "Novice", "Maximum", etc.
  difficultyCode?: number;    // raw integer for filter matching
  level: number;
  effected_by: string;
  max_ex_score: number;
  radar: Radar;
};
```

Adding `difficultyCode` to `Chart` allows the render module (Sub-Task 5) to check whether a chart matches the active difficulty filter for grey-out logic, without needing to reverse-map the string back to an integer.

The `Song` type should also store the raw numeric codes for image path resolution:

```typescript
export type Song = {
  title: string;
  artist: string;
  min_bpm: number;
  max_bpm: number;
  release_date: string;
  source_version: string;      // display name
  source_version_code: number; // raw int for image path
  unlock_source: string;       // display name
  unlock_source_code: number;  // raw int for image path
  music_pack_name?: string;
  novice?: Chart;
  advanced?: Chart;
  exhaust?: Chart;
  fourth?: Chart;
};
```

---

## 4. Data Flow Summary

```
User clicks "Search"
       │
       ▼
  main.ts: getQueryParams()
  → extracts values from DOM into QueryParams + SortConfig
       │
       ▼
  db.ts: getSongIds(params, sort, page, pageSize)
  → buildQuery() → SQL string
  → buildBindParams() → bind object
  → execute query → [songIds, totalCount]
       │
       ▼
  db.ts: getSongInfo(songIds)
  → fetch all song + chart data for those IDs
  → createSongMap() → Record<number, Song>
       │
       ▼
  render.ts: renderSongInfo(songIds, songInfo, searchParams)
  → HTML string for results (Sub-Task 5)
```

For the initial load (no search params, default sort, page 1):
```
  db.ts: loadInitialData()
  → fetch('/initial-data.json')
  → transform JSON → {songIds, songInfo, totalCount}
       │
       ▼
  render.ts: renderSongInfo(...)
  
  // Meanwhile, start loading full DB in background:
  setTimeout(() => loadDatabase(), 100);
```

---

## 5. Verification

After implementation, verify:

1. **Initial data loads**: Open the page → first 20 songs render immediately from `initial-data.json` without WASM loading
2. **DB loads in background**: After initial render, the WASM DB loads silently. Check console for the sqlite3 initialization log
3. **Search by title works**: Type a title → click Search → correct results returned
   - Test English title: "ALBIDA"
   - Test Japanese title: "凛として" (partial Japanese match via LIKE)
4. **Search by artist works**: Type "Laur" → songs by Laur appear
5. **Search by effector works**: Type "MAD CHILD" → songs effected by MAD CHILD appear
6. **Filter by difficulty**: Select "Maximum" → only songs with MXM charts shown (but all charts visible, non-matching greyed out — grey-out is Sub-Task 5)
7. **Filter by level**: Select "20" → only songs with level 20 charts shown
8. **Filter by source version**: Select "BOOTH" → only BOOTH-era songs shown
9. **Filter by unlock source**: Select "Blaster Gate" → only blaster gate songs shown
10. **Sort by title**: Songs ordered English-first alphabetically, then Japanese by katakana
11. **Sort by release date (asc)**: Oldest songs first
12. **Sort by BPM (desc)**: Highest BPM songs first
13. **Sort direction toggle**: Clicking ▲/▼ reverses the sort order
14. **Pagination**: Navigate pages, "Showing X to Y of Z" updates correctly
15. **Combined search + filter**: Title="ALBIDA" + Difficulty="Exhaust" → narrows results correctly
16. **TypeScript compiles**: `npx tsc --noEmit` → no errors
17. **Empty results**: Search for nonsense → "No songs found" message (or empty state)

---

## 6. Notes for Implementation

- **Do NOT modify `index.html`** — the DOM element IDs are already set up from Sub-Task 2
- **`main.ts` stays minimal** — just a console.log for now. Full wiring happens in Sub-Task 4
- **Export all public functions** from `db.ts` and all constants from `constants.ts` so Sub-Tasks 4 and 5 can import them
- **The `@sqlite.org/sqlite-wasm` package has no TypeScript types** — use `any` for the sqlite3 module and DB objects, or add minimal type declarations
- **FTS5 `MATCH` queries fail on empty strings** — always check that the search term is non-empty before adding a MATCH clause
- **The `bind` parameter to `db.exec()` can be an object with `$`-prefixed keys** (named parameters) or an array (positional). We use named parameters for the query builder and positional arrays for `getSongInfo`
