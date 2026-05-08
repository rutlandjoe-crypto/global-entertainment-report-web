import html
import json
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
JSON_PATH = PUBLIC_DIR / "latest_report.json"
TXT_PATH = BASE_DIR / "entertainment_report.txt"

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

ET_ZONE = ZoneInfo("America/New_York")
MAX_ITEM_AGE_HOURS = 24 * 14
REQUEST_TIMEOUT_SECONDS = 25
RSS_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 "
    "GlobalEntertainmentReport/1.0"
)

FEEDS = {
    "film": [
        "https://variety.com/v/film/feed/",
        "https://deadline.com/v/film/feed/",
        "https://www.hollywoodreporter.com/c/movies/movie-news/feed/",
        "https://news.google.com/rss/search?q=film+movies+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "tv": [
        "https://variety.com/v/tv/feed/",
        "https://deadline.com/v/tv/feed/",
        "https://www.hollywoodreporter.com/c/tv/tv-news/feed/",
        "https://news.google.com/rss/search?q=television+tv+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "streaming": [
        "https://variety.com/v/tv/streaming/feed/",
        "https://deadline.com/v/tv/feed/",
        "https://news.google.com/rss/search?q=streaming+netflix+hulu+disney+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "music": [
        "https://variety.com/v/music/feed/",
        "https://www.billboard.com/feed/",
        "https://news.google.com/rss/search?q=music+entertainment+billboard&hl=en-US&gl=US&ceid=US:en",
    ],
    "awards": [
        "https://variety.com/v/awards/feed/",
        "https://www.hollywoodreporter.com/c/awards/feed/",
        "https://news.google.com/rss/search?q=entertainment+awards+oscars+emmys+grammys&hl=en-US&gl=US&ceid=US:en",
    ],
    "box_office": [
        "https://www.hollywoodreporter.com/c/movies/movie-news/feed/",
        "https://variety.com/v/film/box-office/feed/",
        "https://news.google.com/rss/search?q=box+office+movies+hollywood&hl=en-US&gl=US&ceid=US:en",
    ],
    "celebrity": [
        "https://people.com/feed/",
        "https://news.google.com/rss/search?q=celebrity+entertainment+news&hl=en-US&gl=US&ceid=US:en",
    ],
    "hollywood": [
        "https://variety.com/feed/",
        "https://deadline.com/feed/",
        "https://www.hollywoodreporter.com/feed/",
        "https://news.google.com/rss/search?q=hollywood+entertainment+industry&hl=en-US&gl=US&ceid=US:en",
    ],
    "gaming": [
        "https://www.ign.com/rss/articles/feed?tags=games",
        "https://news.google.com/rss/search?q=gaming+video+games+entertainment&hl=en-US&gl=US&ceid=US:en",
    ],
    "media": [
        "https://variety.com/v/biz/feed/",
        "https://deadline.com/v/business/feed/",
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


@dataclass
class FeedStats:
    category: str
    url: str
    status_code: str = "not-requested"
    final_url: str = ""
    item_count: int = 0
    accepted_count: int = 0
    rejected_count: int = 0
    rejection_reasons: dict[str, int] = field(default_factory=dict)

    def reject(self, reason: str) -> None:
        self.rejected_count += 1
        self.rejection_reasons[reason] = self.rejection_reasons.get(reason, 0) + 1

    def log(self) -> None:
        reasons = ", ".join(f"{key}={value}" for key, value in sorted(self.rejection_reasons.items()))
        print(
            f"[{timestamp()}] RSS feed category={self.category} url={self.url} "
            f"status={self.status_code} final_url={self.final_url or self.url} "
            f"items={self.item_count} accepted={self.accepted_count} "
            f"rejected={self.rejected_count} reasons={reasons or 'none'}"
        )


def now_et() -> datetime:
    return datetime.now(ET_ZONE)


def timestamp() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = html.unescape(str(value))
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def parse_datetime(value: str) -> datetime | None:
    value = clean_text(value)
    if not value:
        return None

    try:
        dt = parsedate_to_datetime(value)
    except Exception:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ET_ZONE)


def format_datetime(dt: datetime | None) -> str:
    return (dt or now_et()).astimezone(ET_ZONE).strftime("%Y-%m-%d %I:%M:%S %p ET")


def source_name_from_url(url: str) -> str:
    host = re.sub(r"^www\.", "", urllib.request.urlparse(url).netloc.lower())
    names = {
        "variety.com": "Variety",
        "deadline.com": "Deadline",
        "hollywoodreporter.com": "The Hollywood Reporter",
        "billboard.com": "Billboard",
        "people.com": "People",
        "ign.com": "IGN",
        "news.google.com": "Google News",
    }
    return names.get(host, host or "Entertainment source")


def fetch_url(url: str) -> tuple[bytes, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": RSS_USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        },
    )

    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        status = str(getattr(response, "status", response.getcode()))
        final_url = response.geturl()
        return response.read(), status, final_url


def child_text(item: ET.Element, names: list[str]) -> str:
    for name in names:
        value = item.findtext(name)
        if value:
            return clean_text(value)
    return ""


def parse_rss_items(raw: bytes) -> list[dict]:
    root = ET.fromstring(raw)
    items: list[dict] = []

    for item in root.findall(".//item"):
        enclosure = item.find("enclosure")
        link = child_text(item, ["link", "guid"])
        items.append(
            {
                "title": child_text(item, ["title"]),
                "summary": child_text(item, ["description", "{http://purl.org/rss/1.0/modules/content/}encoded"]),
                "link": link,
                "published_dt": parse_datetime(child_text(item, ["pubDate", "{http://purl.org/dc/elements/1.1/}date"])),
                "image": enclosure.attrib.get("url", "") if enclosure is not None else "",
            }
        )

    for item in root.findall(".//{http://www.w3.org/2005/Atom}entry"):
        link = ""
        for link_node in item.findall("{http://www.w3.org/2005/Atom}link"):
            href = link_node.attrib.get("href", "")
            rel = link_node.attrib.get("rel", "alternate")
            if href and rel == "alternate":
                link = clean_text(href)
                break
        items.append(
            {
                "title": child_text(item, ["{http://www.w3.org/2005/Atom}title"]),
                "summary": child_text(item, ["{http://www.w3.org/2005/Atom}summary", "{http://www.w3.org/2005/Atom}content"]),
                "link": link,
                "published_dt": parse_datetime(child_text(item, ["{http://www.w3.org/2005/Atom}updated", "{http://www.w3.org/2005/Atom}published"])),
                "image": "",
            }
        )

    return items


def rejection_reason(item: dict, seen: set[str]) -> str:
    title = clean_text(item.get("title", ""))
    link = clean_text(item.get("link", ""))
    published = item.get("published_dt")

    if not title:
        return "missing-title"
    if title.lower() in seen:
        return "duplicate-title"
    if not link.startswith(("http://", "https://")):
        return "missing-valid-link"
    if published:
        age_hours = (now_et() - published).total_seconds() / 3600
        if age_hours > MAX_ITEM_AGE_HOURS:
            return f"stale-over-{MAX_ITEM_AGE_HOURS}h"
    return ""


def normalize_item(item: dict, category: str, url: str, index: int) -> dict:
    title = clean_text(item.get("title", ""))
    summary = clean_text(item.get("summary", ""))
    published = item.get("published_dt")
    source_name = source_name_from_url(url)

    if summary and len(summary) > 320:
        summary = summary[:317].rstrip() + "..."
    if not summary:
        summary = title

    return {
        "id": f"{category}-{index}-{abs(hash((title, item.get('link'))))}",
        "key": f"{category}-{index}-{abs(hash((title, item.get('link'))))}",
        "category": LABELS.get(category, category.replace("_", " ").title()),
        "label": LABELS.get(category, category.replace("_", " ").title()),
        "headline": title,
        "title": title,
        "snapshot": summary,
        "summary": summary,
        "url": clean_text(item.get("link", "")),
        "source": source_name,
        "source_name": source_name,
        "source_feed": url,
        "published_at": format_datetime(published),
        "image": clean_text(item.get("image", "")),
        "freshness_status": "fresh" if published else "accepted-undated",
        "story_type": "rss_headline",
        "priority_score": max(0, 100 - index),
        "key_data": [title],
        "why_it_matters": [
            "This current entertainment headline can affect audience attention, coverage priorities, talent leverage or media business strategy."
        ],
        "what_to_watch": [
            "Monitor confirmed follow-up reporting, platform response, studio movement, audience reaction and related industry impact."
        ],
    }


def fetch_category(category: str, urls: list[str], limit: int = 8) -> tuple[list[dict], list[FeedStats]]:
    collected: list[dict] = []
    stats: list[FeedStats] = []
    seen_titles: set[str] = set()

    for url in urls:
        feed_stats = FeedStats(category=category, url=url)
        try:
            raw, status, final_url = fetch_url(url)
            feed_stats.status_code = status
            feed_stats.final_url = final_url
            raw_items = parse_rss_items(raw)
            feed_stats.item_count = len(raw_items)

            for raw_item in raw_items:
                reason = rejection_reason(raw_item, seen_titles)
                if reason:
                    feed_stats.reject(reason)
                    continue

                seen_titles.add(clean_text(raw_item["title"]).lower())
                feed_stats.accepted_count += 1
                collected.append(normalize_item(raw_item, category, url, len(collected)))

                if len(collected) >= limit:
                    break
        except urllib.error.HTTPError as exc:
            feed_stats.status_code = str(exc.code)
            feed_stats.reject(f"http-error-{exc.code}")
        except ET.ParseError as exc:
            feed_stats.status_code = feed_stats.status_code or "parse-error"
            feed_stats.reject(f"xml-parse-error:{clean_text(str(exc))[:80]}")
        except Exception as exc:
            feed_stats.status_code = "request-error"
            feed_stats.reject(clean_text(str(exc))[:120] or "request-error")
        finally:
            feed_stats.log()
            stats.append(feed_stats)

        if len(collected) >= limit:
            break

    return collected[:limit], stats


def build_section(category: str, items: list[dict]) -> dict:
    label = LABELS.get(category, category.replace("_", " ").title())

    if items:
        headline = items[0]["headline"]
        snapshot = f"{label} coverage is updating with {len(items)} current RSS headline item(s)."
    else:
        headline = f"{label} coverage is waiting for fresh source data."
        snapshot = "No fresh RSS items were available during this run."

    return {
        "key": category,
        "name": label,
        "title": f"{label} Report",
        "headline": headline,
        "snapshot": snapshot,
        "key_storylines": [item["headline"] for item in items[:5]],
        "watch_list": [item["headline"] for item in items],
        "homepage_cards": items,
        "items": items,
        "updated_at": timestamp(),
    }


def fallback_cards(generated: str) -> list[dict]:
    return [
        {
            "id": "fallback-entertainment-0",
            "key": "fallback-entertainment-0",
            "category": "Entertainment Watch",
            "label": "Entertainment Watch",
            "headline": "Entertainment coverage is waiting for fresh RSS source data.",
            "title": "Entertainment coverage is waiting for fresh RSS source data.",
            "snapshot": "No fresh RSS items were available during this run.",
            "summary": "No fresh RSS items were available during this run.",
            "url": "https://variety.com",
            "source": "Fallback",
            "source_name": "Fallback",
            "published_at": generated,
            "freshness_status": "fallback",
            "key_data": ["No real RSS item passed ingestion during this run."],
            "why_it_matters": ["Fallback cards should only appear when every real feed fails or returns no acceptable item."],
            "what_to_watch": ["Check RSS fetch logs for status codes, parse errors, item counts and rejection reasons."],
        }
    ]


def build_report() -> dict:
    generated = timestamp()
    sections_map = {}
    section_order = []
    all_cards: list[dict] = []
    all_stats: list[FeedStats] = []

    for category, urls in FEEDS.items():
        items, stats = fetch_category(category, urls)
        sections_map[category] = build_section(category, items)
        section_order.append(category)
        all_cards.extend(items)
        all_stats.extend(stats)

    source_diverse_cards: list[dict] = []
    source_counts: dict[str, int] = {}
    for card in all_cards:
        source = card.get("source_name", "")
        if source_counts.get(source, 0) >= 4 and len(source_diverse_cards) >= 12:
            continue
        source_counts[source] = source_counts.get(source, 0) + 1
        source_diverse_cards.append(card)

    homepage_cards = source_diverse_cards[:24] if source_diverse_cards else fallback_cards(generated)
    accepted_total = len(all_cards)
    failed_feed_count = sum(1 for stat in all_stats if not stat.accepted_count)

    headline = homepage_cards[0]["headline"]
    snapshot = (
        f"Global Entertainment Report accepted {accepted_total} real RSS item(s) across "
        f"{len(all_stats)} checked feed request(s)."
        if accepted_total
        else "No fresh RSS items were available during this run."
    )

    return {
        "title": "GLOBAL ENTERTAINMENT REPORT",
        "site": "Global Entertainment Report",
        "site_name": "Global Entertainment Report",
        "vertical": "Entertainment",
        "generated_date": generated,
        "generated_at": generated,
        "updated_at": generated,
        "headline": headline,
        "snapshot": snapshot,
        "key_storylines": [card["headline"] for card in homepage_cards[:8]],
        "substack_url": "https://globalentertainmentreport.substack.com/",
        "x_handle": "@GlobalSportsRp",
        "source_mode": "live RSS ingestion" if accepted_total else "fallback; every real feed failed or returned no accepted item",
        "freshness": {
            "max_item_age_hours": MAX_ITEM_AGE_HOURS,
            "accepted_real_items": accepted_total,
            "checked_feeds": len(all_stats),
            "feeds_without_accepted_items": failed_feed_count,
        },
        "feed_audit": [
            {
                "category": stat.category,
                "url": stat.url,
                "status_code": stat.status_code,
                "final_url": stat.final_url or stat.url,
                "item_count": stat.item_count,
                "accepted_count": stat.accepted_count,
                "rejected_count": stat.rejected_count,
                "rejection_reasons": stat.rejection_reasons,
            }
            for stat in all_stats
        ],
        "section_order": section_order,
        "sections_map": sections_map,
        "sections": [sections_map[key] for key in section_order],
        "homepage_cards": homepage_cards,
        "live_newsroom": homepage_cards[:12],
        "editor_signals": homepage_cards[12:24] or homepage_cards[:12],
    }


def write_text_report(report: dict) -> None:
    lines = [
        report.get("title", "GLOBAL ENTERTAINMENT REPORT"),
        f"Updated: {report.get('generated_date', timestamp())}",
        "",
        "HEADLINE",
        str(report.get("headline", "")),
        "",
        "SNAPSHOT",
        str(report.get("snapshot", "")),
        "",
        "KEY STORYLINES",
    ]

    for item in report.get("key_storylines", []):
        lines.append(f"- {item}")

    lines.extend(["", "LIVE NEWSROOM"])
    for card in report.get("homepage_cards", []):
        lines.extend(
            [
                "",
                str(card.get("category", "Entertainment")).upper(),
                str(card.get("headline", "")),
                str(card.get("snapshot", "")),
                f"Source: {card.get('source_name', '')} | {card.get('url', '')}",
            ]
        )

    TXT_PATH.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def main() -> None:
    print(f"[{timestamp()}] ENTERTAINMENT REPORT STARTED")
    report = build_report()
    JSON_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    write_text_report(report)
    print(f"[{timestamp()}] WROTE: {JSON_PATH}")
    print(f"[{timestamp()}] WROTE: {TXT_PATH}")
    print(f"[{timestamp()}] ENTERTAINMENT REPORT COMPLETE")


if __name__ == "__main__":
    main()
