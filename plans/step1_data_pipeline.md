# Sub-Task 1: Data Pipeline — Detailed Plan

## Overview

Read `raw_data/songs.jsonl` → create a SQLite database → produce `web/public/db.sqlite3.gzipped` and `web/public/initial-data.json`.

Reference implementation: [iidx-db/python/create_sqlite_db.py](../iidx-db/python/create_sqlite_db.py)

---

## Deliverables

| File | Description |
|---|---|
| `python/sql/ddl.sql` | Schema definition (tables, FTS, triggers, indices) |
| `python/create_sqlite_db.py` | ETL script: JSONL → SQLite → gzipped DB + initial JSON |
| `python/pyproject.toml` | Python project config (no external deps needed, stdlib only) |
| `web/public/db.sqlite3.gzipped` | Gzip-compressed SQLite database |
| `web/public/initial-data.json` | Pre-baked first page of results for instant load |

---

## 1. Schema Definition (`python/sql/ddl.sql`)

### `song` table

```sql
CREATE TABLE IF NOT EXISTS song (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  title_yomigana TEXT,            -- half-width katakana reading for sort
  sort_key TEXT NOT NULL,         -- computed: "0<lower_title>" for English, "1<yomigana>" for Japanese
  artist TEXT NOT NULL,
  min_bpm REAL NOT NULL,
  max_bpm REAL NOT NULL,
  release_date TEXT NOT NULL,     -- ISO-8601 "YYYY-MM-DD"
  source_version INTEGER NOT NULL,-- see enum below
  unlock_source INTEGER NOT NULL, -- 0=default, 1=music_pack, 2=blaster_gate
  music_pack_name TEXT            -- nullable, set when unlock_source=1
) STRICT;
```

### `chart` table

```sql
CREATE TABLE IF NOT EXISTS chart (
  id INTEGER PRIMARY KEY,
  id_song INTEGER NOT NULL,
  difficulty INTEGER NOT NULL,    -- 0=NOV,1=ADV,2=EXH,3=INF,4=GRV,5=HVN,6=VVD,7=XCD,8=MXM
  level INTEGER NOT NULL,         -- 1-20
  effected_by TEXT NOT NULL,
  max_ex_score INTEGER NOT NULL,
  radar_notes INTEGER NOT NULL,
  radar_peak INTEGER NOT NULL,
  radar_tsumami INTEGER NOT NULL,
  radar_one_handed INTEGER NOT NULL,
  radar_hand_trip INTEGER NOT NULL,
  radar_tricky INTEGER NOT NULL,
  FOREIGN KEY (id_song) REFERENCES song(id) ON DELETE CASCADE,
  UNIQUE (id_song, difficulty)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_chart_song ON chart (id_song);
```

### `song_search` FTS5 virtual table

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS song_search USING fts5(
  title,
  artist,
  effectors,           -- denormalized: all unique effector names, space-joined
  content='song',
  content_rowid='id'
);
```

Note: Because `effectors` is denormalized from the chart table, we cannot use a simple `AFTER INSERT ON song` trigger. Instead, we insert into `song_search` manually after all charts for a song have been inserted.

### Indices

```sql
CREATE INDEX IF NOT EXISTS idx_chart_difficulty ON chart (difficulty);
CREATE INDEX IF NOT EXISTS idx_chart_level ON chart (level);
CREATE INDEX IF NOT EXISTS idx_song_unlock ON song (unlock_source);
CREATE INDEX IF NOT EXISTS idx_song_version ON song (source_version);
CREATE INDEX IF NOT EXISTS idx_song_sort ON song (sort_key);
```

---

## 2. Enum Mappings

### Difficulty

| JSONL value | DB code |
|---|---|
| `"novice"` | 0 |
| `"advanced"` | 1 |
| `"exhaust"` | 2 |
| `"infinite"` | 3 |
| `"gravity"` | 4 |
| `"heavenly"` | 5 |
| `"vivid"` | 6 |
| `"exceed"` | 7 |
| `"maximum"` | 8 |

### Source Version

| JSONL value | DB code |
|---|---|
| `"booth"` | 0 |
| `"infinite_infection"` | 1 |
| `"gravity_wars"` | 2 |
| `"heavenly_haven"` | 3 |
| `"vivid_wave"` | 4 |
| `"exceed_gear"` | 5 |
| `None` / unknown | -1 |

### Unlock Source

| JSONL value | DB code |
|---|---|
| `"default"` | 0 |
| `"music_pack"` | 1 |
| `"blaster_gate"` | 2 |

---

## 3. ETL Script (`python/create_sqlite_db.py`)

### High-Level Flow

```
1. Read songs.jsonl line by line
2. For each song:
   a. Extract song-level fields
   b. Compute sort_key
   c. INSERT into song table
   d. For each chart in song["charts"]:
      - Map difficulty string → integer
      - INSERT into chart table
   e. Collect unique effector names
   f. INSERT into song_search (title, artist, effectors)
