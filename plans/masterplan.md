# SDVX-DB Master Plan (v2)

Build a searchable/filterable chart database website for **Sound Voltex (SDVX)**, closely modeled on the existing [iidx-db](../iidx-db/) codebase.

---

## Data Summary (from `raw_data/songs.jsonl`)

| Property | Value |
|---|---|
| Total songs | 1 926 |
| Charts per song | 3 or 4 (a few tutorial songs have 1); data structure supports 5 |
| Level range | 1 – 20 |
| Base difficulties | `novice`, `advanced`, `exhaust` |
| 4th-chart slot (special) | `infinite`, `gravity`, `heavenly`, `vivid`, `exceed` (version-specific names) |
| 5th-chart slot | `maximum` (cross-version, not "special") |
| Radar axes (per chart) | `notes`, `peak`, `tsumami`, `one_handed`, `hand_trip`, `tricky` |
| Unlock sources (song-level) | `default`, `music_pack`, `blaster_gate` |
| Music packs | 38 unique pack names |
| Source versions | `booth`, `infinite_infection`, `gravity_wars`, `heavenly_haven`, `vivid_wave`, `exceed_gear`, `unknown` |

### Chart Slot Structure

The underlying data has **5 chart slots** per song via `chart_states[5]`:

| Slot | Index | Content |
|---|---|---|
| 0 | NOV | Novice (base) |
| 1 | ADV | Advanced (base) |
| 2 | EXH | Exhaust (base) |
| 3 | Special | Infinite / Gravity / Heavenly / Vivid / Exceed (version-specific) |
| 4 | MXM | Maximum (cross-version) |

Currently **no song uses both slot 3 and slot 4** simultaneously. The UI will show **4 columns** (NOV / ADV / EXH / 4th) where the 4th column displays whichever of MXM or a special difficulty exists. Empty slots show "—".

---

## Architecture Overview

Follows the same proven pattern as iidx-db:

```
raw_data/songs.jsonl
        │
        ▼
  Python ETL script
        │
        ├──▶  public/db.sqlite3.gzipped   (full DB, fetched on-demand)
        └──▶  public/initial-data.json     (first page, instant load)
                    │
                    ▼
            Vite + TypeScript SPA
            ├── @sqlite.org/sqlite-wasm
            ├── Canvas (radar charts)
            └── Vanilla CSS (SDVX-themed dark design)
```

---

## Sub-Tasks

### Sub-Task 1 – Data Pipeline (Python)

**Goal:** Read `songs.jsonl` → populate a SQLite database → produce `db.sqlite3.gzipped` and `initial-data.json`.

#### Schema Design

**`song` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | auto |
| `title` | TEXT NOT NULL | `title` from JSONL |
| `title_yomigana` | TEXT | katakana reading (from `string_slots["0x498"]`) for Japanese sort |
| `artist` | TEXT NOT NULL | |
| `min_bpm` | REAL NOT NULL | |
| `max_bpm` | REAL NOT NULL | |
| `release_date` | TEXT NOT NULL | ISO-8601 date |
| `source_version` | INTEGER NOT NULL | enum-mapped (see below) |
| `unlock_source` | INTEGER NOT NULL | 0 = default, 1 = music_pack, 2 = blaster_gate |
| `music_pack_name` | TEXT | nullable, set when unlock_source = 1 |

**Source version mapping:**

| Code | Name | Display Name |
|---|---|---|
| 0 | booth | BOOTH |
| 1 | infinite_infection | Infinite Infection |
| 2 | gravity_wars | Gravity Wars |
| 3 | heavenly_haven | Heavenly Haven |
| 4 | vivid_wave | Vivid Wave |
| 5 | exceed_gear | Exceed Gear |
| -1 | unknown | Unknown |

