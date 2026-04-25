import { difficultyAbbreviations, difficultyColors, getImagePath } from './constants';
import type { QueryParams } from './db';
import type { Chart, Song } from './model';
import { drawRadar } from './radar';

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

  return songIds.map((songId) => renderSongRow(songId, songInfo[songId], searchParams)).join('');
}

export function drawAllRadars(songIds: number[], songInfo: Record<number, Song>): void {
  for (const songId of songIds) {
    const song = songInfo[songId];
    if (!song) continue;

    const slots: Array<[Chart | undefined, number]> = [
      [song.novice, 0],
      [song.advanced, 1],
      [song.exhaust, 2],
      [song.fourth, song.fourth?.difficultyCode ?? 8],
    ];

    for (const [chart, difficultyCode] of slots) {
      if (!chart) continue;

      const canvas = document.getElementById(
        `radar-${songId}-${difficultyCode}`,
      ) as HTMLCanvasElement | null;
      if (!canvas) continue;

      drawRadar(canvas, chart.radar, difficultyColors[difficultyCode] ?? '#eeeeee');
    }
  }
}

function renderSongRow(songId: number, song: Song | undefined, searchParams: QueryParams): string {
  if (!song) return '';

  const bpm =
    song.min_bpm === song.max_bpm
      ? `BPM ${formatBpm(song.min_bpm)}`
      : `BPM ${formatBpm(song.min_bpm)}-${formatBpm(song.max_bpm)}`;
  const imagePath = getImagePath(
    song.unlock_source_code,
    song.music_pack_name,
    song.source_version_code,
  );

  return `
    <div class="song-row" data-song-id="${songId}">
      <div class="song-info">
        <img class="song-image" src="${escapeAttribute(imagePath)}" alt="" loading="lazy" />
        <div class="song-meta">
          <span class="song-title">${escapeHtml(song.title)}</span>
          <span class="song-artist">${escapeHtml(song.artist)}</span>
          <span class="song-details">
            <span class="song-bpm">${escapeHtml(bpm)}</span>
            <span class="song-version">${escapeHtml(song.source_version)}</span>
          </span>
        </div>
      </div>
      <div class="chart-cells">
        ${renderChartCell(songId, song.novice, 0, searchParams)}
        ${renderChartCell(songId, song.advanced, 1, searchParams)}
        ${renderChartCell(songId, song.exhaust, 2, searchParams)}
        ${renderFourthChartCell(songId, song.fourth, searchParams)}
      </div>
    </div>
  `;
}

function renderChartCell(
  songId: number,
  chart: Chart | undefined,
  difficultyCode: number,
  searchParams: QueryParams,
): string {
  if (!chart) {
    return renderEmptyChartCell();
  }

  return renderPopulatedChartCell(songId, chart, difficultyCode, searchParams);
}

function renderFourthChartCell(
  songId: number,
  chart: Chart | undefined,
  searchParams: QueryParams,
): string {
  if (!chart || chart.difficultyCode === undefined) {
    return renderEmptyChartCell();
  }

  return renderPopulatedChartCell(songId, chart, chart.difficultyCode, searchParams);
}

function renderPopulatedChartCell(
  songId: number,
  chart: Chart,
  difficultyCode: number,
  searchParams: QueryParams,
): string {
  const isSelected = isChartSelected(chart, difficultyCode, searchParams);
  const difficultyClass = difficultyClasses[difficultyCode] ?? '';
  const abbreviation = difficultyAbbreviations[difficultyCode] ?? chart.difficulty;

  return `
    <div class="chart-cell ${difficultyClass} selected-${isSelected}">
      <span class="chart-diff-label">${escapeHtml(abbreviation)}</span>
      <span class="chart-level">${chart.level}</span>
      <span class="chart-effector" title="${escapeAttribute(chart.effected_by)}">${escapeHtml(chart.effected_by)}</span>
      <span class="chart-exscore">EX ${formatExScore(chart.max_ex_score)}</span>
      <canvas class="chart-radar" id="radar-${songId}-${difficultyCode}" width="160" height="160"></canvas>
    </div>
  `;
}

function renderEmptyChartCell(): string {
  return '<div class="chart-cell chart-cell-empty"><span class="chart-diff-label">&mdash;</span></div>';
}

function isChartSelected(chart: Chart, difficultyCode: number, searchParams: QueryParams): boolean {
  if (searchParams.difficulty === undefined && searchParams.level === undefined) {
    return true;
  }

  if (searchParams.difficulty !== undefined && difficultyCode !== searchParams.difficulty) {
    return false;
  }

  if (searchParams.level !== undefined && chart.level !== searchParams.level) {
    return false;
  }

  return true;
}

function formatBpm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatExScore(value: number): string {
  return value.toLocaleString('en-US');
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
