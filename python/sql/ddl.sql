PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS song (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  title_yomigana TEXT,
  sort_key TEXT NOT NULL,
  artist TEXT NOT NULL,
  min_bpm REAL NOT NULL,
  max_bpm REAL NOT NULL,
  release_date TEXT NOT NULL,
  source_version INTEGER NOT NULL,
  unlock_source INTEGER NOT NULL,
  music_pack_name TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS chart (
  id INTEGER PRIMARY KEY,
  id_song INTEGER NOT NULL,
  difficulty INTEGER NOT NULL,
  level INTEGER NOT NULL,
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

CREATE VIRTUAL TABLE IF NOT EXISTS song_search USING fts5(
  title,
  artist,
  effectors,
  content=''
);

CREATE INDEX IF NOT EXISTS idx_chart_song ON chart (id_song);
CREATE INDEX IF NOT EXISTS idx_chart_difficulty ON chart (difficulty);
CREATE INDEX IF NOT EXISTS idx_chart_level ON chart (level);
CREATE INDEX IF NOT EXISTS idx_song_unlock ON song (unlock_source);
CREATE INDEX IF NOT EXISTS idx_song_version ON song (source_version);
CREATE INDEX IF NOT EXISTS idx_song_sort ON song (sort_key);
