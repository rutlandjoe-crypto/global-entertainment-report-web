from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from editorial_intelligence import clean_text as intelligence_clean_text
from editorial_intelligence import normalize_card, normalize_payload

ET = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent

REPORT_FILE = BASE_DIR / "entertainment_report.txt"

OUTPUT_JSON = BASE_DIR / "latest_report.json"
OUTPUT_TXT = BASE_DIR / "latest_report.txt"

WEB_DIR = Path(r"C:\Users\joeru\OneDrive\Desktop\global-entertainment-report-web")
WEB_PUBLIC = WEB_DIR / "public"

WEB_JSON = WEB_PUBLIC / "latest_report.json"
WEB_TXT = WEB_PUBLIC / "latest_report.txt"

SITE_NAME = "Global Entertainment Report"
VERTICAL = "Entertainment"

DEFAULT_VIDEO_URL = "https://www.youtube.com/embed/21X5lGlDOfg?rel=0&autoplay=1&mute=1"

CATEGORY_KEYWORDS = {
    "Film": [
        "film",
        "movie",
        "box office",
        "oscar",
        "director",
        "actor",
        "actress",
        "cinema",
        "studio",
        "paramount",
        "warner",
        "disney",
        "universal",
    ],
    "TV": [
        "tv",
        "television",
        "show",
        "series",
        "season",
        "episode",
        "emmy",
        "cbs",
        "nbc",
        "abc",
        "fox",
        "hbo",
        "starz",
    ],
    "Streaming": [
        "streaming",
        "netflix",
        "hulu",
        "prime video",
        "apple tv",
        "max",
        "peacock",
        "paramount+",
        "disney+",
        "bundle",
    ],
    "Music": [
        "music",
        "singer",
        "album",
        "song",
        "tour",
        "concert",
        "grammy",
        "artist",
        "band",
        "record",
    ],
    "Awards": [
        "awards",
        "award",
        "golden globes",
        "globes",
        "oscars",
        "emmys",
        "grammys",
        "egot",
        "nomination",
    ],
    "Box Office": [
        "box office",
        "opening",
        "gross",
        "tracking",
        "theatrical",
        "debut",
        "launch",
    ],
    "Celebrity": [
        "celebrity",
        "star",
        "stars",
        "hospitalized",
        "death",
        "dies",
        "died",
        "gossip",
        "hollywood star",
    ],
    "Gaming": [
        "gaming",
        "game",
        "video game",
        "xbox",
        "playstation",
        "nintendo",
        "sony interactive",
    ],
    "Media": [
        "media",
        "merger",
        "layoffs",
        "deal",
        "studios",
        "publisher",
        "news",
        "copyright",
    ],
}


def now_et() -> datetime:
    return datetime.now(ET)


def stamp() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def generated_utc() -> str:
    return datetime.utcnow().isoformat() + "+00:00"


def clean_text(value, fallback: str = "") -> str:
    return intelligence_clean_text(value, fallback)
    if value is None:
        return fallback

    text = str(value)

    replacements = {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2014": "—",
        "\u2013": "–",
        "\xa0": " ",
        "â€™": "'",
        "â€œ": '"',
        "â€\x9d": '"',
        "â€”": "—",
        "â€“": "–",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(r"\s+", " ", text).strip()
    return text if text else fallback


def truncate(text: str, max_chars: int = 280) -> str:
    text = clean_text(text)
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def read_report() -> str:
    if not REPORT_FILE.exists():
        return ""
    return REPORT_FILE.read_text(encoding="utf-8").strip()


def load_json(path: Path):
    if not path.exists():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def find_best_existing_payload():
    candidates = [
        WEB_JSON,
        BASE_DIR / "public" / "latest_report.json",
        OUTPUT_JSON,
    ]

    for path in candidates:
        payload = load_json(path)
        if is_valid_newsroom_payload(payload):
            return payload

    return None


def is_valid_newsroom_payload(payload) -> bool:
    if not isinstance(payload, dict):
        return False

    has_valid_identity = (
        payload.get("site") == SITE_NAME
        or payload.get("site_name") == SITE_NAME
        or payload.get("vertical") == VERTICAL
    )

    live_newsroom = payload.get("live_newsroom")
    has_live_newsroom = isinstance(live_newsroom, list) and len(live_newsroom) > 0

    if not has_valid_identity or not has_live_newsroom:
        return False

    if "fallback" in clean_text(payload.get("source_mode")).lower():
        return False

    for item in live_newsroom:
        if not isinstance(item, dict):
            continue

        headline = clean_text(item.get("headline"))
        url = clean_text(item.get("url"))
        source = clean_text(item.get("source_name") or item.get("source")).lower()

        if headline and url.startswith("http") and source != "fallback":
            return True

    return False


def story_category(story: dict) -> str:
    combined = " ".join(
        [
            clean_text(story.get("headline")),
            clean_text(story.get("snapshot")),
            clean_text(story.get("source_name")),
        ]
    ).lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in combined for keyword in keywords):
            return category

    return "Entertainment"


