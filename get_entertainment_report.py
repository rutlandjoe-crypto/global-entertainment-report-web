import json
import re
import html
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from email.utils import parsedate_to_datetime

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
JSON_PATH = PUBLIC_DIR / "latest_report.json"
TXT_PATH = BASE_DIR / "entertainment_report.txt"

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

ET_ZONE = ZoneInfo("America/New_York")

FEEDS = {
    "film": [
        "https://variety.com/v/film/feed/",
        "https://news.google.com/rss/search?q=film+movies+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "tv": [
        "https://variety.com/v/tv/feed/",
        "https://news.google.com/rss/search?q=television+tv+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "streaming": [
        "https://news.google.com/rss/search?q=streaming+netflix+hulu+disney+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "music": [
        "https://variety.com/v/music/feed/",
        "https://news.google.com/rss/search?q=music+entertainment+billboard&hl=en-US&gl=US&ceid=US:en",
    ],
    "awards": [
        "https://news.google.com/rss/search?q=entertainment+awards+oscars+emmys+grammys&hl=en-US&gl=US&ceid=US:en",
    ],
    "box_office": [
        "https://news.google.com/rss/search?q=box+office+movies+hollywood&hl=en-US&gl=US&ceid=US:en",
    ],
    "celebrity": [
        "https://news.google.com/rss/search?q=celebrity+entertainment+news&hl=en-US&gl=US&ceid=US:en",
    ],
    "hollywood": [
        "https://variety.com/feed/",
        "https://news.google.com/rss/search?q=hollywood+entertainment+industry&hl=en-US&gl=US&ceid=US:en",
    ],
    "gaming": [
        "https://news.google.com/rss/search?q=gaming+video+games+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "media": [
        "https://news.google.com/rss/search?q=media+entertainment+industry+news&hl=en-US&gl=US&ceid=US:en",
    ],
}

LABELS = {
    "film": "Film",
    "tv": "TV",
    "streaming": "Streaming",
    "music": "Music",
    "awards": "Awards",
    "box_office": "Box Office",
    "celebrity": "Celebrity",
    "hollywood": "Hollywood",
    "gaming": "Gaming",
    "media": "Media",
}


def now_et() -> datetime:
    return datetime.now(ET_ZONE)


def timestamp() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def clean_text(value: str) -> str:
    if not value:
        return ""

    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def parse_date(value: str) -> str:
    if not value:
        return timestamp()

    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ET_ZONE)
        return dt.astimezone(ET_ZONE).strftime("%Y-%m-%d %I:%M:%S %p ET")
    except Exception:
        return timestamp()


def fetch_url(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "GlobalEntertainmentReport/1.0 (+https://globalentertainmentreport.com)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
    )

    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read()


def parse_rss_items(raw: bytes, limit: int = 8) -> list[dict]:
    items: list[dict] = []

    root = ET.fromstring(raw)

    channel_items = root.findall(".//item")
    atom_items = root.findall(".//{http://www.w3.org/2005/Atom}entry")

    for item in channel_items:
        title = clean_text(item.findtext("title", ""))
        link = clean_text(item.findtext("link", ""))
        description = clean_text(item.findtext("description", ""))
        pub_date = clean_text(item.findtext("pubDate", ""))

        if title:
            items.append(
                {
                    "title": title,
                    "summary": description,
                    "link": link,
                    "published_at": parse_date(pub_date),
                }
            )

    for item in atom_items:
        title = clean_text(item.findtext("{http://www.w3.org/2005/Atom}title", ""))
        summary = clean_text(item.findtext("{http://www.w3.org/2005/Atom}summary", ""))
        updated = clean_text(item.findtext("{http://www.w3.org/2005/Atom}updated", ""))

        link = ""
        for link_node in item.findall("{http://www.w3.org/2005/Atom}link"):
            href = link_node.attrib.get("href", "")
            if href:
                link = clean_text(href)
                break

        if title:
            items.append(
                {
                    "title": title,
                    "summary": summary,
                    "link": link,
                    "published_at": parse_date(updated),
                }
            )

    seen = set()
    clean_items = []

    for item in items:
        key = item["title"].lower()
        if key in seen:
            continue
        seen.add(key)
        clean_items.append(item)

    return clean_items[:limit]


