from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

try:
    import tweepy
except ImportError:
    tweepy = None


# =========================================================
# CONFIG
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

TIMEZONE = ZoneInfo("America/New_York")
REQUEST_TIMEOUT = 30
GIT_TIMEOUT = 60

DISCLAIMER = (
    "This report is an automated summary intended to support, not replace, human sports journalism."
)

SUBSTACK_URL = "https://globalsportsreport.substack.com/"
X_HANDLE = "@GlobalSportsRep"

WEBSITE_PUBLIC_DIR = Path(
    os.getenv("GSR_WEBSITE_PUBLIC_DIR", str(BASE_DIR / "public"))
)
WEBSITE_REPO_DIR = Path(
    os.getenv("GSR_WEBSITE_REPO_DIR", str(BASE_DIR))
)

GLOBAL_REPORT_FILE = BASE_DIR / "global_sports_report.txt"
LATEST_REPORT_TXT_FILE = BASE_DIR / "latest_report.txt"
LATEST_REPORT_JSON_FILE = BASE_DIR / "latest_report.json"
LATEST_REPORT_PREVIOUS_JSON_FILE = BASE_DIR / "latest_report.previous.json"

SUBSTACK_POST_FILE = BASE_DIR / "substack_post.txt"
SUBSTACK_HTML_FILE = BASE_DIR / "substack_post.html"
TELEGRAM_POST_FILE = BASE_DIR / "telegram_post.txt"
TWITTER_THREAD_FILE = BASE_DIR / "twitter_thread.txt"
TWITTER_HASH_FILE = BASE_DIR / ".last_twitter_hash.txt"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()

TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "").strip()
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "").strip()
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN", "").strip()
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "").strip()
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "").strip()

RUNNING_IN_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS", "").lower() == "true"
DISABLE_SOCIAL_POSTS = os.getenv("GSR_DISABLE_SOCIAL_POSTS", "").lower() in {
    "1",
    "true",
    "yes",
}

REPORT_FILES: list[tuple[str, Path]] = [
    ("MLB", BASE_DIR / "mlb_report.txt"),
    ("MLB_ADVANCED", BASE_DIR / "mlb_advanced_report.txt"),
    ("NBA", BASE_DIR / "nba_report.txt"),
    ("NBA_ADVANCED", BASE_DIR / "nba_advanced_report.txt"),
    ("NHL", BASE_DIR / "nhl_report.txt"),
    ("NFL", BASE_DIR / "nfl_report.txt"),
    ("NFL_ADVANCED", BASE_DIR / "nfl_advanced_report.txt"),
    ("NFL_DRAFT", BASE_DIR / "nfl_draft_signals.txt"),
    ("NCAAFB", BASE_DIR / "ncaafb_report.txt"),
    ("SOCCER", BASE_DIR / "soccer_report.txt"),
    ("FANTASY", BASE_DIR / "fantasy_report.txt"),
    ("BETTING_ODDS", BASE_DIR / "betting_odds_report.txt"),
]

SECTION_ORDER = [
    "MLB",
    "MLB_ADVANCED",
    "NBA",
    "NBA_ADVANCED",
    "NHL",
    "NFL",
    "NFL_ADVANCED",
    "NFL_DRAFT",
    "NCAAFB",
    "SOCCER",
    "FANTASY",
    "BETTING_ODDS",
]

DISPLAY_LABELS = {
    "MLB": "MLB",
    "MLB_ADVANCED": "MLB ADVANCED",
    "NBA": "NBA",
    "NBA_ADVANCED": "NBA ADVANCED",
    "NHL": "NHL",
    "NFL": "NFL",
    "NFL_ADVANCED": "NFL ADVANCED",
    "NFL_DRAFT": "NFL DRAFT",
    "NCAAFB": "NCAA FOOTBALL",
    "SOCCER": "SOCCER",
    "FANTASY": "FANTASY",
    "BETTING_ODDS": "BETTING ODDS",
}

SECTION_KEY_NORMALIZATION = {
    "MLB": "mlb",
    "MLB_ADVANCED": "mlb_advanced",
    "NBA": "nba",
    "NBA_ADVANCED": "nba_advanced",
    "NHL": "nhl",
    "NFL": "nfl",
    "NFL_ADVANCED": "nfl_advanced",
    "NFL_DRAFT": "nfl_draft",
    "NCAAFB": "ncaafb",
    "SOCCER": "soccer",
    "FANTASY": "fantasy",
    "BETTING_ODDS": "betting_odds",
}

ADVANCED_TO_BASE = {
    "MLB_ADVANCED": "MLB",
    "NBA_ADVANCED": "NBA",
    "NFL_ADVANCED": "NFL",
}

ADVANCED_COPY_FILES = {
    "MLB_ADVANCED": "mlb_advanced_report.txt",
    "NBA_ADVANCED": "nba_advanced_report.txt",
    "NFL_ADVANCED": "nfl_advanced_report.txt",
    "NFL_DRAFT": "nfl_draft_signals.txt",
    "NCAAFB": "ncaafb_report.txt",
}

STRUCTURED_JSON_PRIORITY = {
    "MLB": BASE_DIR / "mlb_report.json",
    "NBA": BASE_DIR / "nba_report.json",
    "NHL": BASE_DIR / "nhl_report.json",
    "NFL": BASE_DIR / "nfl_report.json",
    "NCAAFB": BASE_DIR / "ncaafb_report.json",
    "SOCCER": BASE_DIR / "soccer_report.json",
    "FANTASY": BASE_DIR / "fantasy_report.json",
}

HIDDEN_FIELDS = {"source_file", "disclaimer", "full_text", "full_report"}