def story_to_section(story: dict, category: str) -> dict:
    headline = truncate(story.get("headline"), 180)
    snapshot = truncate(story.get("snapshot") or headline, 360)
    url = clean_text(story.get("url"))

    return normalize_card({
        "title": category,
        "headline": headline,
        "url": url,
        "snapshot": snapshot,
        "source_name": clean_text(story.get("source_name"), "Entertainment source"),
        "source_feed": clean_text(story.get("source_feed")),
        "published": clean_text(story.get("published")),
        "age_hours": clean_text(story.get("age_hours")),
        "freshness_status": clean_text(story.get("freshness_status"), "fresh"),
        "urgency": clean_text(story.get("urgency")),
        "editorial_score": clean_text(story.get("editorial_score")),
        "editor_note": clean_text(
            story.get("editor_note"),
            "Live entertainment newsroom item with source link preserved.",
        ),
        "key_data": story.get("key_data") if isinstance(story.get("key_data"), list) else [],
        "why_it_matters": story.get("why_it_matters")
        if isinstance(story.get("why_it_matters"), list)
        else [
            "This item helps editors track entertainment industry movement across film, TV, streaming, music, awards, celebrity, gaming, and media."
        ],
        "what_to_watch": story.get("what_to_watch")
        if isinstance(story.get("what_to_watch"), list)
        else [
            "Watch for follow-up coverage, audience reaction, platform response, talent movement, or broader industry impact."
        ],
    })


def build_sections_from_live_newsroom(payload: dict) -> list[dict]:
    stories = payload.get("live_newsroom", [])
    sections: list[dict] = []
    seen_urls: set[str] = set()
    used_categories: set[str] = set()

    for story in stories:
        if not isinstance(story, dict):
            continue

        headline = clean_text(story.get("headline"))
        url = clean_text(story.get("url"))

        if not headline or not url.startswith("http"):
            continue

        if url in seen_urls:
            continue

        category = story_category(story)

        if category in used_categories and len(sections) >= 9:
            continue

        sections.append(story_to_section(story, category))
        seen_urls.add(url)
        used_categories.add(category)

        if len(sections) >= 12:
            break

    if not sections:
        return []

    return sections


def build_newsroom_payload(existing_payload: dict) -> dict:
    current_stamp = stamp()
    sections = build_sections_from_live_newsroom(existing_payload)

    if not sections:
        text = read_report()
        return build_fallback_payload(text)

    lead = sections[0]
    headline = lead.get("headline") or clean_text(existing_payload.get("headline"))
    snapshot = lead.get("snapshot") or clean_text(existing_payload.get("snapshot"))

    return normalize_payload({
        "site": SITE_NAME,
        "site_name": SITE_NAME,
        "vertical": VERTICAL,
        "title": SITE_NAME,
        "headline": headline,
        "snapshot": snapshot,
        "updated_at": current_stamp,
        "generated_at": current_stamp,
        "generated_utc": generated_utc(),
        "video_url": clean_text(existing_payload.get("video_url"), DEFAULT_VIDEO_URL),
        "source_mode": "live entertainment newsroom distribution",
        "freshness": existing_payload.get("freshness", {}),
        "live_newsroom": existing_payload.get("live_newsroom", []),
        "sections": sections,
    })


