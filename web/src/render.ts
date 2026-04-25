import { difficultyAbbreviations, difficultyColors, getImagePath } from './constants';
import type { QueryParams } from './db';
import type { Chart, Song } from './model';

const chartSlots: Array<keyof Pick<Song, 'novice' | 'advanced' | 'exhaust' | 'fourth'>> = [
  'novice',
  'advanced',
  'exhaust',
  'fourth',
];

const difficultyClasses: Record<number, string> = {
  0: 'difficulty-nov',
  1: 'difficulty-adv',
  2: 'difficulty-exh',
  3: 'difficulty-inf',
  4: 'difficulty-grv',
  5: 'difficulty-hvn',
  6: 'difficulty-vvd',
  7: 'difficulty-xcd',
  8: 'difficulty-mxm',
};

export function renderSongInfo(
  songIds: number[],
  songInfo: Record<number, Song>,
  searchParams: QueryParams,
): string {
  if (!songIds.length) {
    return '<div class="no-results">No songs found.</div>';
  }

  return songIds.map((songId) => renderSongRow(songInfo[songId], searchParams)).join('');
}

function renderSongRow(song: Song | undefined, searchParams: QueryParams): string {
  if (!song) return '';

  const bpm =
    song.min_bpm === song.max_bpm ? formatNumber(song.min_bpm) : `${formatNumber(song.min_bpm)}-${formatNumber(song.max_bpm)}`;
  const imagePath = getImagePath(
    song.unlock_source_code,
    song.music_pack_name,
    song.source_version_code,
  );

  return `
    <article class="song-row">
      <div class="song-info">
        <img class="song-image" src="${escapeAttribute(imagePath)}" alt="" loading="lazy" />
        <div class="song-meta">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
          <div class="song-details">
            <span>BPM ${escapeHtml(bpm)}</span>
            <span>${escapeHtml(song.source_version)}</span>
            <span>${escapeHtml(song.music_pack_name ?? song.unlock_source)}</span>
          </div>
        </div>
      </div>
      <div class="chart-cells">
        ${chartSlots.map((slot) => renderChartCell(song[slot], searchParams)).join('')}
      </div>
    </article>
  `;
}

function renderChartCell(chart: Chart | undefined, searchParams: QueryParams): string {
  if (!chart || chart.difficultyCode === undefined) {
    return '<div class="chart-cell-empty" aria-label="No chart">-</div>';
  }

  const difficultyCode = chart.difficultyCode;
  const isSelected = isChartSelected(chart, searchParams);
  const difficultyClass = difficultyClasses[difficultyCode] ?? '';
  const difficultyColor = difficultyColors[difficultyCode] ?? '#eeeeee';
  const abbreviation = difficultyAbbreviations[difficultyCode] ?? chart.difficulty;

  return `
    <div class="chart-cell ${difficultyClass} selected-${isSelected}" style="--chart-color: ${escapeAttribute(difficultyColor)}">
      <div class="chart-difficulty">${escapeHtml(abbreviation)}</div>
      <div class="chart-level">Lv.${chart.level}</div>
      <div class="chart-effector" title="${escapeAttribute(chart.effected_by)}">
        ${escapeHtml(chart.effected_by)}
      </div>
      <div class="chart-score">EX ${chart.max_ex_score}</div>
    </div>
  `;
}

function isChartSelected(chart: Chart, searchParams: QueryParams): boolean {
  if (searchParams.difficulty !== undefined && chart.difficultyCode !== searchParams.difficulty) {
    return false;
  }
  if (searchParams.level !== undefined && chart.level !== searchParams.level) {
    return false;
  }
  return true;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
