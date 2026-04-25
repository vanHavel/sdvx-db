import gzip
import json
import os
import shutil
import sqlite3
import unicodedata
from pathlib import Path
from typing import Any


DIFFICULTY_MAP = {
    "novice": 0,
    "advanced": 1,
    "exhaust": 2,
    "infinite": 3,
    "gravity": 4,
    "heavenly": 5,
    "vivid": 6,
    "exceed": 7,
    "maximum": 8,
}

SOURCE_VERSION_MAP = {
    "booth": 0,
    "infinite_infection": 1,
    "gravity_wars": 2,
    "heavenly_haven": 3,
    "vivid_wave": 4,
    "exceed_gear": 5,
}

UNLOCK_SOURCE_MAP = {
    "default": 0,
    "music_pack": 1,
    "blaster_gate": 2,
}

PAGE_SIZE = 20


def compute_sort_key(title: str, yomigana: str | None) -> str:
    if not title:
        return "1"

    first_char = title[0]
    if first_char.isascii() and first_char.isalpha():
        return "0" + title.lower()

    if yomigana:
        normalized = unicodedata.normalize("NFKC", yomigana)
        return "1" + normalized.lower()

    return "1" + title.lower()


def get_effectors_for_fts(charts: list[dict[str, Any]]) -> str:
    unique_effectors = []
    seen = set()
    for chart in charts:
        effector = chart["effected_by"]
        if effector not in seen:
            seen.add(effector)
            unique_effectors.append(effector)
    return " ".join(unique_effectors)