3. Compact DB (VACUUM with small page size)
4. Generate initial-data.json
5. Gzip compress the DB → web/public/db.sqlite3.gzipped
```

### Sort Key Computation

The `sort_key` determines display order: English-starting titles first (alphabetical), then everything else in katakana order.

```python
import unicodedata

def compute_sort_key(title: str, yomigana: str | None) -> str:
    if not title:
        return "1"
    first_char = title[0]
    # English letter → sort group 0, use lowercased title
    if first_char.isascii() and first_char.isalpha():
        return "0" + title.lower()
    # Everything else → sort group 1, use yomigana (converted to full-width for consistent ordering)
    if yomigana:
        # Convert half-width katakana to full-width for proper Unicode sort
        normalized = unicodedata.normalize('NFKC', yomigana)
        return "1" + normalized.lower()
    # Fallback if no yomigana
    return "1" + title.lower()
```

**Why NFKC normalization?** The yomigana in the data is half-width katakana (e.g. `ｱﾙﾋﾞﾀﾞ`). Converting to full-width (`アルビダ`) via NFKC gives proper Unicode sort order that matches standard Japanese kana ordering (ア < イ < ウ < ...).

**Titles starting with symbols/numbers** (42 songs, e.g. `#Fairy...`, `.59...`, `2 MINUTES...`): These don't start with an ASCII letter, so they'll fall into group 1 and be sorted by their yomigana alongside Japanese titles. This is acceptable behavior.

### Effector Denormalization for FTS

Effector names can contain FTS5-special characters: `"`, `*`, `(`, `)`, `[`, `]`, `:`. For the FTS `effectors` column, we store a space-separated list of unique effector names per song. FTS5 tokenizes on whitespace/punctuation, so searching for a substring of an effector name will work naturally.

```python
def get_effectors_for_fts(charts: list[dict]) -> str:
    unique_effectors = []
    seen = set()
    for chart in charts:
        eff = chart["effected_by"]
        if eff not in seen:
            seen.add(eff)
            unique_effectors.append(eff)
    return " ".join(unique_effectors)
```

### JSONL Field Extraction

For each line in `songs.jsonl`, extract:

```python
song_data = json.loads(line)

title = song_data["title"]
title_yomigana = song_data.get("string_slots", {}).get("0x498")
artist = song_data["artist"]
min_bpm = song_data["bpm_min"]   # float, store as REAL
max_bpm = song_data["bpm_max"]   # float, store as REAL
release_date = song_data["release_date"]  # "YYYY-MM-DD" string
source_version = VERSION_MAP.get(song_data.get("source_version"), -1)
unlock_source = UNLOCK_MAP[song_data["unlock_source"]]
music_pack_name = song_data.get("music_pack_name")  # None if not a music pack

sort_key = compute_sort_key(title, title_yomigana)

# For each chart in song_data["charts"]:
for chart in song_data["charts"]:
    difficulty = DIFFICULTY_MAP[chart["difficulty"]]
    level = chart["level"]
    effected_by = chart["effected_by"]
    max_ex_score = chart["max_ex_score"]
    radar = chart["radar"]
    # radar keys: notes, peak, tsumami, one_handed, hand_trip, tricky
```

### Transaction Strategy

Wrap all inserts in a single transaction for performance (same as iidx-db):

```python
cursor.execute("BEGIN TRANSACTION;")
# ... all inserts ...
cursor.execute("END TRANSACTION;")
conn.commit()
```

### DB Compaction

```python
cursor.executescript("PRAGMA page_size = 1024; VACUUM;")
```

This minimizes the DB file size before gzip compression.

---

## 4. Initial Data Generation (`initial-data.json`)

Pre-compute the first page of results (page 1, sorted by `sort_key`, 20 songs) with full chart data. This allows the frontend to render instantly without loading the WASM SQLite module.

### Structure

```json
{
  "songIds": [1, 5, 12, ...],
  "songs": {
    "1": {
      "title": "ALBIDA Powerless Mix",
      "artist": "無力P",
      "minBpm": 156.0,
      "maxBpm": 156.0,
      "releaseDate": "2012-01-18",
      "sourceVersion": 0,
      "unlockSource": 0,
      "musicPackName": "Music Pack vol.17",
      "charts": [
        {
          "difficulty": 0,
          "level": 5,
          "effectedBy": "BING-WANG-FX",
          "maxExScore": 1745,
          "radar": {
            "notes": 2300,
            "peak": 4500,
            "tsumami": 6500,
            "oneHanded": 1100,
            "handTrip": 100,
            "tricky": 0
          }
        }
      ]
    }
  },
  "totalCount": 1926
}
```

### Generation Logic

