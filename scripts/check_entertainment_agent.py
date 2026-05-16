import json
import re
import sys
from collections import Counter
from pathlib import Path

REPORT_PATH = Path("public/latest_report.json")

BANNED_VISIBLE_TERMS = [
    "fallback",
    "placeholder",
    "generic",
    "test data",
    "sample data",
    "internal",
]

VISIBLE_TEXT_KEYS = {
    "title",
    "headline",
    "name",
    "summary",
    "description",
    "dek",
    "body",
    "text",
    "analysis",
    "context",
    "why_it_matters",
    "what_it_means",
    "takeaway",
    "label",
    "category",
}

IGNORED_KEYS = {
    "url",
    "link",
    "href",
    "source_url",
    "sourceUrl",
    "canonical_url",
    "image",
    "image_url",
    "thumbnail",
    "id",
    "slug",
    "guid",
    "rss",
    "rss_url",
    "feed",
    "feed_url",
    "published",
    "updated",
    "created_at",
    "updated_at",
    "generated_at",
    "source",
}

def load_report():
    if not REPORT_PATH.exists():
        fail([f"Missing report file: {REPORT_PATH}"])

    try:
        return json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        fail([f"Could not read JSON report: {exc}"])

def as_list(value):
    return value if isinstance(value, list) else []

def normalize_source(value):
    value = str(value or "").lower()
    value = value.replace("www.", "")

    if "variety" in value:
        return "variety"
    if "deadline" in value:
        return "deadline"
    if "hollywoodreporter" in value or "hollywood reporter" in value:
        return "hollywoodreporter"
    if "thewrap" in value or "the wrap" in value:
        return "thewrap"
    if "billboard" in value:
        return "billboard"
    if "indiewire" in value:
        return "indiewire"
    if "rollingstone" in value or "rolling stone" in value:
        return "rollingstone"
    if "polygon" in value:
        return "polygon"
    if "ign" in value:
        return "ign"
    if "apnews" in value or value == "ap":
        return "ap"
    if "reuters" in value:
        return "reuters"
    if "yahoo" in value:
        return "yahoo"
    if "google" in value:
        return "google news"
    if "guardian" in value:
        return "guardian"

    return value or "unknown"


def collect_sources(items):
    counter = Counter()
    seen = set()

    for item in items:
        if not isinstance(item, dict):
            continue

        unique_key = (
            item.get("url")
            or item.get("link")
            or item.get("canonical_url")
            or item.get("title")
            or item.get("headline")
        )

        if unique_key:
            unique_key = str(unique_key).strip().lower()
            if unique_key in seen:
                continue
            seen.add(unique_key)

        raw = (
            item.get("source")
            or item.get("publisher")
            or item.get("outlet")
            or item.get("source_name")
            or item.get("site")
            or item.get("domain")
            or item.get("url")
            or item.get("link")
        )

        counter[normalize_source(raw)] += 1

    return dict(counter)

def collect_categories(items):
    counter = Counter()

    for item in items:
        if not isinstance(item, dict):
            continue

        category = item.get("category") or item.get("section") or item.get("vertical") or "uncategorized"
        category = str(category).lower().strip().replace(" ", "_")
        counter[category] += 1

    return dict(counter)

def iter_visible_strings(obj):
    if isinstance(obj, dict):
        for key, value in obj.items():
            key_text = str(key)

            if key_text in IGNORED_KEYS:
                continue

            if isinstance(value, str):
                if key_text in VISIBLE_TEXT_KEYS:
                    yield key_text, value
            else:
                yield from iter_visible_strings(value)

    elif isinstance(obj, list):
        for value in obj:
            yield from iter_visible_strings(value)

def find_bad_visible_language(items):
    problems = []

    patterns = [
        (term, re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE))
        for term in BANNED_VISIBLE_TERMS
    ]

    for item in items:
        if not isinstance(item, dict):
            continue

        title = item.get("title") or item.get("headline") or "Untitled item"

        for key, text in iter_visible_strings(item):
            for term, pattern in patterns:
                if pattern.search(text):
                    problems.append(
                        f"Generic/internal language found in '{title}': {term}"
                    )

    return problems

def fail(errors):
    print("ENTERTAINMENT AGENT FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

def main():
    report = load_report()

    homepage_cards = as_list(report.get("homepage_cards"))
    live_newsroom = as_list(report.get("live_newsroom"))
    editor_signals = as_list(report.get("editor_signals"))
    key_storylines = as_list(report.get("key_storylines"))
    sections = as_list(report.get("sections"))

    all_items = homepage_cards + live_newsroom + editor_signals + key_storylines

    for section in sections:
        if isinstance(section, dict):
            all_items.extend(as_list(section.get("items")))
            all_items.extend(as_list(section.get("stories")))
            all_items.extend(as_list(section.get("cards")))

    sources = collect_sources(all_items)
    categories = collect_categories(all_items)

    print("Entertainment Agent Check")
    print(f"Report: {REPORT_PATH.resolve()}")
    print(f"Live newsroom items: {len(live_newsroom)}")
    print(f"Editor signals: {len(editor_signals)}")
    print(f"Key storylines: {len(key_storylines)}")
    print(f"Sections: {len(sections)}")
    print(f"Sources: {sources}")
    print(f"Categories: {categories}")

    errors = []

    if len(live_newsroom) < 5:
        errors.append(f"Expected at least 5 live newsroom items, found {len(live_newsroom)}")

    if len(editor_signals) < 5:
        errors.append(f"Expected at least 5 editor signals, found {len(editor_signals)}")

    if len(key_storylines) < 3:
        errors.append(f"Expected at least 3 key storylines, found {len(key_storylines)}")

    if len(sections) < 4:
        errors.append(f"Expected at least 4 sections, found {len(sections)}")

    if len([source for source in sources if source != "unknown"]) < 3:
        errors.append("Expected at least 3 recognizable source groups")

    variety_count = sources.get("variety", 0)
    total_source_count = sum(sources.values()) or 1
    variety_share = variety_count / total_source_count

    if variety_share > 0.40:
        errors.append(
            f"Variety source share too high: {variety_count}/{total_source_count}"
        )

    known_sources = {
        source: count
        for source, count in sources.items()
        if source != "unknown"
    }

    if len(known_sources) < 3:
        errors.append(
            f"Expected at least 3 recognizable source groups, found {len(known_sources)}"
        )

    if known_sources:
        top_source, top_count = max(known_sources.items(), key=lambda item: item[1])
        top_share = top_count / total_source_count
        if top_share > 0.50:
            errors.append(
                f"Single-source dominance too high: {top_source} {top_count}/{total_source_count}"
            )

    major_mix = {
        "deadline",
        "hollywoodreporter",
        "variety",
        "indiewire",
        "billboard",
        "thewrap",
        "rollingstone",
        "polygon",
        "ign",
    }
    major_present = sorted(source for source in known_sources if source in major_mix)
    if len(major_present) < 3:
        errors.append(
            "Expected at least 3 major entertainment/media source groups; "
            f"found {major_present}"
        )

    bad_language = find_bad_visible_language(all_items)
    errors.extend(bad_language)

    if errors:
        fail(errors)

    print("ENTERTAINMENT AGENT PASS")

if __name__ == "__main__":
    main()