**`chart` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | auto |
| `id_song` | INTEGER FK → song | |
| `difficulty` | INTEGER NOT NULL | 0–8 (see mapping below) |
| `level` | INTEGER NOT NULL | 1-20 |
| `effected_by` | TEXT NOT NULL | |
| `max_ex_score` | INTEGER NOT NULL | |
| `radar_notes` | INTEGER NOT NULL | |
| `radar_peak` | INTEGER NOT NULL | |
| `radar_tsumami` | INTEGER NOT NULL | |
| `radar_one_handed` | INTEGER NOT NULL | |
| `radar_hand_trip` | INTEGER NOT NULL | |
| `radar_tricky` | INTEGER NOT NULL | |
| UNIQUE | `(id_song, difficulty)` | |

**Difficulty mapping:**

| Code | Name | Slot | Category |
|---|---|---|---|
| 0 | novice | 0 | base |
| 1 | advanced | 1 | base |
| 2 | exhaust | 2 | base |
| 3 | infinite | 3 | special (version-specific) |
| 4 | gravity | 3 | special (version-specific) |
| 5 | heavenly | 3 | special (version-specific) |
| 6 | vivid | 3 | special (version-specific) |
| 7 | exceed | 3 | special (version-specific) |
| 8 | maximum | 4 | MXM (cross-version) |

**`song_search` FTS5 virtual table:**

Columns: `title`, `artist`, `effectors`

The `effectors` column is a denormalized concatenation of all unique effector names for the song (space-separated), enabling FTS search across any chart's effector without joins.

**`initial-data.json`:** First page of results (default sort = title), pre-baked so no WASM needed on first load. Includes all chart data (radar values, effectors, etc.) for those songs.

#### Title Sort Order

Songs are sorted with English-starting titles first (alphabetical), followed by Japanese-starting titles in katakana order. Implementation:
- Store `title_yomigana` (katakana reading) from the JSONL data
- Create a `sort_key` column: for titles starting with A-Z/a-z, prefix with `0` + lowercase title; for others, prefix with `1` + yomigana
- `ORDER BY sort_key` gives the desired ordering

#### Deliverables
- `python/create_sqlite_db.py` — reads JSONL, creates DB, generates artifacts
- `python/sql/ddl.sql` — schema
- `web/public/db.sqlite3.gzipped`
- `web/public/initial-data.json`

---

### Sub-Task 2 – Project Scaffold (Vite + TypeScript)

**Goal:** Set up the web project with Vite, TypeScript, and the WASM SQLite library.

- `web/package.json` with `@sqlite.org/sqlite-wasm`, `vite`, TypeScript
- `web/vite.config.ts` with COOP/COEP headers, WASM asset inclusion
- `web/tsconfig.json`
- `web/index.html` — skeleton with proper `<meta>`, `<title>SDVX Chart Database</title>`
- Directory structure: `web/src/{main.ts, db.ts, model.ts, render.ts, radar.ts, constants.ts}`

---

### Sub-Task 3 – Database Layer (`db.ts`, `model.ts`, `constants.ts`)

**Goal:** Port and adapt iidx-db's DB module for SDVX data.

#### `model.ts`
```typescript
type Radar = {
  notes: number; peak: number; tsumami: number;
  one_handed: number; hand_trip: number; tricky: number;
}

type Chart = {
  difficulty: string;   // "novice" | "advanced" | ... | "maximum"
  level: number;
  effected_by: string;
  max_ex_score: number;
  radar: Radar;
}

type Song = {
  title: string;
  artist: string;
  min_bpm: number;
  max_bpm: number;
  release_date: string;
  source_version: string;
  unlock_source: string;
  music_pack_name?: string;
  // Charts keyed by column position for fixed-column rendering:
  novice?: Chart;
  advanced?: Chart;
  exhaust?: Chart;
  fourth?: Chart;     // 4th chart: either MXM or a special (INF/GRV/HVN/VVD/XCD)
}
```

#### `constants.ts`
- Difficulty mappings (int ↔ name, difficulty → slot)
- Source version mappings (int ↔ display name)
- Unlock source mappings
- Sort-order SQL mappings
- `pageSize = 20`