```python
def generate_initial_data(cursor):
    page_size = 20
    
    cursor.execute("SELECT COUNT(*) FROM song")
    total_count = cursor.fetchone()[0]

    cursor.execute("""
        SELECT id FROM song
        ORDER BY sort_key
        LIMIT ?
    """, (page_size,))
    song_ids = [row[0] for row in cursor.fetchall()]

    cursor.execute(f"""
        SELECT s.id, s.title, s.artist, s.min_bpm, s.max_bpm,
               s.release_date, s.source_version, s.unlock_source, s.music_pack_name,
               c.difficulty, c.level, c.effected_by, c.max_ex_score,
               c.radar_notes, c.radar_peak, c.radar_tsumami,
               c.radar_one_handed, c.radar_hand_trip, c.radar_tricky
        FROM song s
        JOIN chart c ON s.id = c.id_song
        WHERE s.id IN ({','.join('?' * len(song_ids))})
    """, song_ids)

    songs = {}
    for row in cursor.fetchall():
        song_id = row[0]
        if song_id not in songs:
            songs[song_id] = {
                'title': row[1],
                'artist': row[2],
                'minBpm': row[3],
                'maxBpm': row[4],
                'releaseDate': row[5],
                'sourceVersion': row[6],
                'unlockSource': row[7],
                'musicPackName': row[8],
                'charts': []
            }
        songs[song_id]['charts'].append({
            'difficulty': row[9],
            'level': row[10],
            'effectedBy': row[11],
            'maxExScore': row[12],
            'radar': {
                'notes': row[13],
                'peak': row[14],
                'tsumami': row[15],
                'oneHanded': row[16],
                'handTrip': row[17],
                'tricky': row[18]
            }
        })

    initial_data = {
        'songIds': song_ids,
        'songs': songs,
        'totalCount': total_count
    }

    with open('../web/public/initial-data.json', 'w') as f:
        json.dump(initial_data, f, separators=(',', ':'))
```

---

## 5. Gzip Compression

```python
import gzip
import shutil

with open(db_path, "rb") as db_file:
    with gzip.open("../web/public/db.sqlite3.gzipped", "wb") as gzip_file:
        shutil.copyfileobj(db_file, gzip_file)
```

---

## 6. Directory Structure

After running the script, the file layout should be:

```
sdvx-db/
├── python/
│   ├── create_sqlite_db.py
│   ├── pyproject.toml
│   ├── sql/
│   │   └── ddl.sql
│   └── data/              # gitignored
│       └── db.sqlite3
├── web/
│   └── public/
│       ├── db.sqlite3.gzipped
│       └── initial-data.json
└── raw_data/
    └── songs.jsonl
```

The `python/data/` directory and `web/public/db.sqlite3.gzipped` and `web/public/initial-data.json` should be added to `.gitignore`.

---

## 7. Verification

After the script runs successfully, verify:

1. **Row counts**: `SELECT COUNT(*) FROM song` → 1926; `SELECT COUNT(*) FROM chart` → should be ~7100+ (3-4 charts per song)
2. **Sort order spot check**: `SELECT title, sort_key FROM song ORDER BY sort_key LIMIT 5` → should show English titles first, alphabetically
3. **Sort order Japanese check**: `SELECT title, sort_key FROM song ORDER BY sort_key DESC LIMIT 5` → should show Japanese titles sorted by katakana
4. **FTS works**: `SELECT s.title FROM song s JOIN song_search ss ON s.id = ss.rowid WHERE ss.title MATCH 'ALBIDA'` → should return the song
5. **Effector FTS works**: `SELECT s.title FROM song s JOIN song_search ss ON s.id = ss.rowid WHERE ss.effectors MATCH 'MAD'` → should return songs with "MAD CHILD" etc.
6. **Difficulty mapping**: `SELECT DISTINCT difficulty FROM chart ORDER BY difficulty` → 0 through 8 (not all may be present)
7. **initial-data.json**: File exists, is valid JSON, contains 20 song IDs, each song has charts with radar data
8. **Gzipped DB**: File exists, decompresses successfully
9. **No data loss**: Spot-check a specific song (e.g. song_id=4 "凛として咲く花の如く...") and verify all chart data matches the JSONL source

---

## 8. Edge Cases to Handle

- **Songs with `source_version: null`**: Map to -1 (unknown)
- **Songs with only 1 chart** (3 tutorial songs): These are valid, just have fewer chart rows
- **BPM values are floats**: Store as REAL, not INTEGER (some songs have e.g. 159.5 BPM)
- **Effector names with FTS special chars**: `"`, `*`, `(`, `)`, `[`, `]`, `:` appear in effector names. These don't need escaping when stored in the FTS table since FTS5 tokenizes them as word boundaries. However, **search queries** from the frontend will need to strip/escape these characters before passing to `MATCH` (handled in Sub-Task 3).
- **Yomigana may be missing**: Unlikely but handle gracefully with fallback to title
