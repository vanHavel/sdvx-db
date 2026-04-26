import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { buildBindParams, buildQuery } from './db-query';
import { createInitialSongInfo, createSongMap } from './db-mappers';
import type { InitialData, SongRow } from './db-mappers';
import type { Song } from './model';

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

  return {
    songIds: data.songIds,
    songInfo: createInitialSongInfo(data.songs),
    totalCount: data.totalCount,
  };
}