def load_songs(jsonl_path: Path) -> list[dict[str, Any]]:
    songs = []
    with jsonl_path.open(encoding="utf-8") as data_file:
        for line_number, line in enumerate(data_file, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                songs.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc
    return songs


def insert_song(cursor: sqlite3.Cursor, song_data: dict[str, Any]) -> int:
    title = song_data["title"]
    title_yomigana = song_data.get("string_slots", {}).get("0x498")
    sort_key = compute_sort_key(title, title_yomigana)
    source_version = SOURCE_VERSION_MAP.get(song_data.get("source_version"), -1)
    unlock_source_name = song_data["unlock_source"]

    if unlock_source_name not in UNLOCK_SOURCE_MAP:
        raise ValueError(f"Unknown unlock source {unlock_source_name!r} for song {title!r}")

    cursor.execute(
        """
        INSERT INTO song (
          title, title_yomigana, sort_key, artist, min_bpm, max_bpm,
          release_date, source_version, unlock_source, music_pack_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            title,
            title_yomigana,
            sort_key,
            song_data["artist"],
            song_data["bpm_min"],
            song_data["bpm_max"],
            song_data["release_date"],
            source_version,
            UNLOCK_SOURCE_MAP[unlock_source_name],
            song_data.get("music_pack_name"),
        ),
    )
    return cursor.lastrowid


def insert_charts(cursor: sqlite3.Cursor, song_id: int, song_data: dict[str, Any]) -> None:
    for chart in song_data["charts"]:
        difficulty_name = chart["difficulty"]
        if difficulty_name not in DIFFICULTY_MAP:
            raise ValueError(f"Unknown difficulty {difficulty_name!r} for song {song_data['title']!r}")

        radar = chart["radar"]
        cursor.execute(
            """
            INSERT INTO chart (
              id_song, difficulty, level, effected_by, max_ex_score,
              radar_notes, radar_peak, radar_tsumami, radar_one_handed,
              radar_hand_trip, radar_tricky
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                song_id,
                DIFFICULTY_MAP[difficulty_name],
                chart["level"],
                chart["effected_by"],
                chart["max_ex_score"],
                radar["notes"],
                radar["peak"],
                radar["tsumami"],
                radar["one_handed"],
                radar["hand_trip"],
                radar["tricky"],
            ),
        )


def populate_database(cursor: sqlite3.Cursor, songs: list[dict[str, Any]]) -> None:
    cursor.execute("BEGIN TRANSACTION;")
    try:
        for song_data in songs:
            song_id = insert_song(cursor, song_data)
            insert_charts(cursor, song_id, song_data)
            cursor.execute(
                "INSERT INTO song_search (rowid, title, artist, effectors) VALUES (?, ?, ?, ?)",
                (
                    song_id,
                    song_data["title"],
                    song_data["artist"],
                    get_effectors_for_fts(song_data["charts"]),
                ),
            )
    except Exception:
        cursor.execute("ROLLBACK;")
        raise
    else:
        cursor.execute("END TRANSACTION;")


def generate_initial_data(cursor: sqlite3.Cursor, output_path: Path) -> None:
    cursor.execute("SELECT COUNT(*) FROM song")
    total_count = cursor.fetchone()[0]

    cursor.execute(
        """
        SELECT id
        FROM song
        ORDER BY sort_key
        LIMIT ?
        """,
        (PAGE_SIZE,),
    )
    song_ids = [row[0] for row in cursor.fetchall()]

    if not song_ids:
        initial_data = {"songIds": [], "songs": {}, "totalCount": total_count}
    else:
        placeholders = ",".join("?" * len(song_ids))
        cursor.execute(
            f"""
            SELECT s.id, s.title, s.artist, s.min_bpm, s.max_bpm,
                   s.release_date, s.source_version, s.unlock_source, s.music_pack_name,
                   c.difficulty, c.level, c.effected_by, c.max_ex_score,
                   c.radar_notes, c.radar_peak, c.radar_tsumami,
                   c.radar_one_handed, c.radar_hand_trip, c.radar_tricky
            FROM song s
            JOIN chart c ON s.id = c.id_song
            WHERE s.id IN ({placeholders})
            ORDER BY s.sort_key, c.difficulty
            """,
            song_ids,
        )

        songs = {}
        for row in cursor.fetchall():
            (
                song_id,
                title,
                artist,
                min_bpm,
                max_bpm,
                release_date,
                source_version,
                unlock_source,
                music_pack_name,
                difficulty,
                level,
                effected_by,
                max_ex_score,
                radar_notes,
                radar_peak,
                radar_tsumami,
                radar_one_handed,
                radar_hand_trip,
                radar_tricky,
            ) = row

            song_key = str(song_id)
            if song_key not in songs:
                songs[song_key] = {
                    "title": title,
                    "artist": artist,
                    "minBpm": min_bpm,
                    "maxBpm": max_bpm,
                    "releaseDate": release_date,
                    "sourceVersion": source_version,
                    "unlockSource": unlock_source,
                    "musicPackName": music_pack_name,
                    "charts": [],
                }

            songs[song_key]["charts"].append(
                {
                    "difficulty": difficulty,
                    "level": level,
                    "effectedBy": effected_by,
                    "maxExScore": max_ex_score,
                    "radar": {
                        "notes": radar_notes,
                        "peak": radar_peak,
                        "tsumami": radar_tsumami,
                        "oneHanded": radar_one_handed,
                        "handTrip": radar_hand_trip,
                        "tricky": radar_tricky,
                    },
                }
            )

        initial_data = {"songIds": song_ids, "songs": songs, "totalCount": total_count}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as json_file:
        json.dump(initial_data, json_file, ensure_ascii=False, separators=(",", ":"))


def gzip_database(db_path: Path, gzip_path: Path) -> None:
    gzip_path.parent.mkdir(parents=True, exist_ok=True)
    with db_path.open("rb") as db_file:
        with gzip.open(gzip_path, "wb") as gzip_file:
            shutil.copyfileobj(db_file, gzip_file)


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    os.chdir(script_dir)

    db_path = script_dir / "data" / "db.sqlite3"
    ddl_path = script_dir / "sql" / "ddl.sql"
    jsonl_path = project_root / "raw_data" / "songs.jsonl"
    public_dir = project_root / "web" / "public"

    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    songs = load_songs(jsonl_path)

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.executescript(ddl_path.read_text(encoding="utf-8"))
        conn.commit()

        populate_database(cursor, songs)
        conn.commit()

        cursor.executescript("PRAGMA page_size = 1024; VACUUM;")
        conn.commit()

        generate_initial_data(cursor, public_dir / "initial-data.json")
    finally:
        conn.close()

    gzip_database(db_path, public_dir / "db.sqlite3.gzipped")


if __name__ == "__main__":
    main()
