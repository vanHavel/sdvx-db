import { getSongIds, getSongInfo, loadDatabase, loadInitialData } from './db';
import type { QueryParams, SortConfig } from './db';
import { musicPackNames, pageSize } from './constants';
import { drawAllRadars, renderSongInfo } from './render';

let page = 1;
let maxPage = 1;
let searchParams: QueryParams = {};
let currentSort: SortConfig = { field: 'title', direction: 'asc' };

function getTextInputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value.trim();
}

function getSelectValue(id: string): string {
  return (document.getElementById(id) as HTMLSelectElement).value;
}

function getQueryParams(): QueryParams {
  const params: QueryParams = {};

  const title = getTextInputValue('title');
  if (title) params.title = title;

  const artist = getTextInputValue('artist');
  if (artist) params.artist = artist;

  const effector = getTextInputValue('effector');
  if (effector) params.effector = effector;

  const difficulty = getSelectValue('difficulty');
  if (difficulty) params.difficulty = Number(difficulty);

  const level = getSelectValue('level');
  if (level) params.level = Number(level);

  const sourceVersion = getSelectValue('source-version');
  if (sourceVersion) params.sourceVersion = Number(sourceVersion);

  const unlockSource = getSelectValue('unlock-source');
  if (unlockSource === 'default') {
    params.unlockSource = 0;
  } else if (unlockSource === 'blaster_gate') {
    params.unlockSource = 2;
  } else if (unlockSource) {
    params.unlockSource = 1;
    params.musicPackName = unlockSource;
  }

  return params;
}

function getSortConfig(): SortConfig {
  const field = getSelectValue('order');
  const directionButton = document.getElementById('sort-direction') as HTMLButtonElement;
  const direction = directionButton.dataset.direction === 'desc' ? 'desc' : 'asc';
  return { field, direction };
}

function isInitialView(): boolean {
  return (
    Object.keys(searchParams).length === 0 &&
    currentSort.field === 'title' &&
    currentSort.direction === 'asc' &&
    page === 1
  );
}

async function search(): Promise<void> {
  const results = document.getElementById('results');
  if (!results) return;

  results.innerHTML = '<div class="loading">Loading</div>';

  try {
    if (isInitialView()) {
      const { songIds, songInfo, totalCount } = await loadInitialData();
      maxPage = Math.max(Math.ceil(totalCount / pageSize), 1);
      results.innerHTML = renderSongInfo(songIds, songInfo, searchParams);
      drawAllRadars(songIds, songInfo);
      updateNav(page, pageSize, totalCount);
      window.setTimeout(() => {
        void loadDatabase().catch((error) => console.error('Failed to load database', error));
      }, 100);
      return;
    }

    const [songIds, totalCount] = await getSongIds(searchParams, currentSort, page, pageSize);
    maxPage = Math.max(Math.ceil(totalCount / pageSize), 1);
    const songInfo = await getSongInfo(songIds);
    results.innerHTML = renderSongInfo(songIds, songInfo, searchParams);
    drawAllRadars(songIds, songInfo);
    updateNav(page, pageSize, totalCount);
  } catch (error) {
    console.error(error);
    results.innerHTML = '<div class="no-results">Could not load results.</div>';
    maxPage = 1;
    updateNav(1, pageSize, 0);
  }
}

function updateNav(currentPage: number, currentPageSize: number, totalCount: number): void {
  const firstOffset = totalCount === 0 ? 0 : (currentPage - 1) * currentPageSize + 1;
  const lastOffset = Math.min(currentPage * currentPageSize, totalCount);

  document.getElementById('first-offset')!.textContent = String(firstOffset);
  document.getElementById('last-offset')!.textContent = String(lastOffset);
  document.getElementById('total-count')!.textContent = String(totalCount);

  const firstButton = document.getElementById('first-page') as HTMLButtonElement;
  const prevButton = document.getElementById('prev-page') as HTMLButtonElement;
  const nextButton = document.getElementById('next-page') as HTMLButtonElement;
  const lastButton = document.getElementById('last-page') as HTMLButtonElement;

  firstButton.disabled = currentPage <= 1;
  prevButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= maxPage;
  lastButton.disabled = currentPage >= maxPage;
}

function populatePackDropdown(): void {
  const select = document.getElementById('unlock-source') as HTMLSelectElement;
  const optgroup = select.querySelector('optgroup[label="Song Packs"]');
  if (!optgroup) return;

  optgroup.replaceChildren();
  for (const packName of musicPackNames) {
    const option = document.createElement('option');
    option.value = packName;
    option.textContent = packName;
    optgroup.appendChild(option);
  }
}

populatePackDropdown();

document.getElementById('search')!.addEventListener('click', async () => {
  page = 1;
  searchParams = getQueryParams();
  currentSort = getSortConfig();
  await search();
});

for (const fieldId of ['title', 'artist', 'effector']) {
  document.getElementById(fieldId)!.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      document.getElementById('search')!.click();
    }
  });
}

document.getElementById('sort-direction')!.addEventListener('click', () => {
  const button = document.getElementById('sort-direction') as HTMLButtonElement;
  const nextDirection = button.dataset.direction === 'asc' ? 'desc' : 'asc';
  button.dataset.direction = nextDirection;
  button.textContent = nextDirection === 'asc' ? '▲' : '▼';
  button.setAttribute(
    'aria-label',
    `Sort ${nextDirection === 'asc' ? 'ascending' : 'descending'}`,
  );
});

document.getElementById('first-page')!.addEventListener('click', async () => {
  page = 1;
  await search();
});

document.getElementById('prev-page')!.addEventListener('click', async () => {
  if (page > 1) {
    page -= 1;
    await search();
  }
});

document.getElementById('next-page')!.addEventListener('click', async () => {
  if (page < maxPage) {
    page += 1;
    await search();
  }
});

document.getElementById('last-page')!.addEventListener('click', async () => {
  page = maxPage;
  await search();
});

await search();
