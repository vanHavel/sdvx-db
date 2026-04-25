# Sub-Task 2: Project Scaffold — Detailed Plan

## Overview

Set up the Vite + TypeScript web project with the WASM SQLite library, mirroring the iidx-db structure but adapted for SDVX-DB.

Reference: [iidx-db/web/](../iidx-db/web/)

---

## Deliverables

| File | Description |
|---|---|
| `web/package.json` | Project config with dependencies |
| `web/tsconfig.json` | TypeScript configuration |
| `web/vite.config.ts` | Vite config with COOP/COEP headers, WASM support, image preloading |
| `web/index.html` | HTML skeleton with search/filter UI structure |
| `web/src/main.ts` | Application entry point (empty/minimal) |
| `web/src/db.ts` | Database module (empty exports/stubs) |
| `web/src/model.ts` | Type definitions (empty exports/stubs) |
| `web/src/render.ts` | Rendering module (empty exports/stubs) |
| `web/src/radar.ts` | Radar chart module (empty exports/stubs) |
| `web/src/constants.ts` | Constants and mappings (empty exports/stubs) |
| `web/src/main.css` | Stylesheet (minimal reset only) |

---

## 1. Package Configuration (`web/package.json`)

```json
{
  "name": "sdvx-db",
  "version": "1.0.0",
  "description": "SDVX Chart Database",
  "type": "module",
  "scripts": {
    "dev": "python3 ../python/create_sqlite_db.py && npx vite",
    "build": "python3 ../python/create_sqlite_db.py && npx vite build",
    "serve": "npx vite preview",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@sqlite.org/sqlite-wasm": "^3.50.1-build1"
  },
  "devDependencies": {
    "vite": "^6.3.5",
    "typescript": "^5.8.0"
  }
}
```

**Key differences from iidx-db:**
- No Bootstrap dependency — we use vanilla CSS
- Added TypeScript as a dev dependency
- `type: "module"` for ESM support
- `src/` subdirectory for source files

---