TEXT_BLOCK_ORDER = [
    ("HEADLINE", "headline"),
    ("SNAPSHOT", "snapshot"),
    ("KEY STORYLINES", "key_storylines"),
    ("KEY DATA POINTS", "key_data_points"),
    ("WHY IT MATTERS", "why_it_matters"),
    ("CURRENT DATA AND ANALYTICS", "current_data_and_analytics"),
    ("STORY ANGLES", "story_angles"),
    ("WATCH LIST", "watch_list"),
    ("HISTORICAL CONTEXT", "historical_context"),
    ("STATCAST SNAPSHOT", "statcast_snapshot"),
    ("STATIC GRAPHIC", "static_graphic"),
    ("OUTLOOK", "outlook"),
    ("RANKINGS CONTEXT", "rankings_context"),
    ("PLAYER MOVES", "player_moves"),
    ("NEWS", "news"),
    ("SCHEDULE CONTEXT", "schedule_context"),
    ("LIVE OR ACTIVE CONTEXT", "live_or_active_context"),
    ("RESULTS CONTEXT", "results_context"),
    ("KEY NOTES", "key_notes"),
    ("KEY FANTASY TAKEAWAYS", "key_fantasy_takeaways"),
    ("YESTERDAY RESULTS", "yesterday_results"),
    ("YESTERDAY FINAL SCORES", "yesterday_final_scores"),
    ("YESTERDAY PLAYOFF RESULTS", "yesterday_playoff_results"),
    ("LIVE GAMES", "live_games"),
    ("TODAY LIVE", "today_live"),
    ("LIVE NOW", "live_now"),
    ("PLAYOFF LIVE", "playoff_live"),
    ("UPCOMING GAMES", "upcoming_games"),
    ("TODAY SCHEDULE", "today_schedule"),
    ("UPCOMING", "upcoming"),
    ("TODAY PLAYOFF SCHEDULE", "today_playoff_schedule"),
    ("PLAYOFF SCHEDULE", "playoff_schedule"),
    ("TODAY RESULTS", "today_results"),
    ("TODAY FINAL SCORES", "today_final_scores"),
    ("FINAL SCORES", "final_scores"),
    ("RECENT FINAL SCORES", "recent_final_scores"),
    ("DRAFT CALENDAR", "draft_calendar"),
    ("TOP 10 DRAFT ORDER", "top_10_draft_order"),
    ("FULL ROUND 1 ORDER", "full_round_1_order"),
    ("DAY 2 OPENING BOARD", "day_2_opening_board"),
    ("TEAM CAPITAL WATCH", "team_capital_watch"),
]


# =========================================================
# STATE
# =========================================================

FILES_WRITTEN: list[str] = []
WEBSITE_SYNC_COPIES: list[str] = []
WARNINGS: list[str] = []
CRITICAL_ERRORS: list[str] = []

telegram_ok = False
twitter_ok = False
website_push_ok = False


# =========================================================
# DATA CLASSES
# =========================================================

@dataclass
class SectionReport:
    key: str
    name: str
    title: str
    text: str
    content: str
    headline: str
    key_storylines: list[str]
    snapshot: str
    source_file: str
    exists: bool
    updated_at: str = ""
    structured_sections: dict[str, Any] | None = None
    games: dict[str, list[str]] = field(default_factory=dict)
    advanced_payload: dict[str, Any] | None = None


# =========================================================
# HELPERS
# =========================================================

def now_et() -> datetime:
    return datetime.now(TIMEZONE)


def timestamp_string() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def report_date() -> str:
    return now_et().strftime("%Y-%m-%d")


def log(message: str) -> None:
    print(f"[{timestamp_string()}] {message}", flush=True)


def normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def clean_text(text: str) -> str:
    if not text:
        return ""

    replacements = {
        "â€™": "’",
        "â€˜": "‘",
        "â€œ": '"',
        "â€\x9d": '"',
        "â€”": "—",
        "â€“": "–",
        "â€¦": "…",
        "Â ": " ",
        "Â": "",
        "Ã©": "é",
        "Ã¨": "è",
        "Ã¡": "á",
        "Ã³": "ó",
        "Ã±": "ñ",
        "Ã¼": "ü",
        "Ã–": "Ö",
        "Ã¶": "ö",
        "Ã¤": "ä",
        "\ufeff": "",
    }

    text = normalize_newlines(text)
    for bad, good in replacements.items():
        text = text.replace(bad, good)

    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_line_spacing(text: str) -> str:
    lines = [line.rstrip() for line in normalize_newlines(text).splitlines()]
    return "\n".join(lines).strip()