#### `db.ts`
- `loadDatabase()` — fetch + decompress + deserialize (same as iidx-db)
- `loadInitialData()` — fetch `initial-data.json`, transform into `Song` objects
- `getSongIds(params, sort, page, pageSize)` — parameterized query builder
- `getSongInfo(songIds)` — fetch full song + chart data
- Query builder supporting:
  - FTS search on `title`, `artist`, `effectors` (denormalized in FTS table)
  - Filter on `difficulty`, `level`, `unlock_source` (with music pack names), `source_version`
  - Sort by `sort_key` (title), `release_date`, `min_bpm`/`max_bpm`
  - Sort direction toggle (ASC/DESC) via a separate boolean

---

### Sub-Task 4 – UI: Search & Filter Panel (`index.html`, `main.ts`)

**Goal:** Build the search/filter/sort controls.

#### Search Fields (text input, FTS)
- **Title** — searches `title` FTS column
- **Composer** — searches `artist` FTS column
- **Effector** — searches `effectors` FTS column (denormalized, matches any chart's effector)

#### Filter Fields (dropdowns)
- **Difficulty:** All / Novice / Advanced / Exhaust / Infinite / Gravity / Heavenly / Vivid / Exceed / Maximum
- **Level:** All / 1–20
- **Unlock Source:** All / Default / Blaster Gate / then all 38 music pack names as individual options (grouped under "Song Packs" via `<optgroup>`)
- **Source Version:** All / BOOTH / Infinite Infection / Gravity Wars / Heavenly Haven / Vivid Wave / Exceed Gear

#### Sort Controls
- **Order By** dropdown: Title / Release Date / BPM
- **Direction** toggle button: ▲ ascending / ▼ descending (separate from Order By)

#### Behavior
- Search button triggers query
- Enter in text fields triggers search
- Pagination controls (first / prev / next / last) + "Showing X to Y of Z"

---

### Sub-Task 5 – UI: Song Row & Chart Rendering (`render.ts`)

**Goal:** Render search results as a list of song rows.

#### Song Row Layout

Each song occupies one visual row/card with 4 fixed chart columns:

```
┌─────────────────────────────────────────────────────────────────┐
│ Song Info          │ NOV       │ ADV       │ EXH       │ 4th   │
│                    │           │           │           │       │
│ Title              │ Lv. 5     │ Lv. 10    │ Lv. 14    │ Lv.17 │
│ Artist             │ Eff: xxx  │ Eff: xxx  │ Eff: xxx  │ Eff:x │
│ BPM: 156           │ EX: 1745  │ EX: 2517  │ EX: 3402  │ EX:   │
│ Version: BOOTH     │ [radar]   │ [radar]   │ [radar]   │[radar]│
└─────────────────────────────────────────────────────────────────┘
```

**Song info column:**
- Title (bold)
- Artist / Composer (smaller, muted)
- BPM (single value or range)
- Source version label

**Each chart column (4 fixed positions: NOV / ADV / EXH / 4th):**
- Difficulty name label (color-coded, e.g. "GRV" for gravity)
- Level (bold)
- "Effected by" text
- Max EX Score
- Hexagonal radar chart (canvas)

**4th column:** Displays the difficulty label dynamically (e.g. "MXM", "GRV", "INF") based on whichever chart occupies the 4th slot for that song.

**Empty slots:** Show "—" or similar indicator when a chart doesn't exist for that slot.

**Greying out:** Charts not matching the current difficulty/level filter are rendered with reduced opacity (like iidx-db's `selected-false` class).

---

### Sub-Task 6 – Radar Chart Rendering (`radar.ts`)

**Goal:** Render hexagonal radar charts using HTML5 Canvas.

#### Specifications
- 6 axes, arranged as a regular hexagon
- Axes: Notes, Peak, Tsumami, One Hand, Hand Trip, Tricky
- Scale: 0–10 000 (max of the visual hexagon boundary)
- Values **can exceed 10k** — they extend beyond the hexagon boundary (visible as spikes)
- Each axis has a small label outside the hexagon
- Filled polygon with semi-transparent fill + solid stroke
- Color based on difficulty (matching the difficulty color scheme)
- Compact size (~80×80px per chart cell)
- Function signature: `drawRadar(canvas: HTMLCanvasElement, radar: Radar, color: string)`

---

### Sub-Task 7 – Styling & Visual Design (`main.css`)

**Goal:** Create a premium, SDVX-themed visual design using vanilla CSS.

#### Design Direction
- **Dark theme** as default (SDVX's aesthetic is neon-on-dark)
- Accent colors per difficulty (see table below)
- Modern typography (Google Fonts: Inter or similar)
- Card-based song rows with subtle borders/glow
- Smooth hover effects on rows
- Responsive layout (desktop-first, usable on tablet)
- Glassmorphism or subtle blur on the search panel
- Clean, minimal pagination controls

#### Color Scheme for Difficulties

| Difficulty | Abbrev | Color | Hex |
|---|---|---|---|
| Novice | NOV | Purple | `#7b48a8` |
| Advanced | ADV | Yellow | `#e8b831` |
| Exhaust | EXH | Red | `#c4314b` |
| Infinite | INF | Pink | `#d176b6` |
| Gravity | GRV | Orange | `#e58019` |
| Heavenly | HVN | Cyan | `#29aee6` |
| Vivid | VVD | Magenta | `#e64593` |
| Exceed | XCD | Green | `#1bb917` |
| Maximum | MXM | White/Silver | `#eeeeee` |

> **NOTE:** These colors are approximations of the in-game SDVX difficulty colors. We should verify and adjust during implementation.

---

## Dependency Graph

```
Sub-Task 1 (Data Pipeline) ──┐
                              ├──▶ Sub-Task 3 (DB Layer) ──┐
Sub-Task 2 (Scaffold)    ────┤                              ├──▶ Sub-Task 4 (Search UI) ──┐
                              │                              │                              │
                              ├──▶ Sub-Task 7 (Styling)  ──┤                              │
                              │                              │                              │
                              └──▶ Sub-Task 6 (Radar)    ──┘                              │
                                                                                           │
                                                              Sub-Task 5 (Song Rows) ◀────┘
```

**Suggested execution order:**
1. Sub-Task 1 (Data Pipeline) + Sub-Task 2 (Scaffold) — **parallel**
2. Sub-Task 3 (DB Layer) — depends on 1 + 2
3. Sub-Task 7 (Styling) + Sub-Task 6 (Radar Charts) — **parallel**, after scaffold exists
4. Sub-Task 4 (Search/Filter UI) — depends on 3 + 7
5. Sub-Task 5 (Song Row Rendering) — depends on all above

---

## Design Decisions (resolved)

1. **FTS for effector search**: Denormalize all effectors into a `song_search` FTS column (`effectors`), concatenating all unique effector names per song. This avoids complex joins during search.

2. **Sort by EX score**: Dropped from sort options. Sort options are: Title, Release Date, BPM.

3. **Title sorting**: English-first alphabetical, then Japanese in katakana order. Implemented via a computed `sort_key` column in the DB.

4. **Empty chart slots**: Show "—" or similar placeholder. All 5 columns always rendered.

5. **Song pack filter**: Single dropdown with options: Default / Blaster Gate / then all 38 music pack names grouped under an `<optgroup>` labeled "Song Packs".

6. **Source version**: Stored, displayed as a song attribute, and filterable via dropdown.

7. **Chart slot model**: 4 UI columns (NOV/ADV/EXH/4th). The 4th column shows either MXM or a version-specific special difficulty (INF/GRV/HVN/VVD/XCD), whichever exists. No song in the current data has both, so we don't need to handle that case.