## 2. TypeScript Configuration (`web/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts"]
}
```

---

## 3. Vite Configuration (`web/vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function buildPreloadTags(): string {
  try {
    const initialDataPath = path.resolve(__dirname, 'public', 'initial-data.json');
    if (!fs.existsSync(initialDataPath)) return '';
    const data = JSON.parse(fs.readFileSync(initialDataPath, 'utf-8'));

    // Collect unique image filenames from initial data songs
    const imageFiles = new Set<string>();
    for (const song of Object.values(data.songs || {})) {
      const s = song as any;
      if (s.musicPackName) {
        // Pack image: derive filename from pack name
        const slug = s.musicPackName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        imageFiles.add(`pack_${slug}.webp`);
      } else {
        // Version image
        const versionNames: Record<number, string> = {
          0: 'booth', 1: 'infinite_infection', 2: 'gravity_wars',
          3: 'heavenly_haven', 4: 'vivid_wave', 5: 'exceed_gear'
        };
        const vname = versionNames[s.sourceVersion] || 'unknown';
        imageFiles.add(`version_${vname}.webp`);
      }
    }

    return Array.from(imageFiles)
      .map(f => `    <link rel="preload" as="image" href="/img/${f}" />`)
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
        const insertPos = html.toLowerCase().indexOf('</head>');
        if (insertPos === -1) return html;
        return html.slice(0, insertPos) + '\n' + tags + '\n' + html.slice(insertPos);
      }
    }
  ]
});
```

**Critical requirements from iidx-db:**
- `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` — **required** for `SharedArrayBuffer`, which the WASM SQLite library uses
- `optimizeDeps.exclude: ['@sqlite.org/sqlite-wasm']` — prevent Vite from pre-bundling the WASM module
- `assetsInclude: ['**/*.wasm']` — ensure WASM files are served correctly
- `target: 'esnext'` — needed for top-level await support
- Image preload plugin — injects `<link rel="preload">` tags for images used in the initial data page

---

## 4. HTML Skeleton (`web/index.html`)

The HTML provides the full page structure with the search/filter panel, results area, and pagination. All interactive elements get unique `id` attributes for JavaScript binding.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Search and filter all Sound Voltex charts by title, composer, effector, difficulty, level, and more." />
    <link rel="stylesheet" href="/src/main.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <script type="module" src="/src/main.ts"></script>
    <title>SDVX Chart Database</title>
  </head>
  <body>
    <div id="app">
      <!-- Header -->
      <header id="site-header">
        <h1>SDVX Chart Database</h1>
      </header>

      <!-- Search & Filter Panel -->
      <section id="search-panel">
        <form id="search-form" onsubmit="return false;">
          <!-- Row 1: Text search fields -->
          <div class="search-row">
            <div class="search-field">
              <label for="title">Title</label>
              <input type="text" id="title" placeholder="Search by title..." />
            </div>
            <div class="search-field">
              <label for="artist">Composer</label>
              <input type="text" id="artist" placeholder="Search by composer..." />
            </div>
            <div class="search-field">
              <label for="effector">Effector</label>
              <input type="text" id="effector" placeholder="Search by effector..." />
            </div>
          </div>

          <!-- Row 2: Filter dropdowns -->
          <div class="search-row">
            <div class="search-field">
              <label for="difficulty">Difficulty</label>
              <select id="difficulty">
                <option value="">All</option>
                <option value="0">Novice</option>
                <option value="1">Advanced</option>
                <option value="2">Exhaust</option>
                <option value="3">Infinite</option>
                <option value="4">Gravity</option>
                <option value="5">Heavenly</option>
                <option value="6">Vivid</option>
                <option value="7">Exceed</option>
                <option value="8">Maximum</option>
              </select>
            </div>
            <div class="search-field">
              <label for="level">Level</label>
              <select id="level">
                <option value="">All</option>
                <!-- Levels 1-20, generated values -->
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
                <option value="13">13</option>
                <option value="14">14</option>
                <option value="15">15</option>
                <option value="16">16</option>
                <option value="17">17</option>
                <option value="18">18</option>
                <option value="19">19</option>
                <option value="20">20</option>
              </select>
            </div>
            <div class="search-field">
              <label for="source-version">Version</label>
              <select id="source-version">
                <option value="">All</option>
                <option value="0">BOOTH</option>
                <option value="1">Infinite Infection</option>
                <option value="2">Gravity Wars</option>
                <option value="3">Heavenly Haven</option>
                <option value="4">Vivid Wave</option>
                <option value="5">Exceed Gear</option>
              </select>
            </div>
          </div>

          <!-- Row 3: Unlock source filter, sort, and search button -->
          <div class="search-row">
            <div class="search-field">
              <label for="unlock-source">Unlock</label>
              <select id="unlock-source">
                <option value="">All</option>
                <option value="default">Default</option>
                <option value="blaster_gate">Blaster Gate</option>
                <optgroup label="Song Packs">
                  <!-- Populated dynamically from constants or hardcoded -->
                  <!-- Will be filled in Sub-Task 4 -->
                </optgroup>
              </select>
            </div>
            <div class="search-field">
              <label for="order">Order By</label>
              <select id="order">
                <option value="title">Title</option>
                <option value="release_date">Release Date</option>
                <option value="bpm">BPM</option>
              </select>
            </div>
            <div class="search-field sort-direction-field">
              <button type="button" id="sort-direction" class="sort-toggle" title="Toggle sort direction" data-direction="asc">
                ▲
              </button>
              <button type="button" id="search" class="search-button">
                Search
              </button>
            </div>
          </div>
        </form>
      </section>

      <!-- Results -->
      <section id="results-section">
        <div id="results">
          <!-- Song rows will be rendered here by JavaScript -->
        </div>
      </section>

      <!-- Pagination -->
      <nav id="pagination" aria-label="Search results navigation">
        <button id="first-page" disabled>&#x276E;&#x276E;</button>
        <button id="prev-page" disabled>&#x276E;</button>
        <span id="page-info">
          Showing <span id="first-offset">1</span> to
          <span id="last-offset">20</span> of <span id="total-count">0</span>
        </span>
        <button id="next-page" disabled>&#x276F;</button>
        <button id="last-page" disabled>&#x276F;&#x276F;</button>
      </nav>

      <!-- Footer -->
      <footer id="site-footer">
        <span class="last-updated">Last updated: 2025-04-25</span>
        <a href="https://github.com/vanhavel/sdvx-db" target="_blank" rel="noopener" aria-label="GitHub repository">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38
            0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95
            0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68
            0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82
            2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51
            1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82
            1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01
            1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0
            8c0-4.42 3.58-8 8-8Z"></path>
          </svg>
        </a>
      </footer>
    </div>
  </body>
</html>
```