def first_real_line(text: str) -> str:
    for line in text.splitlines():
        line = clean_text(line)
        if len(line) > 40 and not line.startswith("="):
            return truncate(line, 180)
    return "Entertainment developments continue across film, television, streaming, music, awards, celebrity, gaming, and media."


def split_text_report_sections(text: str) -> list[dict]:
    if not text:
        return []

    blocks = re.split(r"\n={10,}\n", text)
    sections: list[dict] = []

    for block in blocks:
        lines = [clean_text(line) for line in block.splitlines() if clean_text(line)]
        if not lines:
            continue

        title = lines[0].replace(" REPORT", "").title()
        if title.upper().startswith("GLOBAL ENTERTAINMENT"):
            title = "Entertainment"

        headline = first_real_line("\n".join(lines[1:])) if len(lines) > 1 else first_real_line(block)
        snapshot = truncate(" ".join(lines[1:]), 420)

        if not headline or len(headline) < 20:
            continue

        sections.append(
            {
                "title": title,
                "headline": headline,
                "snapshot": snapshot,
                "source_name": "Entertainment Report",
                "freshness_status": "fallback",
                "editor_note": "Fallback text section used because live newsroom JSON was unavailable.",
                "key_data": [],
                "why_it_matters": [
                    "This fallback keeps the entertainment desk populated while the live newsroom feed is restored."
                ],
                "what_to_watch": [
                    "Check the source engine and RSS inputs if this fallback remains visible after the next run."
                ],
            }
        )

        if len(sections) >= 10:
            break

    return sections


def build_fallback_payload(text: str) -> dict:
    current_stamp = stamp()
    headline = first_real_line(text)
    sections = split_text_report_sections(text)

    if not sections:
        sections = [
            {
                "title": "Entertainment",
                "headline": headline,
                "snapshot": text or headline,
                "source_name": "Entertainment Report",
                "freshness_status": "fallback",
                "editor_note": "Fallback text report used because no valid newsroom JSON was available.",
                "key_data": [],
                "why_it_matters": [
                    "This fallback should only appear when the live entertainment content engine has not produced a valid newsroom payload."
                ],
                "what_to_watch": [
                    "Run get_entertainment_report.py to restore full live newsroom coverage."
                ],
            }
        ]

    return normalize_payload({
        "site": SITE_NAME,
        "site_name": SITE_NAME,
        "vertical": VERTICAL,
        "title": SITE_NAME,
        "headline": headline,
        "snapshot": headline,
        "updated_at": current_stamp,
        "generated_at": current_stamp,
        "generated_utc": generated_utc(),
        "video_url": DEFAULT_VIDEO_URL,
        "source_mode": "fallback entertainment text distribution",
        "sections": sections,
    })


def write_files(payload: dict, text: str) -> None:
    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)

    json_text = json.dumps(payload, indent=2, ensure_ascii=False)

    OUTPUT_JSON.write_text(json_text, encoding="utf-8")
    OUTPUT_TXT.write_text(text, encoding="utf-8")

    WEB_JSON.write_text(json_text, encoding="utf-8")
    WEB_TXT.write_text(text, encoding="utf-8")


def main() -> None:
    print(f"[{stamp()}] ENTERTAINMENT BUILD STARTED")

    text = read_report()
    existing_payload = find_best_existing_payload()

    if existing_payload:
        payload = build_newsroom_payload(existing_payload)
        write_files(payload, text)
        print(f"[OK] Wrote live entertainment newsroom payload with {len(payload.get('sections', []))} section card(s).")
        print(f"[{stamp()}] ENTERTAINMENT BUILD COMPLETE")
        return

    if not text:
        print("[WARN] No entertainment report found and no valid live newsroom JSON existed.")
        print(f"[{stamp()}] ENTERTAINMENT BUILD COMPLETE")
        return

    payload = build_fallback_payload(text)
    write_files(payload, text)

    print(f"[WARN] Wrote fallback entertainment payload with {len(payload.get('sections', []))} section card(s).")
    print(f"[{stamp()}] ENTERTAINMENT BUILD COMPLETE")


if __name__ == "__main__":
    main()
