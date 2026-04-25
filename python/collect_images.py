#!/usr/bin/env python3
"""Download and prepare SDVX image assets for the web app."""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from html.parser import HTMLParser
from html import unescape
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "web" / "public" / "img"
SONGS_JSONL = PROJECT_ROOT / "raw_data" / "songs.jsonl"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

VERSION_PAGES = {
    "booth": "https://remywiki.com/AC_SDVX",
    "infinite_infection": "https://remywiki.com/AC_SDVX_II",
    "gravity_wars": "https://remywiki.com/AC_SDVX_III",
    "heavenly_haven": "https://remywiki.com/AC_SDVX_IV",
    "vivid_wave": "https://remywiki.com/AC_SDVX_VW",
    "exceed_gear": "https://remywiki.com/AC_SDVX_EG",
}

MALL_URL = (
    "https://p.eagate.573.jp/gate/p/eamusement/coop/mall.html"
    "?dt=%2F%E3%82%B3%E3%83%8A%E3%82%B9%E3%83%86%20SOUND%20VOLTEX%2F"
    "&fromindex={}"
)
MALL_API_URL = "https://p.eagate.573.jp/gate/p/eamusement/coop/api/getdata.html"
THUMBNAIL_RE = re.compile(r"thumb_\d+\.jpg", re.IGNORECASE)

# Fill this only if the mall page changes or temporarily hides a pack.
PACK_IMAGE_URL_OVERRIDES: dict[str, str] = {}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def normalize_match_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = normalized.replace("sound voltex", "")
    normalized = normalized.replace("コナステ", "")
    normalized = re.sub(r"[\[\]【】()（）]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def download(url: str) -> bytes:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
    response.raise_for_status()
    return response.content


def save_as_webp(raw: bytes, output_path: Path, max_width: int = 260, quality: int = 70) -> None:
    image = Image.open(BytesIO(raw))
    image.load()

    if image.width > max_width:
        ratio = max_width / image.width
        new_height = max(1, round(image.height * ratio))
        image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, "WebP", quality=quality, method=6)


class RemyLogoParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self._table_depth = 0
        self._in_infobox = False
        self.candidates: list[tuple[int, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): value or "" for key, value in attrs}

        if tag == "table":
            class_name = attrs_dict.get("class", "")
            if "infobox" in class_name:
                self._in_infobox = True
                self._table_depth = 1
            elif self._in_infobox:
                self._table_depth += 1
        elif tag == "img":
            src = attrs_dict.get("src", "")
            if not src:
                return

            text = " ".join(
                [
                    attrs_dict.get("alt", ""),
                    attrs_dict.get("title", ""),
                    attrs_dict.get("class", ""),
                    src,
                ]
            ).lower()
            score = 0
            if self._in_infobox:
                score += 20
            if "logo" in text:
                score += 15
            if "sound" in text or "sdvx" in text or "voltex" in text:
                score += 8
            if "button" in text or "icon" in text:
                score -= 12
            if "svg" in src.lower():
                score -= 8
            if score > 0:
                self.candidates.append((score, urljoin(self.base_url, src)))

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._in_infobox:
            self._table_depth -= 1
            if self._table_depth <= 0:
                self._in_infobox = False

    def logo_url(self) -> str:
        if not self.candidates:
            raise RuntimeError(f"No logo image found on {self.base_url}")
        return sorted(self.candidates, key=lambda item: item[0], reverse=True)[0][1]


class MallParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self._item_depth = 0
        self._current_img: str | None = None
        self._text_parts: list[str] = []
        self.items: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        src = attrs_dict.get("src", "")
        href = attrs_dict.get("href", "")
        image_url = src if THUMBNAIL_RE.search(src) else href if THUMBNAIL_RE.search(href) else ""

        if image_url:
            self._flush_current_item()
            self._current_img = urljoin(self.base_url, image_url)
            self._item_depth = 1
            self._text_parts = []
        elif self._current_img:
            self._item_depth += 1

        title = attrs_dict.get("title") or attrs_dict.get("alt")
        if self._current_img and title:
            self._text_parts.append(title)

    def handle_data(self, data: str) -> None:
        if self._current_img:
            text = data.strip()
            if text:
                self._text_parts.append(text)

    def handle_endtag(self, tag: str) -> None:
        if self._current_img:
            self._item_depth -= 1
            if self._item_depth <= 0:
                self._flush_current_item()

    def close(self) -> None:
        super().close()
        self._flush_current_item()

    def _flush_current_item(self) -> None:
        if not self._current_img:
            return

        text = re.sub(r"\s+", " ", " ".join(self._text_parts)).strip()
        if text:
            self.items.append((text, self._current_img))

        self._current_img = None
        self._item_depth = 0
        self._text_parts = []