def strip_generated_lines(text: str) -> str:
    lines = []
    for line in normalize_newlines(text).splitlines():
        stripped = line.strip()
        lower = stripped.lower()
        if lower.startswith("generated:") or lower.startswith("updated:"):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def strip_duplicate_disclaimer(text: str) -> str:
    cleaned = re.sub(re.escape(DISCLAIMER), "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def safe_read_text(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return clean_text(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        return clean_text(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception as exc:
        WARNINGS.append(f"Could not read {path.name}: {exc}")
        log(f"WARNING: Could not read {path.name}: {exc}")
        return ""


def safe_read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw = path.read_text(encoding="utf-8", errors="ignore")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def safe_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    FILES_WRITTEN.append(str(path))
    log(f"Saved: {path}")


def safe_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    FILES_WRITTEN.append(str(path))
    log(f"Saved: {path}")


def get_file_timestamp(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        dt = datetime.fromtimestamp(path.stat().st_mtime, tz=TIMEZONE)
        return dt.strftime("%Y-%m-%d %I:%M:%S %p ET")
    except Exception:
        return None


def section_lines(text: str) -> list[str]:
    return [line.strip() for line in normalize_newlines(text).splitlines() if line.strip()]


def shorten(text: str, max_len: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_telegram_chunks(text: str, max_len: int = 3900) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_len:
        return [text]

    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        candidate = f"{current}\n\n{para}".strip() if current else para
        if len(candidate) <= max_len:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        if len(para) <= max_len:
            current = para
            continue

        words = para.split()
        temp = ""
        for word in words:
            test = word if not temp else f"{temp} {word}"
            if len(test) <= max_len:
                temp = test
            else:
                if temp:
                    chunks.append(temp)
                temp = word
        if temp:
            current = temp

    if current:
        chunks.append(current)

    return chunks


def run_subprocess(
    cmd: list[str],
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=check,
        timeout=GIT_TIMEOUT,
    )


def normalize_bullets(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    for line in lines:
        item = re.sub(r"^\s*[-•]\s*", "", str(line)).strip()
        if item:
            cleaned.append(item)
    return cleaned


def stringify_fragment(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return clean_text(value)

    if isinstance(value, (int, float, bool)):
        return str(value)

    if isinstance(value, (list, tuple, set)):
        parts = [stringify_fragment(item).strip() for item in value]
        return "\n".join([part for part in parts if part])

    if isinstance(value, dict):
        preferred_keys = [
            "content",
            "text",
            "body",
            "value",
            "headline",
            "snapshot",
            "title",
        ]
        parts: list[str] = []
        for key in preferred_keys:
            if key in value:
                text = stringify_fragment(value.get(key)).strip()
                if text:
                    parts.append(text)

        if parts:
            return "\n".join(parts)

        generic_parts = []
        for k, v in value.items():
            text = stringify_fragment(v).strip()
            if text:
                generic_parts.append(f"{k}: {text}")
        return "\n".join(generic_parts)

    return str(value)


def listify(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        cleaned = clean_text(value)
        return [cleaned] if cleaned else []

    if isinstance(value, (int, float, bool)):
        return [str(value)]

    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            out.extend(listify(item))
        return [item for item in out if item]

    if isinstance(value, dict):
        out: list[str] = []
        for item in value.values():
            out.extend(listify(item))
        return [entry for entry in out if entry]

    text = clean_text(str(value))
    return [text] if text else []


def render_block(header: str, value: Any) -> list[str]:
    items = listify(value)
    if not items:
        return []

    lines: list[str] = [header]
    if len(items) == 1 and "\n" not in items[0]:
        lines.append(items[0])
    else:
        for item in items:
            if "\n" in item:
                lines.append(item)
            else:
                lines.append(f"- {item}")
    return lines


def normalize_structured_snapshot(value: Any) -> str:
    return normalize_line_spacing(stringify_fragment(value))


def normalize_structured_key_storylines(sections: dict[str, Any]) -> list[str]:
    candidates = (
        listify(sections.get("key_storylines"))
        or listify(sections.get("key_data_points"))
        or listify(sections.get("current_data_and_analytics"))
        or listify(sections.get("story_angles"))
    )
    return normalize_bullets(candidates)[:6]


def prefix_lines(prefix: str, items: list[str]) -> list[str]:
    out: list[str] = []
    for item in items:
        cleaned = normalize_line_spacing(item)
        if cleaned:
            out.append(f"{prefix}: {cleaned}")
    return out


def parse_advanced_sections(text: str) -> dict[str, list[str]]:
    lines = [line.rstrip() for line in normalize_newlines(text).split("\n")]
    current_section = "notes"
    sections: dict[str, list[str]] = {"notes": []}

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if re.fullmatch(r"[A-Z][A-Z0-9 /&'\-]+", line):
            if line in {"HEADLINE", "KEY STORYLINES", "KEY DATA POINTS", "SNAPSHOT"}:
                continue
            if "REPORT" in line and "|" in line:
                continue
            current_section = line.lower().replace("&", " and ").replace("/", " ")
            current_section = re.sub(r"[^a-z0-9 ]+", "", current_section)
            current_section = re.sub(r"\s+", "_", current_section).strip("_") or "notes"
            sections.setdefault(current_section, [])
            continue

        if line.startswith("- "):
            sections.setdefault(current_section, []).append(line[2:].strip())
        else:
            sections.setdefault(current_section, []).append(line)

    return {k: normalize_bullets(v) for k, v in sections.items() if v}


def extract_named_block(text: str, header: str) -> str:
    pattern = rf"(?ms)^{re.escape(header)}\s*\n(.+?)(?:\n[A-Z][A-Z0-9_ /&\-']+\n|\Z)"
    match = re.search(pattern, text)
    return normalize_line_spacing(match.group(1)) if match else ""


def extract_headline(text: str) -> str:
    return extract_named_block(text, "HEADLINE")


def extract_snapshot(text: str) -> str:
    return extract_named_block(text, "SNAPSHOT")


def extract_key_storylines(text: str) -> list[str]:
    block = extract_named_block(text, "KEY STORYLINES")
    if not block:
        block = extract_named_block(text, "KEY DATA POINTS")
    if not block:
        return []
    return normalize_bullets(block.splitlines())


def extract_body_content(text: str) -> str:
    lines = normalize_newlines(text).split("\n")
    if lines and "|" in lines[0]:
        lines = lines[1:]
    return normalize_line_spacing("\n".join(lines).strip())


def is_advanced_key(key: str) -> bool:
    return key in ADVANCED_TO_BASE


def build_games_from_structured(key: str, sections: dict[str, Any]) -> dict[str, list[str]]:
    games = {"live": [], "upcoming": [], "final": []}

    if key == "NHL":
        games["live"] = listify(sections.get("today_live")) or listify(sections.get("playoff_live"))
        games["upcoming"] = (
            listify(sections.get("today_playoff_schedule"))
            or listify(sections.get("playoff_schedule"))
            or listify(sections.get("today_schedule"))
        )
        games["final"] = (
            listify(sections.get("today_final_scores"))
            or listify(sections.get("final_scores"))
        )
        games["final"].extend(listify(sections.get("yesterday_playoff_results")))
        return {k: normalize_bullets(v) for k, v in games.items()}

    if key == "SOCCER":
        leagues = sections.get("leagues")
        if isinstance(leagues, dict):
            live: list[str] = []
            upcoming: list[str] = []
            final: list[str] = []

            for league_name, payload in leagues.items():
                if not isinstance(payload, dict):
                    continue
                live.extend(prefix_lines(str(league_name), listify(payload.get("live_now")) or listify(payload.get("today_live"))))
                upcoming.extend(prefix_lines(str(league_name), listify(payload.get("upcoming")) or listify(payload.get("today_schedule"))))
                final.extend(prefix_lines(str(league_name), listify(payload.get("today_results"))))
                final.extend(prefix_lines(str(league_name), listify(payload.get("yesterday_results"))))

            games["live"] = live
            games["upcoming"] = upcoming
            games["final"] = final
            return {k: normalize_bullets(v) for k, v in games.items()}

    games["live"] = (
        listify(sections.get("live_now"))
        or listify(sections.get("today_live"))
        or listify(sections.get("live_games"))
    )
    games["upcoming"] = (
        listify(sections.get("upcoming"))
        or listify(sections.get("today_schedule"))
        or listify(sections.get("upcoming_games"))
        or listify(sections.get("today_playoff_schedule"))
    )
    games["final"] = (
        listify(sections.get("today_results"))
        or listify(sections.get("today_final_scores"))
        or listify(sections.get("final_scores"))
        or listify(sections.get("recent_final_scores"))
        or listify(sections.get("yesterday_results"))
    )
    return {k: normalize_bullets(v) for k, v in games.items()}


def build_structured_advanced_payload(
    key: str,
    title: str,
    updated_at: str,
    sections: dict[str, Any],
) -> dict[str, Any] | None:
    advanced: dict[str, Any] = {
        "title": title,
        "updated_at": updated_at,
    }

    for field_name in (
        "key_data_points",
        "why_it_matters",
        "current_data_and_analytics",
        "story_angles",
        "watch_list",
        "historical_context",
        "statcast_snapshot",
        "static_graphic",
        "outlook",
        "news",
        "player_moves",
        "rankings_context",
        "schedule_context",
        "results_context",
        "live_or_active_context",
        "key_notes",
        "key_fantasy_takeaways",
        "notes",
    ):
        values = listify(sections.get(field_name))
        if values:
            advanced[field_name] = values

    if key == "SOCCER":
        leagues = sections.get("leagues")
        if isinstance(leagues, dict):
            league_notes: list[str] = []
            for league_name, payload in leagues.items():
                if not isinstance(payload, dict):
                    continue
                counts = payload.get("counts", {})
                if isinstance(counts, dict):
                    league_notes.append(
                        f"{league_name}: {counts.get('yesterday_finals', 0)} finals from yesterday, "
                        f"{counts.get('today_live', 0)} live today, "
                        f"and {counts.get('today_upcoming', 0)} upcoming today."
                    )
            if league_notes:
                advanced["league_snapshot"] = league_notes

    return advanced if len(advanced) > 2 else None


def build_structured_content(key: str, title: str, sections: dict[str, Any]) -> str:
    parts: list[str] = []

    for header, field_name in TEXT_BLOCK_ORDER:
        value = sections.get(field_name)
        if value is None:
            continue
        block_lines = render_block(header, value)
        if block_lines:
            parts.append("\n".join(block_lines))

    if key == "SOCCER":
        leagues = sections.get("leagues")
        if isinstance(leagues, dict):
            for league_name, payload in leagues.items():
                if not isinstance(payload, dict):
                    continue
                league_header = str(league_name).upper()
                league_parts: list[str] = [league_header]

                yr = render_block("YESTERDAY RESULTS", payload.get("yesterday_results"))
                ln = render_block("LIVE NOW", payload.get("live_now") if payload.get("live_now") is not None else payload.get("today_live"))
                up = render_block("UPCOMING", payload.get("upcoming") if payload.get("upcoming") is not None else payload.get("today_schedule"))
                tr = render_block("TODAY RESULTS", payload.get("today_results"))

                for block in (yr, ln, up, tr):
                    if block:
                        league_parts.append("\n".join(block))

                if league_parts:
                    parts.append("\n\n".join(league_parts))

    body = "\n\n".join([part for part in parts if part]).strip()
    return normalize_line_spacing(body)


def build_structured_text(title: str, content: str, updated_at: str) -> str:
    parts: list[str] = [title]
    if content:
        parts.extend(["", content])
    parts.extend(["", "DISCLAIMER", DISCLAIMER])
    if updated_at:
        parts.extend(["", "UPDATED", updated_at])
    return normalize_line_spacing("\n".join(parts))


def parse_structured_report_file(key: str, json_path: Path) -> SectionReport | None:
    payload = safe_read_json(json_path)
    if not payload:
        return None

    sections = payload.get("sections")
    if not isinstance(sections, dict):
        return None

    title = normalize_line_spacing(stringify_fragment(payload.get("title"))) or DISPLAY_LABELS.get(key, key)
    updated_at = normalize_line_spacing(stringify_fragment(payload.get("updated_at")))
    headline = normalize_line_spacing(stringify_fragment(sections.get("headline")))
    snapshot = normalize_structured_snapshot(sections.get("snapshot"))
    key_storylines = normalize_structured_key_storylines(sections)
    content = build_structured_content(key, title, sections)
    text = build_structured_text(title, content, updated_at)
    games = build_games_from_structured(key, sections)
    advanced_payload = build_structured_advanced_payload(key, title, updated_at, sections)

    return SectionReport(
        key=key,
        name=DISPLAY_LABELS.get(key, key),
        title=title,
        text=text,
        content=content,
        headline=headline,
        key_storylines=key_storylines,
        snapshot=snapshot,
        source_file=json_path.name,
        exists=True,
        updated_at=updated_at,
        structured_sections=sections,
        games=games,
        advanced_payload=advanced_payload,
    )


def parse_report_file_from_text(key: str, path: Path) -> SectionReport | None:
    raw = safe_read_text(path)
    if not raw.strip():
        return None

    text = clean_text(raw)
    lines = normalize_newlines(text).split("\n")
    title = lines[0].strip() if lines else DISPLAY_LABELS.get(key, key)
    content = extract_body_content(text)
    headline = extract_headline(content)
    snapshot = extract_snapshot(content)
    key_storylines = extract_key_storylines(content)

    return SectionReport(
        key=key,
        name=DISPLAY_LABELS.get(key, key),
        title=title,
        text=text,
        content=content,
        headline=headline,
        key_storylines=key_storylines,
        snapshot=snapshot,
        source_file=path.name,
        exists=True,
        updated_at=get_file_timestamp(path) or "",
    )


def parse_report_file(key: str, path: Path) -> SectionReport | None:
    json_path = STRUCTURED_JSON_PRIORITY.get(key) or path.with_suffix(".json")
    structured_report = parse_structured_report_file(key, json_path)
    if structured_report:
        return structured_report
    return parse_report_file_from_text(key, path)


def load_available_reports() -> dict[str, SectionReport]:
    loaded: dict[str, SectionReport] = {}
    for key, path in REPORT_FILES:
        report = parse_report_file(key, path)
        if report:
            loaded[key] = report
            log(f"Loaded report: {report.source_file}")
        else:
            log(f"Skipped missing/empty report: {path.name}")
    return loaded


# =========================================================
# BUILDERS
# =========================================================

def build_global_headline(reports: dict[str, SectionReport]) -> str:
    candidates = [
        reports.get("MLB"),
        reports.get("NBA"),
        reports.get("NHL"),
        reports.get("NFL"),
        reports.get("NFL_DRAFT"),
        reports.get("NCAAFB"),
        reports.get("SOCCER"),
    ]
    for report in candidates:
        if report and report.headline:
            return report.headline

    if reports:
        return (
            "The sports calendar is active across major leagues, with live results, "
            "upcoming matchups, analytics, draft signals, and reporter-ready context framing the day."
        )

    return "The sports calendar is still taking shape as reporting windows come together."


def build_global_key_storylines(reports: dict[str, SectionReport]) -> list[str]:
    storylines: list[str] = []

    priority_keys = [
        "MLB",
        "MLB_ADVANCED",
        "NBA",
        "NBA_ADVANCED",
        "NFL",
        "NFL_ADVANCED",
        "NFL_DRAFT",
        "NCAAFB",
        "NHL",
        "SOCCER",
        "FANTASY",
        "BETTING_ODDS",
    ]

    for key in priority_keys:
        report = reports.get(key)
        if not report:
            continue
        for item in report.key_storylines[:2]:
            if item not in storylines:
                storylines.append(item)
        if len(storylines) >= 5:
            break

    if not storylines and reports:
        storylines.append("Fresh league-level reporting is available across the current report window.")

    return storylines[:5]


def build_global_snapshot(reports: dict[str, SectionReport]) -> str:
    count = len([key for key in reports.keys() if not is_advanced_key(key)])
    if count == 1:
        return "This edition includes 1 report."
    return f"This edition includes {count} reports."


def build_global_text(reports: dict[str, SectionReport]) -> str:
    title = f"GLOBAL SPORTS REPORT | {report_date()}"
    headline = build_global_headline(reports)
    key_storylines = build_global_key_storylines(reports)
    snapshot = build_global_snapshot(reports)

    parts: list[str] = [
        title,
        "",
        "HEADLINE",
        headline,
        "",
        "KEY STORYLINES",
    ]

    for item in key_storylines:
        parts.append(f"- {item}")

    parts.extend([
        "",
        "SNAPSHOT",
        snapshot,
    ])

    for key in SECTION_ORDER:
        report = reports.get(key)
        if not report or is_advanced_key(key):
            continue
        parts.extend([
            "",
            report.name,
            "",
            report.content,
        ])

    parts.extend([
        "",
        "DISCLAIMER",
        DISCLAIMER,
        "",
        "UPDATED",
        timestamp_string(),
    ])

    return normalize_line_spacing("\n".join(parts))


def build_substack_post(global_report: str) -> str:
    report = strip_duplicate_disclaimer(strip_generated_lines(global_report))
    footer = (
        f"\n\n---\n\n{DISCLAIMER}\n\n"
        f"Follow Global Sports Report on X: {X_HANDLE}\n"
        f"Read more: {SUBSTACK_URL}"
    )
    return normalize_line_spacing(report + footer)


def build_substack_html(global_report: str) -> str:
    report = strip_duplicate_disclaimer(strip_generated_lines(global_report))
    paragraphs: list[str] = []
    for block in normalize_line_spacing(report).split("\n\n"):
        escaped = html.escape(block).replace("\n", "<br>")
        paragraphs.append(f"<p>{escaped}</p>")

    paragraphs.append("<hr>")
    paragraphs.append(f"<p>{html.escape(DISCLAIMER)}</p>")
    paragraphs.append(f"<p>Follow Global Sports Report on X: {html.escape(X_HANDLE)}</p>")
    paragraphs.append(f"<p>Read more: {html.escape(SUBSTACK_URL)}</p>")

    return (
        "<!doctype html><html><head><meta charset='utf-8'></head><body>"
        + "".join(paragraphs)
        + "</body></html>"
    )


def build_twitter_thread(global_report: str) -> str:
    clean_report = strip_duplicate_disclaimer(strip_generated_lines(global_report))
    lines = [line.strip() for line in clean_report.splitlines() if line.strip()]

    title = lines[0] if lines else "GLOBAL SPORTS REPORT"
    headline = ""
    key_storylines: list[str] = []

    for i, line in enumerate(lines):
        upper = line.upper()
        if upper == "HEADLINE" and i + 1 < len(lines):
            headline = lines[i + 1]
        if upper == "KEY STORYLINES":
            for candidate in lines[i + 1:i + 8]:
                if candidate.startswith("- "):
                    key_storylines.append(candidate[2:].strip())
                elif candidate.isupper():
                    break

    tweets: list[str] = []
    opener_parts = [title]
    if headline:
        opener_parts.extend(["", headline])
    tweets.append(shorten("\n".join(opener_parts).strip(), 275))

    for item in key_storylines[:6]:
        tweets.append(shorten(item, 275))

    closing = f"{DISCLAIMER}\n\n{X_HANDLE}\n{SUBSTACK_URL}"
    tweets.append(shorten(closing, 275))

    numbered: list[str] = []
    total = len(tweets)
    for idx, tweet in enumerate(tweets, start=1):
        prefix = f"{idx}/{total} "
        numbered.append(shorten(prefix + tweet, 280))

    return "\n\n---\n\n".join(numbered).strip()


def build_telegram_post(global_report: str) -> str:
    report = strip_duplicate_disclaimer(strip_generated_lines(global_report))
    footer = f"\n\n{DISCLAIMER}\n\nX: {X_HANDLE}\nSubstack: {SUBSTACK_URL}"
    return normalize_line_spacing(report + footer)


def should_attach_advanced(base_report: SectionReport, advanced_report: SectionReport) -> bool:
    def parse_date(value: str) -> str:
        match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", value or "")
        return match.group(1) if match else ""

    base_date = parse_date(base_report.title)
    advanced_date = parse_date(advanced_report.title)

    if not base_date or not advanced_date:
        return True
    return base_date == advanced_date


def section_to_payload(
    report: SectionReport,
    advanced_report: SectionReport | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": report.name,
        "title": report.title,
        "headline": report.headline,
        "snapshot": report.snapshot,
        "key_storylines": report.key_storylines,
        "content": report.content,
        "source_file": report.source_file,
        "updated_at": report.updated_at or timestamp_string(),
    }

    if report.games:
        payload["games"] = report.games

    if report.structured_sections:
        payload["structured_sections"] = report.structured_sections

    if report.advanced_payload:
        payload["advanced"] = report.advanced_payload
    elif advanced_report and should_attach_advanced(report, advanced_report):
        payload["advanced"] = {
            "title": advanced_report.title,
            "updated_at": advanced_report.updated_at or timestamp_string(),
            "sections": parse_advanced_sections(advanced_report.content),
        }

    return payload


def extract_json_payload(
    global_report: str,
    reports: dict[str, SectionReport],
) -> dict[str, Any]:
    headline = build_global_headline(reports)
    key_storylines = build_global_key_storylines(reports)
    snapshot = build_global_snapshot(reports)
    generated_at = timestamp_string()

    sections_array: list[dict[str, Any]] = []
    sections_map: dict[str, dict[str, Any]] = {}
    reverse_lookup = {v: k for k, v in ADVANCED_TO_BASE.items()}

    for key in SECTION_ORDER:
        if key not in reports or is_advanced_key(key):
            continue

        report = reports[key]
        advanced_report = None

        if key in reverse_lookup:
            advanced_key = reverse_lookup[key]
            advanced_report = reports.get(advanced_key)

        section_payload = section_to_payload(report, advanced_report=advanced_report)
        sections_array.append(section_payload)

        normalized_key = SECTION_KEY_NORMALIZATION.get(key, key.lower())
        section_payload["name"] = report.name
        sections_map[normalized_key] = section_payload

    payload = {
        "title": f"GLOBAL SPORTS REPORT | {report_date()}",
        "headline": headline,
        "key_storylines": key_storylines,
        "snapshot": snapshot,
        "generated_at": generated_at,
        "generated_date": report_date(),
        "updated_at": generated_at,
        "published_at": generated_at,
        "disclaimer": DISCLAIMER,
        "x_handle": X_HANDLE,
        "substack_url": SUBSTACK_URL,
        "sections": sections_array,
        "sections_map": sections_map,
        "section_order": [SECTION_KEY_NORMALIZATION.get(key, key.lower()) for key in SECTION_ORDER if key in reports and not is_advanced_key(key)],
        "full_text": normalize_line_spacing(global_report),
        "full_report": normalize_line_spacing(global_report),
    }

    return payload


# =========================================================
# WEBSITE SYNC / BLOB
# =========================================================

def backup_previous_json() -> None:
    if LATEST_REPORT_JSON_FILE.exists():
        try:
            shutil.copy2(LATEST_REPORT_JSON_FILE, LATEST_REPORT_PREVIOUS_JSON_FILE)
            log(f"Backed up previous JSON: {LATEST_REPORT_PREVIOUS_JSON_FILE}")
        except Exception as exc:
            WARNINGS.append(f"Could not back up previous JSON: {exc}")
            log(f"WARNING: Could not back up previous JSON: {exc}")


def copy_to_website_public(src: Path, dest_name: str | None = None) -> None:
    try:
        WEBSITE_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        dest = WEBSITE_PUBLIC_DIR / (dest_name or src.name)
        shutil.copy2(src, dest)
        WEBSITE_SYNC_COPIES.append(str(dest))
        log(f"Copied to website public: {dest}")
    except Exception as exc:
        WARNINGS.append(f"Could not copy {src.name} to website public: {exc}")
        log(f"WARNING: Could not copy {src.name} to website public: {exc}")


def sync_web_public_files(reports: dict[str, SectionReport]) -> None:
    copy_to_website_public(LATEST_REPORT_JSON_FILE)
    copy_to_website_public(LATEST_REPORT_TXT_FILE)
    copy_to_website_public(GLOBAL_REPORT_FILE)

    for source_key, filename in ADVANCED_COPY_FILES.items():
        report = reports.get(source_key)
        if report:
            temp_path = BASE_DIR / filename
            safe_write_text(temp_path, report.text)
            copy_to_website_public(temp_path, filename)


def upload_to_blob(report_path: Path) -> None:
    token = os.getenv("BLOB_READ_WRITE_TOKEN", "").strip()

    print("[BLOB] TOKEN FOUND:", bool(token))
    if not token:
        print("[BLOB] Missing token")
        return

    if not report_path.exists():
        print(f"[BLOB] Report file not found: {report_path}")
        return

    with report_path.open("rb") as f:
        response = requests.put(
            "https://blob.vercel-storage.com/reports/latest_report.json",
            headers={
                "Authorization": f"Bearer {token}",
                "x-content-type": "application/json",
                "x-add-random-suffix": "0",
            },
            data=f,
            timeout=60,
        )

    print("[BLOB] UPLOAD STATUS:", response.status_code)
    if not response.ok:
        print("[BLOB] RESPONSE:", response.text)


def push_website_repo() -> bool:
    if RUNNING_IN_GITHUB_ACTIONS:
        log("Running in GitHub Actions. Skipping Python-based git push.")
        return True

    if not WEBSITE_REPO_DIR.exists():
        WARNINGS.append(f"Website repo folder not found: {WEBSITE_REPO_DIR}")
        log(f"WARNING: Website repo folder not found: {WEBSITE_REPO_DIR}")
        return False

    git_dir = WEBSITE_REPO_DIR / ".git"
    if not git_dir.exists():
        WARNINGS.append(f"Website repo is not a git repo: {WEBSITE_REPO_DIR}")
        log(f"WARNING: Website repo is not a git repo: {WEBSITE_REPO_DIR}")
        return False

    try:
        status = run_subprocess(["git", "status", "--porcelain"], cwd=WEBSITE_REPO_DIR)
        if not status.stdout.strip():
            log("No website repo changes to commit.")
            return True

        run_subprocess(["git", "add", "."], cwd=WEBSITE_REPO_DIR)
        log("Git add completed.")

        status_after_add = run_subprocess(["git", "status", "--porcelain"], cwd=WEBSITE_REPO_DIR)
        if not status_after_add.stdout.strip():
            log("No website repo changes to commit after add.")
            return True

        commit_message = f"Auto update GSR {now_et().strftime('%Y-%m-%d %I:%M %p ET')}"
        commit = run_subprocess(["git", "commit", "-m", commit_message], cwd=WEBSITE_REPO_DIR, check=False)

        combined_commit = ((commit.stdout or "") + "\n" + (commit.stderr or "")).strip().lower()
        if commit.returncode != 0 and "nothing to commit" not in combined_commit:
            raise subprocess.CalledProcessError(commit.returncode, commit.args, output=commit.stdout, stderr=commit.stderr)

        if commit.returncode == 0:
            log(f"Git commit completed: {commit_message}")
        else:
            log("Git commit skipped: nothing to commit.")

        push = run_subprocess(["git", "push", "origin", "master"], cwd=WEBSITE_REPO_DIR, check=False)
        if push.returncode == 0:
            log("Website auto-deploy push completed to origin/master")
            return True

        stderr = (push.stderr or "").strip()
        stdout = (push.stdout or "").strip()
        message = f"Website git push failed: {stderr or stdout or push.returncode}"
        WARNINGS.append(message)
        log(f"WARNING: {message}")
        return False

    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        message = f"Website git push failed: {stderr or stdout or exc}"
        WARNINGS.append(message)
        log(f"WARNING: {message}")
        return False
    except Exception as exc:
        message = f"Website git push exception: {exc}"
        WARNINGS.append(message)
        log(f"WARNING: {message}")
        return False


# =========================================================
# TELEGRAM / TWITTER
# =========================================================

def send_telegram_message(text: str) -> bool:
    if DISABLE_SOCIAL_POSTS:
        log("Social posting disabled by GSR_DISABLE_SOCIAL_POSTS. Skipping Telegram post.")
        return False

    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log("Telegram credentials not set. Skipping Telegram post.")
        return False

    chunks = split_telegram_chunks(text)
    if not chunks:
        log("Telegram text empty. Skipping Telegram post.")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

    try:
        for idx, chunk in enumerate(chunks, start=1):
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            response = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            log(f"Telegram: sent part {idx}/{len(chunks)}")
        return True

    except Exception as exc:
        message = f"Telegram exception: {exc}"
        WARNINGS.append(message)
        log(f"WARNING: {message}")
        return False


def get_twitter_client_v2() -> Any | None:
    if DISABLE_SOCIAL_POSTS:
        log("Social posting disabled by GSR_DISABLE_SOCIAL_POSTS. Skipping X/Twitter post.")
        return None

    if tweepy is None:
        WARNINGS.append("tweepy is not installed. Skipping X/Twitter post.")
        log("WARNING: tweepy is not installed. Skipping X/Twitter post.")
        return None

    creds = [
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET,
    ]
    if not all(creds):
        log("Twitter/X credentials not fully set. Skipping Twitter post.")
        return None

    try:
        return tweepy.Client(
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET,
            access_token=TWITTER_ACCESS_TOKEN,
            access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
        )
    except Exception as exc:
        WARNINGS.append(f"Could not initialize X/Twitter client: {exc}")
        log(f"WARNING: Could not initialize X/Twitter client: {exc}")
        return None


def twitter_thread_already_posted(thread_text: str) -> bool:
    current_hash = text_hash(thread_text)
    previous_hash = safe_read_text(TWITTER_HASH_FILE).strip()
    return previous_hash == current_hash


def save_twitter_hash(thread_text: str) -> None:
    TWITTER_HASH_FILE.parent.mkdir(parents=True, exist_ok=True)
    TWITTER_HASH_FILE.write_text(text_hash(thread_text), encoding="utf-8")


def split_twitter_thread(thread_text: str) -> list[str]:
    parts = [part.strip() for part in thread_text.split("\n\n---\n\n") if part.strip()]
    return [shorten(part, 280) for part in parts]


def post_twitter_thread(thread_text: str) -> bool:
    client = get_twitter_client_v2()
    if client is None:
        return False

    if twitter_thread_already_posted(thread_text):
        log("Twitter thread unchanged. Skipping duplicate post.")
        return False

    tweets = split_twitter_thread(thread_text)
    if not tweets:
        log("Twitter thread empty. Skipping X/Twitter post.")
        return False

    last_tweet_id = None

    try:
        for idx, tweet in enumerate(tweets, start=1):
            if last_tweet_id is None:
                response = client.create_tweet(text=tweet)
            else:
                response = client.create_tweet(text=tweet, in_reply_to_tweet_id=last_tweet_id)

            last_tweet_id = response.data["id"]
            log(f"Twitter/X post {idx}/{len(tweets)} sent.")

        save_twitter_hash(thread_text)
        return True

    except Exception as exc:
        message = f"Twitter exception: {exc}"
        WARNINGS.append(message)
        log(f"WARNING: {message}")
        return False


# =========================================================
# SUMMARY
# =========================================================

def print_env_status() -> None:
    log(f"ENV PATH: {ENV_PATH}")
    log(f"ENV EXISTS: {ENV_PATH.exists()}")
    log(f"RUNNING IN GITHUB ACTIONS: {RUNNING_IN_GITHUB_ACTIONS}")
    log(f"WEBSITE_PUBLIC_DIR: {WEBSITE_PUBLIC_DIR}")
    log(f"WEBSITE_REPO_DIR: {WEBSITE_REPO_DIR}")
    log(f"TELEGRAM TOKEN FOUND: {bool(TELEGRAM_BOT_TOKEN)}")
    log(f"TELEGRAM CHAT ID FOUND: {bool(TELEGRAM_CHAT_ID)}")
    log(f"TWITTER API KEY FOUND: {bool(TWITTER_API_KEY)}")
    log(f"TWITTER API SECRET FOUND: {bool(TWITTER_API_SECRET)}")
    log(f"TWITTER ACCESS TOKEN FOUND: {bool(TWITTER_ACCESS_TOKEN)}")
    log(f"TWITTER ACCESS TOKEN SECRET FOUND: {bool(TWITTER_ACCESS_TOKEN_SECRET)}")
    log(f"TWITTER BEARER TOKEN FOUND: {bool(TWITTER_BEARER_TOKEN)}")
    log(f"BLOB TOKEN FOUND: {bool(os.getenv('BLOB_READ_WRITE_TOKEN', '').strip())}")


def print_distribution_summary() -> None:
    log("==============================================")
    log("DISTRIBUTION SUMMARY")
    log("==============================================")

    log(f"Files Written: {len(FILES_WRITTEN)}")
    for item in FILES_WRITTEN:
        log(f" - {item}")

    log(f"Website Sync Copies: {len(WEBSITE_SYNC_COPIES)}")
    for item in WEBSITE_SYNC_COPIES:
        log(f" - {item}")

    log(f"Telegram OK: {telegram_ok}")
    log(f"X OK: {twitter_ok}")
    log(f"Website Auto-Deploy OK: {website_push_ok}")

    if WARNINGS:
        log("WARNINGS:")
        for item in WARNINGS:
            log(f" - {item}")
    else:
        log("WARNINGS: None")

    if CRITICAL_ERRORS:
        log("CRITICAL ERRORS:")
        for item in CRITICAL_ERRORS:
            log(f" - {item}")
    else:
        log("NO CRITICAL ERRORS DETECTED")

    log("==============================================")
    log("DISTRIBUTION BUILD COMPLETE")
    log("==============================================")


# =========================================================
# MAIN
# =========================================================

def main() -> int:
    global telegram_ok, twitter_ok, website_push_ok

    log("Starting distribution build.")
    print_env_status()

    reports = load_available_reports()
    global_report = safe_read_text(GLOBAL_REPORT_FILE)

    if not global_report:
        message = f"Missing or empty global report: {GLOBAL_REPORT_FILE.name}"
        CRITICAL_ERRORS.append(message)
        log(f"ERROR: {message}")
        print_distribution_summary()
        return 1

    if not reports:
        message = "No report files were available for distribution."
        CRITICAL_ERRORS.append(message)
        log(f"ERROR: {message}")
        print_distribution_summary()
        return 1

    substack_post = build_substack_post(global_report)
    substack_html = build_substack_html(global_report)
    twitter_thread = build_twitter_thread(global_report)
    telegram_post = build_telegram_post(global_report)
    latest_report_txt = normalize_line_spacing(strip_generated_lines(global_report))
    latest_report_json = extract_json_payload(global_report, reports)

    backup_previous_json()

    safe_write_text(SUBSTACK_POST_FILE, substack_post)
    safe_write_text(SUBSTACK_HTML_FILE, substack_html)
    safe_write_text(TWITTER_THREAD_FILE, twitter_thread)
    safe_write_text(TELEGRAM_POST_FILE, telegram_post)
    safe_write_text(LATEST_REPORT_TXT_FILE, latest_report_txt)
    safe_write_text(GLOBAL_REPORT_FILE, normalize_line_spacing(global_report))
    safe_write_json(LATEST_REPORT_JSON_FILE, latest_report_json)

    sync_web_public_files(reports)
    upload_to_blob(LATEST_REPORT_JSON_FILE)

    telegram_ok = send_telegram_message(telegram_post)
    twitter_ok = post_twitter_thread(twitter_thread)
    website_push_ok = push_website_repo()

    print_distribution_summary()
    return 0 if not CRITICAL_ERRORS else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("Interrupted by user.")
        sys.exit(1)
    except Exception as exc:
        log(f"FATAL: build_distribution.py crashed: {exc}")
        raise