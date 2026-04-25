# Sub-Task 8: Song Image Collection — Detailed Plan

## Overview

Collect and prepare images to display alongside each song row. Two categories:
1. **Version logos** (6 images) — for songs with `unlock_source == "default"` or `"blaster_gate"`
2. **Song pack banners** (38 images) — for songs with `unlock_source == "music_pack"`

All images saved as small `.webp` files in `web/public/img/`.

---

## Deliverables

| File | Description |
|---|---|
| `python/collect_images.py` | Script to download and convert all images |
| `web/public/img/version_*.webp` | 6 version logo images |
| `web/public/img/pack_*.webp` | 38 song pack banner images |

---

## 1. Version Logos (RemyWiki)

The RemyWiki pages for each SDVX version have logo images. These are the direct image URLs:

| Version | RemyWiki Page | Image URL |
|---|---|---|
| BOOTH | https://remywiki.com/AC_SDVX | Find logo `<img>` on page |
| Infinite Infection | https://remywiki.com/AC_SDVX_II | Find logo `<img>` on page |
| Gravity Wars | https://remywiki.com/AC_SDVX_III | Find logo `<img>` on page |
| Heavenly Haven | https://remywiki.com/AC_SDVX_IV | Find logo `<img>` on page |
| Vivid Wave | https://remywiki.com/AC_SDVX_VW | Find logo `<img>` on page |
| Exceed Gear | https://remywiki.com/AC_SDVX_EG | Find logo `<img>` on page |

**Approach**: For each version page, fetch the HTML, parse it with `html.parser` or `re`, and find the first/main logo image. The logos are typically in an infobox or near the top of the article. Save the mapping as a hardcoded dict in the script (since there are only 6).

---

## 2. Song Pack Banners (Konami Mall)

### URL Pattern

Song pack thumbnail images are at:
```
https://p.eagate.573.jp/game/eacsdvx/coop_img/thumb_{shop_item_order}.jpg
```

Where `{shop_item_order}` is a sequential number like `1000001`, `1000002`, etc. This number does **not** directly correspond to the `I1010XXX` pack IDs in the JSONL data.

### Mapping Strategy

To map pack names → image URLs, scrape the Konami Mall listing page:

```
https://p.eagate.573.jp/gate/p/eamusement/coop/mall.html?dt=%2F%E3%82%B3%E3%83%8A%E3%82%B9%E3%83%86%20SOUND%20VOLTEX%2F&fromindex
```

This page lists all SDVX song packs as shop items. Each item has:
- A title/name (the pack name, e.g. "Music Pack vol.17")
- A thumbnail image (`<img>` tag with the `thumb_XXXXXXX.jpg` URL)

**Approach**:
1. Fetch the mall page HTML (may need to handle pagination via `fromindex` parameter)
2. Parse all item elements — extract the pack name text and the thumbnail `<img src="...">` URL
3. Match extracted pack names against our known 38 pack names from the JSONL data
4. Download each matched thumbnail image

```python
import urllib.request
from html.parser import HTMLParser

MALL_URL = 'https://p.eagate.573.jp/gate/p/eamusement/coop/mall.html?dt=%2F%E3%82%B3%E3%83%8A%E3%82%B9%E3%83%86%20SOUND%20VOLTEX%2F&fromindex={}'

# Paginate through the listings
all_items = []
for start_index in range(0, 100, 20):  # adjust as needed
    url = MALL_URL.format(start_index)
    html = fetch_page(url)
    items = parse_items(html)  # extract (name, image_url) tuples
    all_items.extend(items)
    if len(items) < 20:
        break

# Match against known pack names
KNOWN_PACKS = [
    "Music Pack vol.1", "Music Pack vol.2", ..., 
    "BEMANI Selection Music Pack vol.1", ...
]
```

### Output Filenames

