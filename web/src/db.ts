import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
  difficultyNames,
  fourthChartDifficulties,
  sortOrders,
  sourceVersionNames,
  unlockSourceNames,
} from './constants';
import type { Chart, Song } from './model';

type SqliteDatabase = {
  pointer: number;
  checkRc: (rc: number) => void;
  exec: (options: {
    sql: string;
    bind?: Record<string, unknown> | unknown[];
    rowMode?: 'object';
    resultRows?: unknown[];
  }) => void;
};

type SongRow = {
  id: number;
  title: string;
  artist: string;
  min_bpm: number;
  max_bpm: number;
  release_date: string;
  source_version: number;
  unlock_source: number;
  music_pack_name: string | null;
  difficulty: number;
  level: number;
  effected_by: string;
  max_ex_score: number;
  radar_notes: number;
  radar_peak: number;
  radar_tsumami: number;
  radar_one_handed: number;
  radar_hand_trip: number;
  radar_tricky: number;
};

type InitialChart = {
  difficulty: number;
  level: number;
  effectedBy: string;
  maxExScore: number;
  radar: {
    notes: number;
    peak: number;
    tsumami: number;
    oneHanded: number;
    handTrip: number;
    tricky: number;
  };
};

type InitialSong = {
  title: string;
  artist: string;
  minBpm: number;
  maxBpm: number;
  releaseDate: string;
  sourceVersion: number;
  unlockSource: number;
  musicPackName: string | null;
  charts: InitialChart[];
};

type InitialData = {
  songIds: number[];
  songs: Record<string, InitialSong>;
  totalCount: number;
};

export interface QueryParams {
  title?: string;
  artist?: string;
  effector?: string;
  difficulty?: number;
  level?: number;
  unlockSource?: number;
  musicPackName?: string;
  sourceVersion?: number;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

let db: SqliteDatabase | null = null;

export async function loadDatabase(): Promise<SqliteDatabase> {
  if (db) return db;

  const sqlite3: any = await sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  });

  const res = await fetch('/db.sqlite3.gzipped');
  if (!res.ok) {
    throw new Error(`Failed to fetch database: ${res.status} ${res.statusText}`);
  }
  if (!res.body) {
    throw new Error('Database response did not include a readable body');
  }

  const ds = new DecompressionStream('gzip');
  const decompressedStream = res.body.pipeThrough(ds);
  const raw = new Uint8Array(await new Response(decompressedStream).arrayBuffer());

  const p = sqlite3.wasm.allocFromTypedArray(raw);
  const deserializeFlags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE;
  const database = new sqlite3.oo1.DB() as SqliteDatabase;
  const rc = sqlite3.capi.sqlite3_deserialize(
    database.pointer,
    'main',
    p,
    raw.byteLength,
    raw.byteLength,
    deserializeFlags,
  );
  database.checkRc(rc);
  db = database;
  return database;
}

