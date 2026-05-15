import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CANDIDATES = [
    ROOT / "public" / "latest_report.json",
    ROOT / "latest_report.json",
]

REPORT_PATH = next((p for p in CANDIDATES if p.exists()), None)

if REPORT_PATH is None:
    print("ENTERTAINMENT AGENT FAIL: No latest_report.json found.")
    sys.exit(1)

try:
    data = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"ENTERTAINMENT AGENT FAIL: Could not parse {REPORT_PATH}: {exc}")
    sys.exit(1)

failures = []
warnings = []

def as_list(value):
    return value if isinstance(value, list) else []

live_newsroom = as_list(data.get("live_newsroom"))
editor_signals = as_list(data.get("editor_signals"))
key_storylines = as_list(data.get("key_storylines"))
sections = as_list(data.get("sections"))

# Entertainment uses sections, not homepage_cards.
public_items = live_newsroom + key_storylines + sections
all_items = public_items + editor_signals

if len(live_newsroom) < 5:
    failures.append(f"Live newsroom has only {len(live_newsroom)} items; expected at least 5.")

if len(editor_signals) < 3:
    warnings.append(f"Editor signals has only {len(editor_signals)} items; expected at least 3.")

if len(key_storylines) < 3:
    warnings.append(f"Key storylines has only {len(key_storylines)} items; expected at least 3.")

if len(sections) < 6:
    failures.append(f"Sections has only {len(sections)} items; expected at least 6.")

def pick_url(item):
    if not isinstance(item, dict):
        return ""
    for key in ["url", "link", "href", "source_url"]:
        val = item.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""

def pick_headline(item):
    if not isinstance(item, dict):
        return ""
    for key in ["headline", "title", "name"]:
        val = item.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""

def pick_text(item):
    if not isinstance(item, dict):
        return ""

    parts = []
    for key in [
        "headline", "title", "name", "summary", "description", "snapshot",
        "dek", "context", "signal", "label"
    ]:
        val = item.get(key)
        if isinstance(val, str):
            parts.append(val)

    for key in ["key_data", "why_it_matters", "what_to_watch", "bullets", "items"]:
        val = item.get(key)
        if isinstance(val, list):
            for entry in val:
                if isinstance(entry, str):
                    parts.append(entry)
                elif isinstance(entry, dict):
                    parts.append(pick_text(entry))

    return " ".join(parts).strip()

def pick_source(item):
    if not isinstance(item, dict):
        return ""

    for key in ["source", "publisher", "outlet", "site"]:
        val = item.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip().lower()

    url = pick_url(item)
    if url:
        return re.sub(r"^https?://(www\.)?", "", url).split("/")[0].lower()

    return ""

sources = [pick_source(item) for item in all_items if pick_source(item)]
source_counts = Counter(sources)

if len(sources) >= 6 and len(source_counts) < 3:
    failures.append(f"Only {len(source_counts)} sources found across Entertainment output; expected at least 3.")

variety_count = sum(count for source, count in source_counts.items() if "variety" in source.lower())
if len(sources) >= 6 and variety_count / len(sources) > 0.55:
    failures.append(f"Variety source drift detected: {variety_count}/{len(sources)} sourced items are Variety.")

bad_urls = []
for item in live_newsroom + editor_signals:
    headline = pick_headline(item)
    url = pick_url(item)
    if not url or not url.startswith(("http://", "https://")):
        bad_urls.append(headline or "[missing headline]")

if bad_urls:
    failures.append("Missing or invalid URLs found: " + "; ".join(bad_urls[:8]))

generic_phrases = [
    "entertainment watch",
    "latest entertainment headlines",
    "entertainment roundup",
    "rss",
    "feed",
    "fallback",
    "pipeline",
    "placeholder",
    "no summary available",
    "story continues",
]

for item in all_items:
    text = pick_text(item).lower()
    headline = pick_headline(item)
    found = [phrase for phrase in generic_phrases if phrase in text]
    if found:
        failures.append(f"Generic/internal language found in '{headline}': {', '.join(found)}")

category_patterns = {
    "film": r"\b(movie|movies|film|films|box office|cannes|trailer|cinema|theater|theatrical)\b",
    "tv_streaming": r"\b(tv|series|streaming|netflix|hulu|disney\+|disney plus|hbo|max|peacock|paramount\+|prime video|apple tv|season|episode)\b",
    "music": r"\b(music|album|song|songs|tour|concert|festival|spotify|billboard|artist|singer|rapper|band)\b",
    "business": r"\b(studio|studios|hollywood|deal|merger|acquisition|earnings|box office|rights|licensing|strike|guild|lawsuit|executive|warner|disney|paramount|sony|netflix|youtube)\b",
    "celebrity": r"\b(actor|actress|celebrity|stars|star|red carpet|interview|host|late-night|late night|trevor noah|kevin hart)\b",
}

category_hits = Counter()
film_heavy_items = 0

for item in public_items:
    text = pick_text(item).lower()
    for category, pattern in category_patterns.items():
        if re.search(pattern, text, flags=re.I):
            category_hits[category] += 1
    if re.search(category_patterns["film"], text, flags=re.I):
        film_heavy_items += 1

if len(public_items) >= 8:
    active_categories = [category for category, count in category_hits.items() if count > 0]
    if len(active_categories) < 3:
        failures.append(f"Entertainment mix too narrow: only {len(active_categories)} categories detected: {active_categories}")

    film_share = film_heavy_items / len(public_items)
    if film_share > 0.65:
        failures.append(f"Film-heavy drift detected: {film_heavy_items}/{len(public_items)} public items look film/movie-heavy.")

weak_headlines = []
for item in live_newsroom:
    headline = pick_headline(item)
    if not headline:
        weak_headlines.append("[missing headline]")
    elif len(headline.split()) < 4 or headline.endswith("."):
        weak_headlines.append(headline)

if weak_headlines:
    failures.append("Weak Entertainment headlines found: " + "; ".join(weak_headlines[:8]))

print("Entertainment Agent Check")
print(f"Report: {REPORT_PATH}")
print(f"Live newsroom items: {len(live_newsroom)}")
print(f"Editor signals: {len(editor_signals)}")
print(f"Key storylines: {len(key_storylines)}")
print(f"Sections: {len(sections)}")
print("Sources:", dict(source_counts))
print("Categories:", dict(category_hits))

if warnings:
    print("Warnings:")
    for warning in warnings:
        print(f"- {warning}")

if failures:
    print("ENTERTAINMENT AGENT FAIL")
    for failure in failures:
        print(f"- {failure}")
    sys.exit(1)

print("ENTERTAINMENT AGENT PASS")