**Key design points:**
- `onsubmit="return false;"` prevents form submission/page reload
- All interactive elements have unique `id` attributes for JS binding
- The `<optgroup>` for song packs will be populated dynamically (Sub-Task 4) or hardcoded
- Sort direction toggle is a button that switches between ▲/▼
- Google Fonts (Inter) loaded via preconnect + stylesheet link
- Semantic HTML: `<header>`, `<section>`, `<nav>`, `<footer>`
- SEO: proper `<title>`, `<meta description>`, single `<h1>`

---

## 5. Source File Stubs (`web/src/`)

These files are created with minimal exports so the project compiles. They will be fully implemented in later sub-tasks.

### `web/src/main.ts`

```typescript
// Entry point — will be implemented in Sub-Task 4
console.log('SDVX-DB loaded');
```

### `web/src/model.ts`

```typescript
// Type definitions — will be implemented in Sub-Task 3

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
  unlock_source: string;
  music_pack_name?: string;
  novice?: Chart;
  advanced?: Chart;
  exhaust?: Chart;
  fourth?: Chart;
};
```

### `web/src/constants.ts`

```typescript
// Constants and mappings — will be fully implemented in Sub-Task 3
export const pageSize = 20;
```

### `web/src/db.ts`

```typescript
// Database module — will be implemented in Sub-Task 3
export async function loadDatabase(): Promise<any> {
  throw new Error('Not implemented');
}

export async function loadInitialData(): Promise<any> {
  throw new Error('Not implemented');
}
```

### `web/src/render.ts`

```typescript
// Rendering module — will be implemented in Sub-Task 5
```

### `web/src/radar.ts`

```typescript
// Radar chart rendering — will be implemented in Sub-Task 6
```

### `web/src/main.css`

```css
/* Minimal reset — full styling in Sub-Task 7 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

body {
  min-height: 100vh;
}
```

---

## 6. Directory Layout

After this sub-task, the `web/` directory should look like:

```
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── img/              (empty, populated by Sub-Tasks 1 & 8)
│   ├── db.sqlite3.gzipped (populated by Sub-Task 1)
│   └── initial-data.json  (populated by Sub-Task 1)
└── src/
    ├── main.ts
    ├── main.css
    ├── model.ts
    ├── constants.ts
    ├── db.ts
    ├── render.ts
    └── radar.ts
```

---

## 7. Verification

After setup, verify:

1. **`npm install` succeeds** — all dependencies install without errors
2. **`npx vite` starts** — dev server runs (will show the skeleton page even without data)
3. **COOP/COEP headers present** — check response headers in browser dev tools: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
4. **TypeScript compiles** — `npx tsc --noEmit` reports no errors
5. **HTML renders** — the skeleton page shows the search panel, empty results area, and pagination
6. **Google Fonts load** — Inter font is visible in the page

> **Note:** The `npm run dev` script will fail until Sub-Task 1 is complete (because it runs the Python ETL first). To test the scaffold in isolation, run `npx vite` directly instead.

---

## 8. Dependencies on Other Sub-Tasks

- **No dependencies** — this sub-task can run in parallel with Sub-Task 1 and Sub-Task 8
- Sub-Tasks 3–7 all depend on this scaffold being in place
- The `public/` directory will be populated by Sub-Task 1 (DB + initial data) and Sub-Task 8 (images)