function cleanFtsTerm(term: string): string {
  return term.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ').trim();
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function hasFtsText(value: string | undefined): value is string {
  return hasText(value) && cleanFtsTerm(value).length > 0;
}

function buildQuery(params: QueryParams, returnCount: boolean, sort?: SortConfig): string {
  let query = returnCount ? 'SELECT COUNT(DISTINCT s.id) AS countSongs' : 'SELECT DISTINCT s.id';

  query += `
    FROM song s`;

  const needsChartJoin = params.difficulty !== undefined || params.level !== undefined;
  if (needsChartJoin) {
    query += `
    JOIN chart c ON s.id = c.id_song`;
  }

  query += `
    WHERE 1=1`;

  if (hasText(params.title)) {
    if (isLettersOnly(params.title) && hasFtsText(params.title)) {
      query += ` AND s.id IN (
        SELECT rowid FROM song_search WHERE title MATCH $title
      )`;
    } else {
      if (hasFtsText(params.title)) {
        query += ` AND (s.title LIKE '%' || $titleLike || '%'
          OR s.id IN (
            SELECT rowid FROM song_search WHERE title MATCH $title
          ))`;
      } else {
        query += ` AND s.title LIKE '%' || $titleLike || '%'`;
      }
    }
  }
  if (hasFtsText(params.artist)) {
    query += ' AND s.id IN (SELECT rowid FROM song_search WHERE artist MATCH $artist)';
  }
  if (hasFtsText(params.effector)) {
    query += ' AND s.id IN (SELECT rowid FROM song_search WHERE effectors MATCH $effector)';
  }

  if (params.difficulty !== undefined) {
    query += ' AND c.difficulty = $difficulty';
  }
  if (params.level !== undefined) {
    query += ' AND c.level = $level';
  }
  if (params.unlockSource !== undefined) {
    query += ' AND s.unlock_source = $unlockSource';
  }
  if (params.musicPackName !== undefined) {
    query += ' AND s.music_pack_name = $musicPackName';
  }
  if (params.sourceVersion !== undefined) {
    query += ' AND s.source_version = $sourceVersion';
  }

  if (!returnCount) {
    const orderBy = sort ? (sortOrders[sort.field]?.[sort.direction] ?? 's.sort_key ASC') : 's.sort_key ASC';
    query += `
    ORDER BY ${orderBy}
    LIMIT $limit
    OFFSET $offset`;
  }

  return query;
}

function isLettersOnly(text: string | undefined): boolean {
  if (!text) return false;
  return /^[a-z\s]+$/i.test(text);
}

function buildBindParams(
  params: QueryParams,
  page: number,
  pageSize: number,
): Record<string, string | number> {
  const bind: Record<string, string | number> = {};

  if (hasText(params.title)) {
    if (!isLettersOnly(params.title)) {
      bind.$titleLike = params.title.trim();
    }
    if (hasFtsText(params.title)) {
      bind.$title = cleanFtsTerm(params.title);
    }
  }
  if (hasFtsText(params.artist)) {
    bind.$artist = cleanFtsTerm(params.artist);
  }
  if (hasFtsText(params.effector)) {
    bind.$effector = cleanFtsTerm(params.effector);
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

export async function getSongIds(
  params: QueryParams,
  sort: SortConfig,
  page: number,
  pageSize: number,
): Promise<[number[], number]> {
  const database = await loadDatabase();

  const query = buildQuery(params, false, sort);
  const bind = buildBindParams(params, page, pageSize);
  const resultRows: Array<{ id: number }> = [];
  database.exec({ sql: query, bind, rowMode: 'object', resultRows });

  const countQuery = buildQuery(params, true);
  const { $limit, $offset, ...countBind } = bind;
  void $limit;
  void $offset;
  const countRows: Array<{ countSongs: number }> = [];
  database.exec({ sql: countQuery, bind: countBind, rowMode: 'object', resultRows: countRows });

  return [resultRows.map((row) => row.id), countRows[0]?.countSongs ?? 0];
}

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
  const resultRows: SongRow[] = [];
  database.exec({ sql: query, bind: songIds, rowMode: 'object', resultRows });

  return createSongMap(resultRows);
}

function createChart(row: SongRow | InitialChart): Chart {
  const radar =
    'radar_notes' in row
      ? {
          notes: row.radar_notes,
          peak: row.radar_peak,
          tsumami: row.radar_tsumami,
          one_handed: row.radar_one_handed,
          hand_trip: row.radar_hand_trip,
          tricky: row.radar_tricky,
        }
      : {
          notes: row.radar.notes,
          peak: row.radar.peak,
          tsumami: row.radar.tsumami,
          one_handed: row.radar.oneHanded,
          hand_trip: row.radar.handTrip,
          tricky: row.radar.tricky,
        };

  const difficulty = row.difficulty;
  return {
    difficulty: difficultyNames[difficulty] ?? 'Unknown',
    difficultyCode: difficulty,
    level: row.level,
    effected_by: 'effected_by' in row ? row.effected_by : row.effectedBy,
    max_ex_score: 'max_ex_score' in row ? row.max_ex_score : row.maxExScore,
    radar,
  };
}

function assignChart(song: Song, difficulty: number, chart: Chart): void {
  if (difficulty === 0) song.novice = chart;
  else if (difficulty === 1) song.advanced = chart;
  else if (difficulty === 2) song.exhaust = chart;
  else if (fourthChartDifficulties.has(difficulty)) song.fourth = chart;
}

function createSongMap(rows: SongRow[]): Record<number, Song> {
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
        source_version_code: row.source_version,
        unlock_source: unlockSourceNames[row.unlock_source] ?? 'Unknown',
        unlock_source_code: row.unlock_source,
        music_pack_name: row.music_pack_name ?? undefined,
      };
    }

    assignChart(songs[row.id], row.difficulty, createChart(row));
  }

  return songs;
}

export async function loadInitialData(): Promise<{
  songIds: number[];
  songInfo: Record<number, Song>;
  totalCount: number;
}> {
  const response = await fetch('/initial-data.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch initial data: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as InitialData;

  const songInfo: Record<number, Song> = {};
  for (const [songId, song] of Object.entries(data.songs)) {
    const songObj: Song = {
      title: song.title,
      artist: song.artist,
      min_bpm: song.minBpm,
      max_bpm: song.maxBpm,
      release_date: song.releaseDate,
      source_version: sourceVersionNames[song.sourceVersion] ?? 'Unknown',
      source_version_code: song.sourceVersion,
      unlock_source: unlockSourceNames[song.unlockSource] ?? 'Unknown',
      unlock_source_code: song.unlockSource,
      music_pack_name: song.musicPackName ?? undefined,
    };

    for (const chart of song.charts) {
      assignChart(songObj, chart.difficulty, createChart(chart));
    }

    songInfo[Number(songId)] = songObj;
  }

  return {
    songIds: data.songIds,
    songInfo,
    totalCount: data.totalCount,
  };
}
