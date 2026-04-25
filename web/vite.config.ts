import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

type InitialDataSong = {
  musicPackName?: string;
  music_pack_name?: string;
  sourceVersion?: number;
  source_version?: number;
};

function slugifyPackName(packName: string): string {
  return packName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildPreloadTags(): string {
  try {
    const initialDataPath = path.resolve(__dirname, 'public', 'initial-data.json');
    if (!fs.existsSync(initialDataPath)) return '';

    const data = JSON.parse(fs.readFileSync(initialDataPath, 'utf-8'));
    const imageFiles = new Set<string>();
    const versionNames: Record<number, string> = {
      0: 'booth',
      1: 'infinite_infection',
      2: 'gravity_wars',
      3: 'heavenly_haven',
      4: 'vivid_wave',
      5: 'exceed_gear',
    };

    for (const song of Object.values(data.songs || {}) as InitialDataSong[]) {
      const packName = song.musicPackName ?? song.music_pack_name;
      if (packName) {
        imageFiles.add(`pack_${slugifyPackName(packName)}.webp`);
        continue;
      }

      const sourceVersion = song.sourceVersion ?? song.source_version;
      imageFiles.add(`version_${versionNames[sourceVersion ?? -1] ?? 'unknown'}.webp`);
    }

    return Array.from(imageFiles)
      .sort()
      .map((fileName) => `    <link rel="preload" as="image" href="/img/${fileName}" />`)
      .join('\n');
  } catch {
    return '';
  }
}

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  plugins: [
    {
      name: 'inject-initial-image-preloads',
      transformIndexHtml(html) {
        const tags = buildPreloadTags();
        if (!tags) return html;

        const insertPosition = html.toLowerCase().indexOf('</head>');
        if (insertPosition === -1) return html;

        return `${html.slice(0, insertPosition)}\n${tags}\n${html.slice(insertPosition)}`;
      },
    },
  ],
});
