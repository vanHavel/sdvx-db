export type Radar = {
  notes: number;
  peak: number;
  tsumami: number;
  one_handed: number;
  hand_trip: number;
  tricky: number;
};

export type Chart = {
  difficulty: string;
  difficultyCode?: number;
  level: number;
  effected_by: string;
  max_ex_score: number;
  radar: Radar;
};

export type Song = {
  title: string;
  artist: string;
  min_bpm: number;
  max_bpm: number;
  release_date: string;
  source_version: string;
  source_version_code: number;
  unlock_source: string;
  unlock_source_code: number;
  music_pack_name?: string;
  novice?: Chart;
  advanced?: Chart;
  exhaust?: Chart;
  fourth?: Chart;
};
