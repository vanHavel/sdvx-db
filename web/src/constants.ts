export const difficultyNames: Record<number, string> = {
  0: 'Novice',
  1: 'Advanced',
  2: 'Exhaust',
  3: 'Infinite',
  4: 'Gravity',
  5: 'Heavenly',
  6: 'Vivid',
  7: 'Exceed',
  8: 'Maximum',
};

export const difficultyAbbreviations: Record<number, string> = {
  0: 'NOV',
  1: 'ADV',
  2: 'EXH',
  3: 'INF',
  4: 'GRV',
  5: 'HVN',
  6: 'VVD',
  7: 'XCD',
  8: 'MXM',
};

export const difficultyColors: Record<number, string> = {
  0: '#7b48a8',
  1: '#e8b831',
  2: '#c4314b',
  3: '#d176b6',
  4: '#e58019',
  5: '#29aee6',
  6: '#e64593',
  7: '#1bb917',
  8: '#eeeeee',
};

export const fourthChartDifficulties = new Set([3, 4, 5, 6, 7, 8]);

export const sourceVersionNames: Record<number, string> = {
  0: 'BOOTH',
  1: 'Infinite Infection',
  2: 'Gravity Wars',
  3: 'Heavenly Haven',
  4: 'Vivid Wave',
  5: 'Exceed Gear',
  [-1]: 'Unknown',
};

export const unlockSourceNames: Record<number, string> = {
  0: 'Default',
  1: 'Song Pack',
  2: 'Blaster Gate',
};

export const sortOrders: Record<string, { asc: string; desc: string }> = {
  title: { asc: 's.sort_key ASC', desc: 's.sort_key DESC' },
  release_date: { asc: 's.release_date ASC', desc: 's.release_date DESC' },
  bpm: { asc: 's.min_bpm ASC', desc: 's.max_bpm DESC' },
};

export const musicPackNames = [
  '10th Anniversary Music Pack',
  'beatmania IIDX Selection Music Pack vol.1',
  'BEMANI Selection Music Pack vol.1',
  'BEMANI Selection Music Pack vol.2',
  'BEMANI Selection Music Pack vol.3',
  'COCONATSU Selection Music Pack',
  'jubeat Selection Music Pack vol.1',
  'MÚSECA Selection Music Pack vol.1',
  'MÚSECA Selection Music Pack vol.2',
  'Music Pack vol.1',
  'Music Pack vol.10',
  'Music Pack vol.11',
  'Music Pack vol.12',
  'Music Pack vol.13',
  'Music Pack vol.14',
  'Music Pack vol.15',
  'Music Pack vol.16',
  'Music Pack vol.17',
  'Music Pack vol.18',
  'Music Pack vol.19',
  'Music Pack vol.2',
  'Music Pack vol.20',
  'Music Pack vol.21',
  'Music Pack vol.22',
  'Music Pack vol.23',
  'Music Pack vol.24',
  'Music Pack vol.25',
  'Music Pack vol.26',
  'Music Pack vol.3',
  'Music Pack vol.4',
  'Music Pack vol.5',
  'Music Pack vol.6',
  'Music Pack vol.7',
  'Music Pack vol.8',
  'Music Pack vol.9',
  'REFLEC BEAT Selection Music Pack vol.1',
  'Start Up Selection Music Pack vol.1',
  'Touhou Project Selection Music Pack',
] as const;

export function getImagePath(
  unlockSource: number,
  musicPackName: string | null | undefined,
  sourceVersion: number,
): string {
  if (unlockSource === 1 && musicPackName) {
    const slug = musicPackName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `/img/pack_${slug}.webp`;
  }

  const versionSlugs: Record<number, string> = {
    0: 'booth',
    1: 'infinite_infection',
    2: 'gravity_wars',
    3: 'heavenly_haven',
    4: 'vivid_wave',
    5: 'exceed_gear',
  };
  return `/img/version_${versionSlugs[sourceVersion] ?? 'exceed_gear'}.webp`;
}

export const pageSize = 20;