Pack names are slugified for filenames:
```python
def slugify_pack_name(name: str) -> str:
    return name.lower().replace(' ', '_').replace('.', '_').replace('/', '_')
    # Then collapse multiple underscores, strip trailing
```

Examples:
- `Music Pack vol.17` → `pack_music_pack_vol_17.webp`
- `BEMANI Selection Music Pack vol.1` → `pack_bemani_selection_music_pack_vol_1.webp`
- `Touhou Project Selection Music Pack` → `pack_touhou_project_selection_music_pack.webp`

This must use the **same slugification** as `vite.config.ts` and `constants.ts` (`getImagePath`), which currently does:
```typescript
name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
```

So the Python equivalent is:
```python
import re
def slugify_pack_name(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower())
    return slug.strip('_')
```

---

## 3. Image Processing

All downloaded images must be converted to `.webp` and resized for consistency and small file size.

### Target Specs (matching iidx-db reference)

- **Format**: WebP (lossy)
- **Max width**: 400px (height proportional)
- **Quality**: 80
- **Target file size**: ≤15KB per image

### Implementation

Use Pillow (PIL) for image conversion:

```python
from PIL import Image
from io import BytesIO

def process_image(raw_bytes: bytes, output_path: str, max_width: int = 400) -> None:
    img = Image.open(BytesIO(raw_bytes))
    
    # Resize if wider than max
    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    
    # Convert to RGB if necessary (WebP doesn't support all modes)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGBA')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    img.save(output_path, 'WebP', quality=80)
```

### Dependencies

Add `Pillow` and `requests` to `python/pyproject.toml`:

```toml
[project]
name = "sdvx-db-tools"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["Pillow>=10.0", "requests>=2.28"]
```

---

## 4. Script Structure (`python/collect_images.py`)

```python
#!/usr/bin/env python3
"""Download and prepare images for SDVX-DB."""

import json
import os
import re
from pathlib import Path

import requests
from PIL import Image
from io import BytesIO


# --- Configuration ---

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "img"

VERSION_LOGO_URLS = {
    # Hardcoded from RemyWiki — fill in exact URLs
    'booth': 'https://remywiki.com/images/...',
    'infinite_infection': 'https://remywiki.com/images/...',
    'gravity_wars': 'https://remywiki.com/images/...',
    'heavenly_haven': 'https://remywiki.com/images/...',
    'vivid_wave': 'https://remywiki.com/images/...',
    'exceed_gear': 'https://remywiki.com/images/...',
}

MALL_BASE_URL = 'https://p.eagate.573.jp/gate/p/eamusement/coop/mall.html'
MALL_PARAMS = '?dt=%2F%E3%82%B3%E3%83%8A%E3%82%B9%E3%83%86%20SOUND%20VOLTEX%2F&fromindex={}'


# --- Helpers ---

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

def download_image(url: str) -> bytes:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content

def save_as_webp(raw: bytes, path: Path, max_width: int = 400) -> None:
    img = Image.open(BytesIO(raw))
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGB')
    img.save(path, 'WebP', quality=80)


# --- Version logos ---

def download_version_logos() -> None:
    for version, url in VERSION_LOGO_URLS.items():
        out = OUTPUT_DIR / f"version_{version}.webp"
        if out.exists():
            print(f"  Skip (exists): {out.name}")
            continue
        print(f"  Downloading: {version} -> {out.name}")
        raw = download_image(url)
        save_as_webp(raw, out)


# --- Song pack banners ---

def scrape_mall_pack_mapping() -> dict[str, str]:
    """Scrape Konami Mall to get {pack_name: image_url} mapping."""
    # Fetch and parse the mall page(s)
    # Extract items: pack name + thumbnail URL
    # Return the mapping
    ...

def get_known_pack_names() -> set[str]:
    """Read all unique music_pack_name values from songs.jsonl."""
    names = set()
    jsonl = Path(__file__).resolve().parent.parent / "raw_data" / "songs.jsonl"
    with jsonl.open() as f:
        for line in f:
            d = json.loads(line.strip())
            if d.get("music_pack_name"):
                names.add(d["music_pack_name"])
    return names

def download_pack_banners() -> None:
    known_packs = get_known_pack_names()
    mall_mapping = scrape_mall_pack_mapping()
    
    for pack_name in sorted(known_packs):
        slug = slugify(pack_name)
        out = OUTPUT_DIR / f"pack_{slug}.webp"
        if out.exists():
            print(f"  Skip (exists): {out.name}")
            continue
        
        image_url = mall_mapping.get(pack_name)
        if not image_url:
            print(f"  WARNING: No image found for pack: {pack_name}")
            continue
        
        print(f"  Downloading: {pack_name} -> {out.name}")
        raw = download_image(image_url)
        save_as_webp(raw, out)


# --- Main ---

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Downloading version logos...")
    download_version_logos()
    
    print("Downloading song pack banners...")
    download_pack_banners()
    
    # Print summary
    webp_files = list(OUTPUT_DIR.glob("*.webp"))
    total_size = sum(f.stat().st_size for f in webp_files)
    print(f"\nDone: {len(webp_files)} images, {total_size / 1024:.0f}KB total")

if __name__ == "__main__":
    main()
```

