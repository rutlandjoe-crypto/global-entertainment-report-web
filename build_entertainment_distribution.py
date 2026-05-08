from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

REPORT_TXT = BASE_DIR / "entertainment_report.txt"
ROOT_JSON = BASE_DIR / "latest_report.json"
ROOT_TXT = BASE_DIR / "latest_report.txt"
PUBLIC_JSON = PUBLIC_DIR / "latest_report.json"
PUBLIC_TXT = PUBLIC_DIR / "latest_report.txt"

TITLE = "Global Entertainment Report"
DISCLAIMER = "This report is an automated summary intended to support, not replace, human entertainment journalism."
DEFAULT_URL = "https://variety.com"

LABELS = {
    "film": "Film",
    "tv": "TV",
    "television": "TV",
    "streaming": "Streaming",
    "music": "Music",
    "awards": "Awards",
    "box_office": "Box Office",
    "celebrity": "Celebrity",
    "hollywood": "Hollywood",
    "gaming": "Gaming",
    "media": "Media",
    "entertainment": "Entertainment Watch",
}


def now_et() -> datetime:
    return datetime.now(ET)


def stamp() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return " | ".join(clean_text(item) for item in value if clean_text(item))
    if isinstance(value, dict):
        return " | ".join(clean_text(item) for item in value.values() if clean_text(item))

    text = str(value)
    text = text.replace("\ufeff", "")
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2014", "-").replace("\u2013", "-")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []

    for item in items:
        text = clean_text(item)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(text)

    return output


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        parsed = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        return parsed if isinstance(parsed, dict) else {}
    except Exception as exc:
        print(f"[{stamp()}] WARNING: Could not read JSON {path}: {exc}")
        return {}


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace").strip()


def as_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return unique([clean_text(item) for item in value])
    if isinstance(value, dict):
        return unique([clean_text(item) for item in value.values()])
    return unique(re.split(r"\n|•|\|", clean_text(value)))


def normalize_label(value: Any, fallback: str = "Entertainment Watch") -> str:
    raw = clean_text(value)
    key = raw.lower().replace(" ", "_")
    if not raw or key in {"undefined", "null"}:
        return fallback
    return LABELS.get(key, raw)


def first_meaningful_line(text: str) -> str:
    headings = {
        "HEADLINE",
        "SNAPSHOT",
        "KEY STORYLINES",
        "KEY DATA POINTS",
        "WHY IT MATTERS",
        "WHAT TO WATCH",
        "WATCH LIST",
    }

    for line in text.splitlines():
        cleaned = clean_text(line).strip(" -:\t")
        if cleaned and cleaned.upper() not in headings and len(cleaned) > 20:
            return cleaned

    return "Entertainment developments continue across film, television, streaming, music and media business."


def section_lines(content: str, heading: str) -> list[str]:
    lines = content.splitlines()
    start = None

    for index, line in enumerate(lines):
        if line.strip().upper() == heading.upper():
            start = index + 1
            break

    if start is None:
        return []

    output: list[str] = []

    for line in lines[start:]:
        cleaned = line.strip()
        if not cleaned:
            continue
        if re.fullmatch(r"[A-Z0-9\s&/()-]{4,}", cleaned) and "." not in cleaned and ":" not in cleaned:
            break
        output.append(cleaned.removeprefix("- ").strip())

    return unique(output)