def fetch_category(category: str, urls: list[str], limit: int = 6) -> list[dict]:
    collected: list[dict] = []

    for url in urls:
        try:
            raw = fetch_url(url)
            items = parse_rss_items(raw, limit=limit)

            for item in items:
                item["source_feed"] = url
                collected.append(item)

            if len(collected) >= limit:
                break

        except Exception as exc:
            print(f"[{timestamp()}] Feed failed for {category}: {url} | {exc}")

    seen = set()
    final_items = []

    for item in collected:
        key = item["title"].lower()
        if key in seen:
            continue
        seen.add(key)
        final_items.append(item)

    return final_items[:limit]


def items_to_bullets(items: list[dict]) -> list[str]:
    bullets = []

    for item in items:
        title = item.get("title", "").strip()
        summary = item.get("summary", "").strip()

        if summary and len(summary) > 220:
            summary = summary[:217].rstrip() + "..."

        if title and summary:
            bullets.append(f"{title} — {summary}")
        elif title:
            bullets.append(title)

    return bullets


def build_section(category: str, items: list[dict]) -> dict:
    label = LABELS.get(category, category.replace("_", " ").title())
    bullets = items_to_bullets(items)

    if bullets:
        headline = bullets[0]
        snapshot = f"{label} coverage is updating with {len(items)} current headline item(s)."
    else:
        headline = f"{label} coverage is waiting for fresh source data."
        snapshot = "No fresh RSS items were available during this run."

    return {
        "title": f"{label} Report",
        "headline": headline,
        "snapshot": snapshot,
        "key_storylines": bullets[:5],
        "watch_list": bullets,
        "updated_at": timestamp(),
    }


def build_report() -> dict:
    generated = timestamp()
    sections_map = {}
    section_order = []

    for category, urls in FEEDS.items():
        items = fetch_category(category, urls)
        sections_map[category] = build_section(category, items)
        section_order.append(category)

    all_bullets = []

    for category in section_order:
        storylines = sections_map[category].get("key_storylines", [])
        if isinstance(storylines, list):
            all_bullets.extend(storylines[:1])

    headline = (
        all_bullets[0]
        if all_bullets
        else "Global Entertainment Report is live and ready for entertainment coverage."
    )

    snapshot = (
        "The entertainment desk is tracking film, TV, streaming, music, awards, "
        "celebrity, Hollywood, gaming, and media industry signals."
    )

    return {
        "title": "GLOBAL ENTERTAINMENT REPORT",
        "generated_date": generated,
        "generated_at": generated,
        "updated_at": generated,
        "headline": headline,
        "snapshot": snapshot,
        "key_storylines": all_bullets[:8],
        "substack_url": "https://globalentertainmentreport.substack.com/",
        "x_handle": "@GlobalSportsRp",
        "section_order": section_order,
        "sections_map": sections_map,
        "sections": [
            {
                "name": LABELS.get(key, key.replace("_", " ").title()),
                **sections_map[key],
            }
            for key in section_order
        ],
    }


def write_text_report(report: dict) -> None:
    lines = []
    lines.append(report.get("title", "GLOBAL ENTERTAINMENT REPORT"))
    lines.append(f"Updated: {report.get('generated_date', timestamp())}")
    lines.append("")
    lines.append("HEADLINE")
    lines.append(str(report.get("headline", "")))
    lines.append("")
    lines.append("SNAPSHOT")
    lines.append(str(report.get("snapshot", "")))
    lines.append("")
    lines.append("KEY STORYLINES")

    for item in report.get("key_storylines", []):
        lines.append(f"- {item}")

    lines.append("")

    sections_map = report.get("sections_map", {})
    section_order = report.get("section_order", [])

    if isinstance(sections_map, dict) and isinstance(section_order, list):
        for key in section_order:
            section = sections_map.get(key, {})
            if not isinstance(section, dict):
                continue

            lines.append("")
            lines.append("=" * 80)
            lines.append(str(section.get("title", key)).upper())
            lines.append("=" * 80)
            lines.append("")
            lines.append(str(section.get("headline", "")))
            lines.append("")
            lines.append(str(section.get("snapshot", "")))
            lines.append("")

            watch_list = section.get("watch_list", [])
            if isinstance(watch_list, list):
                for item in watch_list:
                    lines.append(f"- {item}")

    TXT_PATH.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def main() -> None:
    print(f"[{timestamp()}] ENTERTAINMENT REPORT STARTED")

    report = build_report()

    JSON_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    write_text_report(report)

    print(f"[{timestamp()}] WROTE: {JSON_PATH}")
    print(f"[{timestamp()}] WROTE: {TXT_PATH}")
    print(f"[{timestamp()}] ENTERTAINMENT REPORT COMPLETE")


if __name__ == "__main__":
    main()