---

## 5. Mall Page Scraping Detail

The Konami Mall page at the given URL lists SDVX items. The page may require pagination (`fromindex=0`, `fromindex=20`, etc.). Each item element on the page contains:

- The item name (pack name like "Music Pack vol.17")
- A thumbnail image with src like `https://p.eagate.573.jp/game/eacsdvx/coop_img/thumb_1000001.jpg`

**Parser approach**: Use Python's `html.parser.HTMLParser` or `re` to extract `<img>` tags and nearby text content from each item block. The exact DOM structure will need to be discovered by fetching the page and inspecting the HTML. The script should:

1. Fetch each page of the mall listing
2. Find all item containers (likely `<div>` or `<li>` elements with a consistent class)
3. For each item: extract the name text and `<img src="...">` URL
4. Build the `{pack_name: image_url}` mapping
5. Match against our known 38 pack names

**Fallback**: If the mall page requires authentication or the scraping is unreliable, hardcode the mapping of pack names to thumbnail URLs. Since there are only 38 packs and the URLs are predictable (`thumb_1000001.jpg` through `thumb_10000XX.jpg`), we can manually map them if needed.

---

## 6. Verification

1. **All 6 version logos exist**: `ls web/public/img/version_*.webp` → 6 files
2. **All 38 pack banners exist**: `ls web/public/img/pack_*.webp` → 38 files
3. **File sizes are reasonable**: Each ≤15KB, total ≤750KB
4. **Filenames match constants.ts**: The `getImagePath()` function in `constants.ts` generates filenames using the same `slugify` logic. Verify a few:
   - `Music Pack vol.17` → `pack_music_pack_vol_17.webp`
   - `BEMANI Selection Music Pack vol.1` → `pack_bemani_selection_music_pack_vol_1.webp`
5. **Images render in the browser**: Open a few `.webp` files to confirm they display correctly
6. **No missing images**: Cross-check the set of pack names in the JSONL data against the downloaded image files

---

## 7. Edge Cases

- **Mall page pagination**: The listing may span multiple pages. Iterate with increasing `fromindex` until no more items.
- **Pack name matching**: The pack names on the Konami Mall page may differ slightly from the JSONL data (e.g. different whitespace, full-width vs half-width characters). Normalize both sides before matching.
- **Missing packs**: Some packs may not be listed on the mall page anymore (discontinued). Log warnings for these and optionally use a placeholder or the version logo as fallback.
- **MÚSECA pack name**: Contains a special character (Ú). Ensure UTF-8 encoding is handled correctly in both scraping and slugification.
- **Rate limiting**: Add a small delay between downloads (`time.sleep(0.5)`) to avoid hitting Konami servers too hard.