def card_from_item(item: dict[str, Any], category: str, index: int) -> dict[str, Any]:
    label = normalize_label(item.get("category") or item.get("name") or item.get("label") or category)
    title = clean_text(item.get("headline") or item.get("title") or item.get("name"))
    summary = clean_text(item.get("snapshot") or item.get("summary") or item.get("description"))
    url = clean_text(item.get("url") or item.get("link") or item.get("source_url") or DEFAULT_URL)

    if not title:
        title = f"{label} Storyline {index + 1}"
    if not summary:
        summary = "Entertainment development flagged for newsroom monitoring."
    if not url.startswith(("http://", "https://")):
        url = DEFAULT_URL

    return {
        "id": clean_text(item.get("id") or item.get("key") or f"{category}-{index}"),
        "key": clean_text(item.get("key") or item.get("id") or f"{category}-{index}"),
        "category": label,
        "label": label,
        "headline": title,
        "title": title,
        "snapshot": summary,
        "summary": summary,
        "url": url,
        "source": clean_text(item.get("source") or item.get("source_name") or item.get("source_feed")),
        "source_name": clean_text(item.get("source_name") or item.get("source") or "Entertainment source"),
        "source_feed": clean_text(item.get("source_feed")),
        "published_at": clean_text(item.get("published_at") or item.get("published")),
        "freshness_status": clean_text(item.get("freshness_status") or "fresh"),
        "key_data": as_list(item.get("key_data") or item.get("key_storylines") or item.get("watch_list") or [title]),
        "why_it_matters": as_list(
            item.get("why_it_matters")
            or ["This affects entertainment coverage priorities, audience attention, talent leverage or media business strategy."]
        ),
        "what_to_watch": as_list(
            item.get("what_to_watch")
            or ["Monitor confirmed reporting, platform response, studio movement, audience behavior and follow-up coverage."]
        ),
        "story_type": clean_text(item.get("story_type") or "newsroom_signal"),
        "priority_score": item.get("priority_score", max(0, 100 - index)),
    }


def section_to_cards(section: dict[str, Any], category: str) -> list[dict[str, Any]]:
    cards = section.get("homepage_cards") or section.get("cards") or section.get("items") or section.get("stories")
    if isinstance(cards, list) and cards:
        object_cards = [item for item in cards if isinstance(item, dict)]
        if object_cards:
            return [card_from_item(item, category, index) for index, item in enumerate(object_cards)]

        string_cards = [clean_text(item) for item in cards if clean_text(item)]
        if string_cards:
            return [
                card_from_item(
                    {
                        "category": category,
                        "headline": item,
                        "snapshot": clean_text(section.get("snapshot")),
                        "key_data": [item],
                    },
                    category,
                    index,
                )
                for index, item in enumerate(string_cards)
            ]

    content = clean_text(section.get("content"))
    key_data = unique(
        section_lines(content, "KEY STORYLINES")
        + section_lines(content, "KEY DATA POINTS")
        + as_list(section.get("key_storylines"))
        + as_list(section.get("watch_list"))
    )

    return [
        card_from_item(
            {
                "category": category,
                "headline": clean_text(section.get("headline")) or first_meaningful_line(content),
                "snapshot": clean_text(section.get("snapshot")) or clean_text(content)[:260],
                "key_data": key_data,
                "url": clean_text(section.get("url") or section.get("link") or DEFAULT_URL),
            },
            category,
            0,
        )
    ]


def source_has_real_rss(source: dict[str, Any]) -> bool:
    freshness = source.get("freshness")
    if isinstance(freshness, dict) and int(freshness.get("accepted_real_items") or 0) > 0:
        return True

    cards = source.get("homepage_cards")
    if isinstance(cards, list):
        return any(
            isinstance(card, dict)
            and clean_text(card.get("freshness_status")) != "fallback"
            and clean_text(card.get("url")).startswith(("http://", "https://"))
            for card in cards
        )

    return False


