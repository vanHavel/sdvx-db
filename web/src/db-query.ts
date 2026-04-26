import { sortOrders } from './constants';
import type { QueryParams, SortConfig } from './db';

export function buildQuery(params: QueryParams, returnCount: boolean, sort?: SortConfig): string {
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
    } else if (hasFtsText(params.title)) {
      query += ` AND (s.title LIKE '%' || $titleLike || '%'
        OR s.id IN (
          SELECT rowid FROM song_search WHERE title MATCH $title
        ))`;
    } else {
      query += ` AND s.title LIKE '%' || $titleLike || '%'`;
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

export function buildBindParams(
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

function cleanFtsTerm(term: string): string {
  return term.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, ' ').trim();
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function hasFtsText(value: string | undefined): value is string {
  return hasText(value) && cleanFtsTerm(value).length > 0;
}

function isLettersOnly(text: string | undefined): boolean {
  if (!text) return false;
  return /^[a-z\s]+$/i.test(text);
}
