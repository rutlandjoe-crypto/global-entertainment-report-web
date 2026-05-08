from __future__ import annotations

import re
from typing import Any


ROLE_WORDS = ["actor", "actress", "director", "writer", "producer", "showrunner", "star", "host"]
STUDIOS = ["Netflix", "Disney", "HBO", "Max", "Warner", "Universal", "Paramount", "Sony", "Apple", "Hulu", "Prime Video", "NBC", "CBS", "ABC", "Fox", "Variety", "A24", "Lionsgate"]
EVENT_WORDS = ["Cannes", "Oscar", "Oscars", "Emmy", "Emmys", "Grammy", "Grammys", "festival", "awards", "release", "premiere", "Sundance", "Toronto"]
BUSINESS_WORDS = ["box office", "streaming", "salary", "deal", "strike", "union", "layoff", "gross", "bidding war", "rights", "ratings"]
MOJIBAKE = {
    "\ufeff": "", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2014": "-", "\u2013": "-", "\xa0": " ",
    "â€™": "'", "â€˜": "'", "â€œ": '"', "â€\x9d": '"', "â€": '"', "â€“": "-", "â€”": "-",
    "Ã¢â‚¬â„¢": "'", "Ã¢â‚¬Ëœ": "'", "Ã¢â‚¬Å“": '"', "Ã¢â‚¬Â": '"', "Ã¢â‚¬": '"',
    "Ã¢â‚¬â€œ": "-", "Ã¢â‚¬â€": "-", "Donât": "Don't", "donât": "don't", "RenÃ©e": "Renee",
    "Ã©": "e", "Ã¡": "a", "Ã³": "o", "Ãº": "u", "Ã±": "n", "Ã¼": "u",
    "ÃƒÂ©": "e", "ÃƒÂ¡": "a", "ÃƒÂ³": "o", "ÃƒÂº": "u", "ÃƒÂ±": "n", "ÃƒÂ¼": "u",
    "[...]": "", "[â€¦]": "", "[Ã¢â‚¬Â¦]": "",
}


def clean_text(value: Any, fallback: str = "") -> str:
    text = "" if value is None else str(value)
    for old, new in MOJIBAKE.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text).strip(" -")
    return text or fallback