def build_from_existing_json(source: dict[str, Any]) -> dict[str, Any]:
    generated = clean_text(source.get("updated_at") or source.get("generated_at")) or stamp()
    sections = source.get("sections")
    homepage_cards: list[dict[str, Any]] = []

    if isinstance(source.get("homepage_cards"), list):
        homepage_cards.extend(
            card_from_item(item, clean_text(item.get("category") or "entertainment"), index)
            for index, item in enumerate(source["homepage_cards"])
            if isinstance(item, dict)
        )

    if isinstance(sections, list):
        for index, section in enumerate(sections):
            if isinstance(section, dict):
                category = clean_text(section.get("key") or section.get("name") or section.get("title") or f"section-{index}")
                homepage_cards.extend(section_to_cards(section, category))
    elif isinstance(sections, dict):
        for key, section in sections.items():
            if isinstance(section, dict):
                homepage_cards.extend(section_to_cards(section, key))

    if not homepage_cards:
        text = read_text(REPORT_TXT)
        homepage_cards.extend(section_to_cards({"content": text, "headline": first_meaningful_line(text)}, "entertainment"))

    seen_urls: set[str] = set()
    deduped_cards: list[dict[str, Any]] = []
    for card in homepage_cards:
        key = clean_text(card.get("url")) or clean_text(card.get("headline")).lower()
        if key in seen_urls:
            continue
        seen_urls.add(key)
        deduped_cards.append(card)

    homepage_cards = deduped_cards[:24]
    headline = clean_text(source.get("headline")) or homepage_cards[0]["headline"]
    snapshot = clean_text(source.get("snapshot")) or "The entertainment desk is tracking film, TV, streaming, music, awards, celebrity, Hollywood, gaming and media industry signals."
    real_rss = source_has_real_rss(source)

    return {
        "title": TITLE,
        "site": "Global Entertainment Report",
        "site_name": "Global Entertainment Report",
        "vertical": "Entertainment",
        "headline": headline,
        "snapshot": snapshot,
        "generated_at": generated,
        "updated_at": generated,
        "published_at": generated,
        "source_mode": "live RSS ingestion" if real_rss else "fallback; every real feed failed or returned no accepted item",
        "freshness": source.get("freshness", {}),
        "feed_audit": source.get("feed_audit", []),
        "disclaimer": DISCLAIMER,
        "substack_url": clean_text(source.get("substack_url")) or "https://globalentertainmentreport.substack.com/",
        "x_handle": clean_text(source.get("x_handle")) or "@GlobalSportsRp",
        "key_storylines": unique(as_list(source.get("key_storylines")) + [card["headline"] for card in homepage_cards])[:8],
        "live_newsroom": homepage_cards[:12],
        "editor_signals": homepage_cards[12:24] or homepage_cards[:12],
        "homepage_cards": homepage_cards,
        "sections": sections if isinstance(sections, list) else homepage_cards,
    }


def build_text(payload: dict[str, Any]) -> str:
    lines = [
        TITLE,
        "",
        "HEADLINE",
        clean_text(payload.get("headline")),
        "",
        "SNAPSHOT",
        clean_text(payload.get("snapshot")),
        "",
        "KEY STORYLINES",
    ]

    for item in payload.get("key_storylines", []):
        lines.append(f"- {clean_text(item)}")

    lines.append("")
    lines.append("LIVE NEWSROOM")

    for card in payload.get("homepage_cards", []):
        lines.append("")
        lines.append(clean_text(card.get("category")).upper())
        lines.append(clean_text(card.get("headline")))
        lines.append(clean_text(card.get("snapshot")))
        for item in as_list(card.get("key_data"))[:5]:
            lines.append(f"- {item}")

    lines.append("")
    lines.append(DISCLAIMER)
    return "\n".join(line for line in lines if line is not None).strip() + "\n"


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[{stamp()}] Saved: {path}")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"[{stamp()}] Saved: {path}")


def main() -> int:
    print(f"[{stamp()}] ENTERTAINMENT DISTRIBUTION BUILD STARTED")

    source = read_json(PUBLIC_JSON) or read_json(ROOT_JSON)
    if not source and REPORT_TXT.exists():
        text = read_text(REPORT_TXT)
        source = {
            "headline": first_meaningful_line(text),
            "snapshot": first_meaningful_line(text),
            "sections": {"entertainment": {"title": "Entertainment", "content": text}},
            "generated_at": stamp(),
            "updated_at": stamp(),
            "freshness": {"accepted_real_items": 0},
        }

    if not source:
        print(f"[{stamp()}] FATAL ERROR: no entertainment source report found.")
        return 1

    payload = build_from_existing_json(source)
    text = build_text(payload)

    if ROOT_JSON.exists():
        shutil.copy2(ROOT_JSON, BASE_DIR / "latest_report.previous.json")

    write_json(ROOT_JSON, payload)
    write_json(PUBLIC_JSON, payload)
    write_text(ROOT_TXT, text)
    write_text(PUBLIC_TXT, text)

    print(f"[{stamp()}] ENTERTAINMENT DISTRIBUTION BUILD COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
