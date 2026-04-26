import {
  difficultyNames,
  fourthChartDifficulties,
  sourceVersionNames,
  unlockSourceNames,
} from './constants';
import type { Chart, Song } from './model';

export type SongRow = {
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

export type InitialData = {
  songIds: number[];
  songs: Record<string, InitialSong>;
  totalCount: number;
};

export function createSongMap(rows: SongRow[]): Record<number, Song> {
  const songs: Record<number, Song> = {};

  for (const row of rows) {
    if (!songs[row.id]) {
      songs[row.id] = createSongShell({
        title: row.title,
        artist: row.artist,
        minBpm: row.min_bpm,
        maxBpm: row.max_bpm,
        releaseDate: row.release_date,
        sourceVersion: row.source_version,
        unlockSource: row.unlock_source,
        musicPackName: row.music_pack_name,
      });
    }

    assignChart(songs[row.id], row.difficulty, createChart(row));
  }

  return songs;
}

export function createInitialSongInfo(songs: Record<string, InitialSong>): Record<number, Song> {
  const songInfo: Record<number, Song> = {};

  for (const [songId, song] of Object.entries(songs)) {
    const songObj = createSongShell(song);

    for (const chart of song.charts) {
      assignChart(songObj, chart.difficulty, createChart(chart));
    }

    songInfo[Number(songId)] = songObj;
  }

  return songInfo;
}

function createSongShell(song: Omit<InitialSong, 'charts'>): Song {
  return {
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