def _dedupe(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    clean: list[str] = []
    for line in lines:
        item = clean_text(line).strip("'\".,")
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            clean.append(item)
    return clean


def _not_headline(lines: list[str], headline: str) -> list[str]:
    headline_key = re.sub(r"[^a-z0-9]+", " ", headline.lower()).strip()
    return [line for line in _dedupe(lines) if re.sub(r"[^a-z0-9]+", " ", line.lower()).strip() != headline_key]


def _entities(text: str) -> list[str]:
    candidates = re.findall(r"\b[A-Z][A-Za-z0-9&.+'-]*(?:\s+[A-Z][A-Za-z0-9&.+'-]*){0,3}", text)
    skip = {"The", "A", "An", "This", "That", "Exclusive", "Cannes", "Oscar", "Emmy", "Grammy", "Entertainment"}
    noisy = {
        "Direct", "Original", "Drama", "Film", "Show", "Series", "Movie", "Streaming", "Release",
        "Premiere", "Awards", "Festival", "Box", "Office", "Report", "Out", "There",
    }
    studios = {studio.lower() for studio in STUDIOS}
    clean: list[str] = []
    for item in _dedupe(candidates):
        words = set(item.replace(".", "").replace("'", "").split())
        if "." in item or len(words) < 2 or item in skip or item.lower() in studios or words & noisy or len(item) <= 2:
            continue
        clean.append(item)
    return clean[:5]


def _figures(text: str) -> list[str]:
    return re.findall(r"(?:\$[0-9][0-9,.]*(?:\s?(?:million|billion))?|[0-9]+(?:\.[0-9]+)?%|[0-9]+\s?(?:submissions|films|episodes|seasons|years|million viewers))", text, flags=re.I)[:3]


def build_key_data(item: dict[str, Any], vertical: str = "entertainment") -> list[str]:
    headline = clean_text(item.get("headline") or item.get("title"))
    snapshot = clean_text(item.get("snapshot") or item.get("summary"))
    combined = f"{headline}. {snapshot}"
    category = clean_text(item.get("category") or item.get("label") or item.get("title"))
    source = clean_text(item.get("source_name") or item.get("source") or item.get("source_feed"))
    published = clean_text(item.get("published_at") or item.get("published"))
    lines: list[str] = []

    people = _entities(combined)
    if people:
        lines.append(f"Talent / person: {', '.join(people[:4])}")

    platforms = []
    for name in STUDIOS:
        if name == "Max" and re.search(r"\bMax\s+Taxe\b", combined):
            continue
        if re.search(rf"\b{re.escape(name)}\b", combined, flags=re.I):
            platforms.append(name)
    if platforms:
        lines.append(f"Studio / platform / network: {', '.join(_dedupe(platforms)[:3])}")

    title_match = re.search(r"['\"]([^'\"]{3,80})['\"]", combined)
    if title_match:
        lines.append(f"Film / show / project: {clean_text(title_match.group(1))}")

    roles = [word for word in ROLE_WORDS if re.search(rf"\b{word}\b", combined, flags=re.I)]
    if roles:
        lines.append(f"Role: {', '.join(_dedupe(roles)[:3])}")

    events = [word for word in EVENT_WORDS if re.search(rf"\b{re.escape(word)}\b", combined, flags=re.I)]
    if events:
        lines.append(f"Release / festival / awards context: {', '.join(_dedupe(events)[:3])}")

    figures = _figures(combined)
    if figures:
        lines.append(f"Box office / streaming / business / labor detail: {', '.join(figures)}")

    if category:
        lines.append(f"Category: {category}")
    if published:
        lines.append(f"Published: {published}")
    if source:
        lines.append(f"Source: {source}")
    return _not_headline(lines, headline)[:6]


def build_why_it_matters(item: dict[str, Any], vertical: str = "entertainment") -> list[str]:
    text = clean_text(f"{item.get('headline', '')} {item.get('snapshot', '')} {item.get('summary', '')}").lower()
    if any(word in text for word in BUSINESS_WORDS):
        return ["The business angle can shift studio leverage, labor coverage, platform strategy or box office expectations."]
    if any(word.lower() in text for word in EVENT_WORDS):
        return ["Festival, release or awards context can change campaign timing, buyer interest and audience attention."]
    if any(word in text for word in ["netflix", "hbo", "max", "disney", "streaming", "platform"]):
        return ["Platform involvement makes this relevant to streaming strategy, programming spend and audience acquisition."]
    return ["This gives editors a concrete entertainment lead tied to talent, project momentum, audience interest or media business strategy."]


def build_what_to_watch(item: dict[str, Any], vertical: str = "entertainment") -> list[str]:
    source = clean_text(item.get("source_name") or item.get("source"), "the original source")
    return [
        f"Watch {source} and trade follow-ups for confirmations, casting details, release timing or deal terms.",
        "Track studio/platform response, audience reaction, awards positioning, box office or streaming performance as applicable.",
    ]


def normalize_card(item: dict[str, Any], vertical: str = "entertainment") -> dict[str, Any]:
    card = dict(item)
    for key in ["headline", "title", "snapshot", "summary", "source", "source_name", "published", "published_at", "url", "category", "label"]:
        if key in card:
            card[key] = clean_text(card.get(key))
    headline = clean_text(card.get("headline") or card.get("title"))
    key_data = build_key_data(card, vertical)
    if not key_data:
        source = clean_text(card.get("source_name") or card.get("source"), "Entertainment source")
        key_data = [f"Source: {source}"]
    card["key_data"] = _not_headline(key_data, headline)[:6]
    card["why_it_matters"] = _dedupe(build_why_it_matters(card, vertical))[:4]
    card["what_to_watch"] = _dedupe(build_what_to_watch(card, vertical))[:4]
    return card


def normalize_payload(payload: dict[str, Any], vertical: str = "entertainment") -> dict[str, Any]:
    payload = dict(payload)
    for key in ["headline", "snapshot", "title", "site", "site_name", "vertical", "updated_at", "generated_at", "published_at"]:
        if key in payload:
            payload[key] = clean_text(payload.get(key))
    for list_key in ["homepage_cards", "live_newsroom", "editor_signals"]:
        if isinstance(payload.get(list_key), list):
            payload[list_key] = [normalize_card(item, vertical) if isinstance(item, dict) else item for item in payload[list_key]]
            payload[list_key] = [item for item in payload[list_key] if not isinstance(item, dict) or clean_text(item.get("headline") or item.get("title"))]
    if isinstance(payload.get("sections"), list):
        payload["sections"] = [normalize_card(section, vertical) if isinstance(section, dict) else section for section in payload["sections"]]
        payload["sections"] = [section for section in payload["sections"] if not isinstance(section, dict) or clean_text(section.get("headline") or section.get("title"))]
    elif isinstance(payload.get("sections"), dict):
        payload["sections"] = {k: normalize_card(v, vertical) if isinstance(v, dict) else v for k, v in payload["sections"].items()}
        payload["sections"] = {k: v for k, v in payload["sections"].items() if not isinstance(v, dict) or clean_text(v.get("headline") or v.get("title"))}
    return payload