def get_known_pack_names() -> set[str]:
    pack_names: set[str] = set()
    with SONGS_JSONL.open(encoding="utf-8") as songs_file:
        for line in songs_file:
            if not line.strip():
                continue
            song = json.loads(line)
            pack_name = song.get("music_pack_name")
            if pack_name:
                pack_names.add(pack_name)
    return pack_names


def find_pack_name(item_text: str, known_pack_names: set[str]) -> str | None:
    normalized_item = normalize_match_text(item_text)
    for pack_name in known_pack_names:
        if normalize_match_text(pack_name) in normalized_item:
            return pack_name
    return None


def expected_pack_terms(pack_name: str) -> list[str]:
    music_pack_match = re.fullmatch(r"Music Pack vol\.(\d+)", pack_name)
    if music_pack_match:
        return [f"楽曲パック vol.{music_pack_match.group(1)}"]

    selection_match = re.fullmatch(r"BEMANI Selection Music Pack vol\.(\d+)", pack_name)
    if selection_match:
        return [f"BEMANI セレクション 楽曲パック vol.{selection_match.group(1)}"]

    fixed_terms = {
        "10th Anniversary Music Pack": ["10周年記念", "楽曲パック"],
        "COCONATSU Selection Music Pack": ["ここなつセレクション", "楽曲パック"],
        "MÚSECA Selection Music Pack vol.1": ["MUSECAセレクション", "楽曲パック vol.1"],
        "MÚSECA Selection Music Pack vol.2": ["MUSECAセレクション", "楽曲パック vol.2"],
        "REFLEC BEAT Selection Music Pack vol.1": ["REFLEC BEAT セレクション", "楽曲パック vol.1"],
        "Start Up Selection Music Pack vol.1": ["スタートアップセレクション", "楽曲パック vol.1"],
        "Touhou Project Selection Music Pack": ["東方Projectセレクション", "楽曲パック"],
        "beatmania IIDX Selection Music Pack vol.1": [
            "beatmania IIDX セレクション",
            "楽曲パック vol.1",
        ],
        "jubeat Selection Music Pack vol.1": ["jubeat セレクション", "楽曲パック vol.1"],
    }
    return fixed_terms.get(pack_name, [pack_name])


def strip_accents(value: str) -> str:
    return unicodedata.normalize("NFKC", value).replace("Ú", "U").replace("ú", "u")


def contains_volume(text: str, prefix: str, volume: str) -> bool:
    pattern = rf"{re.escape(prefix)}\s*vol\.{re.escape(volume)}(?!\d)"
    return re.search(pattern, text) is not None


def product_matches_pack(product_text: str, pack_name: str) -> bool:
    comparable_text = strip_accents(product_text)

    music_pack_match = re.fullmatch(r"Music Pack vol\.(\d+)", pack_name)
    if music_pack_match:
        return contains_volume(comparable_text, "楽曲パック", music_pack_match.group(1))

    bemani_match = re.fullmatch(r"BEMANI Selection Music Pack vol\.(\d+)", pack_name)
    if bemani_match:
        return contains_volume(comparable_text, "BEMANI セレクション 楽曲パック", bemani_match.group(1))

    terms = [strip_accents(term) for term in expected_pack_terms(pack_name)]
    return all(term in comparable_text for term in terms)


def clean_product_text(value: object) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unicodedata.normalize("NFKC", text)
    return re.sub(r"\s+", " ", text).strip()


