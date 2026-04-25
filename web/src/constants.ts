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
  return `/img/version_${versionSlugs[sourceVersion] ?? 'unknown'}.webp`;
}

export const pageSize = 20;