def scrape_mall_api_pack_mapping(known_pack_names: set[str]) -> dict[str, str]:
    response = requests.post(
        MALL_API_URL,
        headers={**REQUEST_HEADERS, "Referer": MALL_URL.format(0)},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    products = data.get("product", [])
    mapping: dict[str, str] = {}

    for product in products:
        if clean_product_text(product.get("content_keyword")) != "コナステ SOUND VOLTEX":
            continue
        if clean_product_text(product.get("display_tree")) != "/楽曲パック/":
            continue

        product_text = " ".join(
            [
                clean_product_text(product.get("product_name")),
                clean_product_text(product.get("short_product_name")),
                clean_product_text(product.get("product_info_head")),
            ]
        )
        image_url = product.get("img_url")
        if not image_url:
            continue

        for pack_name in known_pack_names:
            if pack_name in mapping:
                continue
            if product_matches_pack(product_text, pack_name):
                mapping[pack_name] = urljoin(MALL_API_URL, image_url)
                break

    return mapping


def scrape_mall_pack_mapping(known_pack_names: set[str]) -> dict[str, str]:
    mapping = dict(PACK_IMAGE_URL_OVERRIDES)
    try:
        api_mapping = scrape_mall_api_pack_mapping(known_pack_names)
        mapping.update(api_mapping)
        print(f"  Mall API: {len(api_mapping)} matched")
    except Exception as exc:
        print(f"  WARNING: Mall API failed: {exc}")

    if len(mapping) >= len(known_pack_names):
        return mapping

    seen_page_signatures: set[str] = set()

    for from_index in range(0, 240, 20):
        url = MALL_URL.format(from_index)
        html = download(url).decode("utf-8", errors="replace")
        signature = html[:1000]
        if signature in seen_page_signatures:
            break
        seen_page_signatures.add(signature)

        parser = MallParser(url)
        parser.feed(html)
        parser.close()

        matched_on_page = 0
        for item_text, image_url in parser.items:
            pack_name = find_pack_name(item_text, known_pack_names)
            if pack_name and pack_name not in mapping:
                mapping[pack_name] = image_url
                matched_on_page += 1

        print(f"  Mall page {from_index}: {matched_on_page} matched, {len(mapping)} total")
        if len(mapping) >= len(known_pack_names):
            break
        if not parser.items:
            break

        time.sleep(0.5)

    return mapping


def remy_original_image_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if "src" in query and query["src"]:
        return urljoin(url, query["src"][0])
    return url


def download_version_logos() -> None:
    for version, page_url in VERSION_PAGES.items():
        output_path = OUTPUT_DIR / f"version_{version}.webp"
        if output_path.exists() and "--force" not in sys.argv:
            print(f"  Skip existing {output_path.name}")
            continue

        html = download(page_url).decode("utf-8", errors="replace")
        parser = RemyLogoParser(page_url)
        parser.feed(html)
        logo_url = remy_original_image_url(parser.logo_url())

        print(f"  Downloading {version}: {logo_url}")
        save_as_webp(download(logo_url), output_path)
        time.sleep(0.5)


def download_pack_banners() -> None:
    known_pack_names = get_known_pack_names()
    mapping = scrape_mall_pack_mapping(known_pack_names)

    missing = sorted(known_pack_names - set(mapping))
    for pack_name in missing:
        print(f"  WARNING: no image found for {pack_name}")

    for pack_name in sorted(known_pack_names):
        output_path = OUTPUT_DIR / f"pack_{slugify(pack_name)}.webp"
        if output_path.exists() and "--force" not in sys.argv:
            print(f"  Skip existing {output_path.name}")
            continue

        image_url = mapping.get(pack_name)
        if not image_url:
            continue

        print(f"  Downloading {pack_name}: {image_url}")
        save_as_webp(download(image_url), output_path)
        time.sleep(0.5)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if "--optimize-existing" in sys.argv:
        for image_path in sorted(OUTPUT_DIR.glob("*.webp")):
            raw = image_path.read_bytes()
            save_as_webp(raw, image_path)
            print(f"Optimized {image_path.name}")
        webp_files = sorted(OUTPUT_DIR.glob("*.webp"))
        total_size = sum(path.stat().st_size for path in webp_files)
        print(f"Done: {len(webp_files)} images, {total_size / 1024:.0f}KB total")
        return

    print("Downloading version logos...")
    download_version_logos()

    print("Downloading song pack banners...")
    download_pack_banners()

    webp_files = sorted(OUTPUT_DIR.glob("*.webp"))
    total_size = sum(path.stat().st_size for path in webp_files)
    print(f"Done: {len(webp_files)} images, {total_size / 1024:.0f}KB total")


if __name__ == "__main__":
    main()
