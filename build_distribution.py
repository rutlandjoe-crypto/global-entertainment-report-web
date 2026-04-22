from __future__ import annotations

import requests
from dotenv import load_dotenv

load_dotenv()

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

import os
import requests
from dotenv import load_dotenv

load_dotenv()

def upload_to_blob(report_path):
    token = os.getenv("BLOB_READ_WRITE_TOKEN")

    print("[BLOB] TOKEN FOUND:", bool(token))

    if not token:
        print("[BLOB] ❌ Missing token")
        return

    with open(report_path, "rb") as f:
        response = requests.put(
            "https://blob.vercel-storage.com/reports/latest_report.json",
            headers={
                "Authorization": f"Bearer {token}",
                "x-content-type": "application/json",
                "x-add-random-suffix": "0",
            },
            data=f,
        )

    print("[BLOB] UPLOAD STATUS:", response.status_code)

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

DISCLAIMER = (
    "This report is an automated summary intended to support, not replace, human sports journalism."
)

X_FOOTER_HANDLE = "@GlobalSportsRp"
SUBSTACK_URL = "https://globalsportsreport.substack.com/"

# GitHub-safe defaults:
# - write directly into this repo's public folder
# - treat this repo itself as the website repo
WEBSITE_PUBLIC_DIR = Path(
    os.getenv("GSR_WEBSITE_PUBLIC_DIR", str(BASE_DIR / "public"))
)
WEBSITE_REPO_DIR = Path(
    os.getenv("GSR_WEBSITE_REPO_DIR", str(BASE_DIR))
)

GLOBAL_REPORT_FILE = BASE_DIR / "global_sports_report.txt"

REPORT_FILES: dict[str, Path] = {
    "MLB": BASE_DIR / "mlb_report.txt",
    "NBA": BASE_DIR / "nba_report.txt",
    "NHL": BASE_DIR / "nhl_report.txt",
    "NFL": BASE_DIR / "nfl_report.txt",
    "SOCCER": BASE_DIR / "soccer_report.txt",
    "BETTING ODDS": BASE_DIR / "betting_odds_report.txt",
}

ADVANCED_REPORT_FILES: dict[str, Path] = {
    "MLB": BASE_DIR / "mlb_advanced_report.txt",
    "NBA": BASE_DIR / "nba_advanced_report.txt",
    "NFL": BASE_DIR / "nfl_draft_signals.txt",
}

SUBSTACK_POST_FILE = BASE_DIR / "substack_post.txt"
TWITTER_THREAD_FILE = BASE_DIR / "twitter_thread.txt"
TELEGRAM_POST_FILE = BASE_DIR / "telegram_post.txt"
LATEST_REPORT_TXT_FILE = BASE_DIR / "latest_report.txt"
LATEST_REPORT_JSON_FILE = BASE_DIR / "latest_report.json"
LATEST_REPORT_PREVIOUS_JSON_FILE = BASE_DIR / "latest_report.previous.json"
TWITTER_HASH_FILE = BASE_DIR / ".last_twitter_hash.txt"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()

TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "").strip()
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "").strip()
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN", "").strip()
TWITTER_ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "").strip()

RUNNING_IN_GITHUB_ACTIONS = os.getenv("GITHUB_ACTIONS", "").lower() == "true"
DISABLE_SOCIAL_POSTS = os.getenv("GSR_DISABLE_SOCIAL_POSTS", "").lower() in {
    "1",
    "true",
    "yes",
}


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
# HELPERS
# =========================================================

def now_et() -> datetime:
    return datetime.now(TIMEZONE)


def timestamp_string() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def log(message: str) -> None:
    print(f"[{timestamp_string()}] {message}")


def clean_text(text: str) -> str:
    if not text:
        return ""

    replacements = {
        "\r\n": "\n",
        "\r": "\n",
        "â€™": "’",
        "â€˜": "‘",
        "â€œ": '"',
        "â€\x9d": '"',
        "â€”": "—",
        "â€“": "–",
        "Â ": " ",
        "Â": "",
        "Ã©": "é",
        "Ã": "",
        "\ufeff": "",
    }

    for bad, good in replacements.items():
        text = text.replace(bad, good)

    text = text.replace("•", "-")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_line_spacing(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines()]
    return "\n".join(lines).strip()


def strip_generated_lines(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if re.match(r"^Generated:\s+", stripped, flags=re.IGNORECASE):
            continue
        if re.match(r"^Updated:\s+", stripped, flags=re.IGNORECASE):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def strip_duplicate_disclaimer(text: str) -> str:
    pattern = re.escape(DISCLAIMER)
    text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


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

upload_to_blob(r"C:\Users\joeru\OneDrive\Desktop\global-sports-report-web\latest_report.json")


def get_file_timestamp(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        dt = datetime.fromtimestamp(path.stat().st_mtime, tz=TIMEZONE)
        return dt.strftime("%Y-%m-%d %I:%M:%S %p ET")
    except Exception:
        return None


def section_lines(text: str) -> list[str]:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            lines.append(stripped)
    return lines


def shorten(text: str, max_len: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_telegram_chunks(text: str, max_len: int = 4000) -> list[str]:
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

        lines = para.splitlines()
        temp = ""
        for line in lines:
            candidate_line = f"{temp}\n{line}".strip() if temp else line
            if len(candidate_line) <= max_len:
                temp = candidate_line
            else:
                if temp:
                    chunks.append(temp)
                if len(line) <= max_len:
                    temp = line
                else:
                    start = 0
                    while start < len(line):
                        chunks.append(line[start:start + max_len])
                        start += max_len
                    temp = ""
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
        check=check,
    )


# =========================================================
# PARSING + BUILDING
# =========================================================

def read_report_files() -> dict[str, str]:
    reports: dict[str, str] = {}
    for label, path in REPORT_FILES.items():
        content = safe_read_text(path)
        if content:
            reports[label] = content
            log(f"{label}: found ({path.stat().st_size} bytes)")
        else:
            reports[label] = ""
            log(f"{label}: missing or empty")
    return reports


def read_advanced_reports() -> dict[str, dict[str, Any]]:
    data: dict[str, dict[str, Any]] = {}

    for label, path in ADVANCED_REPORT_FILES.items():
        content = safe_read_text(path)
        if not content:
            continue

        lines = section_lines(content)
        title = lines[0] if lines else f"{label} ADVANCED REPORT"

        sections: dict[str, list[str]] = {}
        current_section = "notes"

        for line in content.splitlines():
            stripped = line.strip()
            if not stripped:
                continue

            if stripped.isupper() and len(stripped) < 60:
                current_section = stripped.lower().replace(" ", "_")
                sections.setdefault(current_section, [])
                continue

            if stripped.startswith("- "):
                sections.setdefault(current_section, []).append(stripped[2:].strip())

        data[label] = {
            "title": title,
            "source_file": path.name,
            "updated_at": get_file_timestamp(path),
            "sections": sections,
        }

    return data


def build_substack_post(global_report: str) -> str:
    report = strip_generated_lines(global_report)
    report = strip_duplicate_disclaimer(report)

    footer = (
        f"\n\n{DISCLAIMER}\n\n"
        f"Follow on X: {X_FOOTER_HANDLE}\n"
        f"Subscribe on Substack: {SUBSTACK_URL}"
    )

    return normalize_line_spacing(report + footer)


def build_twitter_thread(global_report: str) -> str:
    clean_report = strip_generated_lines(global_report)
    lines = [line.strip() for line in clean_report.splitlines() if line.strip()]

    title = lines[0] if lines else "GLOBAL SPORTS REPORT"
    headline = ""
    key_storylines: list[str] = []

    for i, line in enumerate(lines):
        upper = line.upper()
        if upper == "HEADLINE" and i + 1 < len(lines):
            headline = lines[i + 1]
        if upper == "KEY STORYLINES":
            for candidate in lines[i + 1:i + 6]:
                if candidate.startswith("- "):
                    key_storylines.append(candidate[2:].strip())
                elif candidate.isupper():
                    break

    tweets: list[str] = []

    first_tweet_parts = [title]
    if headline:
        first_tweet_parts.append(headline)
    first_tweet = "\n\n".join(first_tweet_parts).strip()
    tweets.append(shorten(first_tweet, 275))

    for item in key_storylines[:6]:
        tweets.append(shorten(item, 275))

    closing = (
        f"{DISCLAIMER}\n\n"
        f"{X_FOOTER_HANDLE}\n"
        f"{SUBSTACK_URL}"
    )
    tweets.append(shorten(closing, 275))

    numbered: list[str] = []
    total = len(tweets)
    for idx, tweet in enumerate(tweets, start=1):
        prefix = f"{idx}/{total} "
        numbered.append(shorten(prefix + tweet, 280))

    return "\n\n---\n\n".join(numbered).strip()


def build_telegram_post(global_report: str) -> str:
    report = strip_generated_lines(global_report)
    report = strip_duplicate_disclaimer(report)

    footer = (
        f"\n\n{DISCLAIMER}\n\n"
        f"X: {X_FOOTER_HANDLE}\n"
        f"Substack: {SUBSTACK_URL}"
    )
    return normalize_line_spacing(report + footer)


def extract_json_payload(
    global_report: str,
    reports: dict[str, str],
    advanced: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    clean_report = strip_generated_lines(global_report)
    lines = [line.strip() for line in clean_report.splitlines() if line.strip()]

    title = lines[0] if lines else f"GLOBAL SPORTS REPORT | {now_et().strftime('%Y-%m-%d')}"
    headline = ""
    key_storylines: list[str] = []
    snapshot = ""

    for i, line in enumerate(lines):
        upper = line.upper()

        if upper == "HEADLINE" and i + 1 < len(lines):
            headline = lines[i + 1]

        if upper == "SNAPSHOT" and i + 1 < len(lines):
            snapshot = lines[i + 1]

        if upper == "KEY STORYLINES":
            for candidate in lines[i + 1:i + 8]:
                if candidate.startswith("- "):
                    key_storylines.append(candidate[2:].strip())
                elif candidate.isupper():
                    break

    generated_at = timestamp_string()

    sections_payload: dict[str, Any] = {}
    for label, content in reports.items():
        if not content:
            continue

        content_lines = section_lines(content)

        payload: dict[str, Any] = {
            "title": content_lines[0] if content_lines else f"{label} REPORT",
            "source_file": REPORT_FILES[label].name,
            "updated_at": get_file_timestamp(REPORT_FILES[label]),
            "content": strip_generated_lines(content),
        }

        if label in advanced:
            payload["advanced"] = advanced[label]

        sections_payload[label.lower().replace(" ", "_")] = payload

    return {
        "title": title,
        "headline": headline,
        "key_storylines": key_storylines,
        "snapshot": snapshot,
        "generated_at": generated_at,
        "updated_at": generated_at,
        "published_at": generated_at,
        "disclaimer": DISCLAIMER,
        "x_handle": X_FOOTER_HANDLE,
        "substack_url": SUBSTACK_URL,
        "sections": sections_payload,
    }


# =========================================================
# WEBSITE SYNC
# =========================================================

def backup_previous_json() -> None:
    if LATEST_REPORT_JSON_FILE.exists():
        try:
            shutil.copy2(LATEST_REPORT_JSON_FILE, LATEST_REPORT_PREVIOUS_JSON_FILE)
            log(f"Backed up previous website JSON to {LATEST_REPORT_PREVIOUS_JSON_FILE}")
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
        files_to_stage: list[Path] = []
        for name in ("latest_report.json", "latest_report.txt", "global_sports_report.txt"):
            candidate = WEBSITE_PUBLIC_DIR / name
            if candidate.exists():
                files_to_stage.append(candidate)

        if not files_to_stage:
            log("No website public files found to stage.")
            return True

        relative_paths = [str(path.relative_to(WEBSITE_REPO_DIR)) for path in files_to_stage]
        run_subprocess(["git", "add", *relative_paths], cwd=WEBSITE_REPO_DIR)
        log(f"Git add completed for: {', '.join(relative_paths)}")

        status = run_subprocess(["git", "status", "--porcelain"], cwd=WEBSITE_REPO_DIR)
        if not status.stdout.strip():
            log("No website repo changes to commit")
            return True

        commit_message = f"Auto update GSR {now_et().strftime('%Y-%m-%d %I:%M %p ET')}"
        run_subprocess(["git", "commit", "-m", commit_message], cwd=WEBSITE_REPO_DIR)
        log(f"Git commit completed: {commit_message}")

        run_subprocess(["git", "push", "origin", "master"], cwd=WEBSITE_REPO_DIR)
        log("Website auto-deploy push completed to origin/master")
        return True

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
# TELEGRAM
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


# =========================================================
# TWITTER / X
# =========================================================

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
        client = tweepy.Client(
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET,
            access_token=TWITTER_ACCESS_TOKEN,
            access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
        )
        return client
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


def upload_to_blob(report_path):
    import os

    token = os.getenv("BLOB_READ_WRITE_TOKEN")

    print("[BLOB] TOKEN FOUND:", bool(token))

    if not token:
        print("[BLOB] ❌ Missing token")
        return

    with open(report_path, "rb") as f:
        response = requests.put(
            "https://blob.vercel-storage.com/reports/latest_report.json",
            headers={
                "Authorization": f"Bearer {token}",
                "x-content-type": "application/json",
                "x-add-random-suffix": "0",
            },
            data=f,
        )

    print("[BLOB] UPLOAD STATUS:", response.status_code)

# =========================================================
# MAIN
# =========================================================

def main() -> int:
    global telegram_ok, twitter_ok, website_push_ok

    log("Starting distribution build.")
    print_env_status()

    reports = read_report_files()
    global_report = safe_read_text(GLOBAL_REPORT_FILE)

    if not global_report:
        message = f"Missing or empty global report: {GLOBAL_REPORT_FILE.name}"
        CRITICAL_ERRORS.append(message)
        log(f"ERROR: {message}")
        print_distribution_summary()
        return 1

    advanced_reports = read_advanced_reports()

    substack_post = build_substack_post(global_report)
    twitter_thread = build_twitter_thread(global_report)
    telegram_post = build_telegram_post(global_report)
    latest_report_txt = normalize_line_spacing(strip_generated_lines(global_report))
    latest_report_json = extract_json_payload(global_report, reports, advanced_reports)

    backup_previous_json()

    safe_write_text(SUBSTACK_POST_FILE, substack_post)
    safe_write_text(TWITTER_THREAD_FILE, twitter_thread)
    safe_write_text(TELEGRAM_POST_FILE, telegram_post)
    safe_write_text(LATEST_REPORT_TXT_FILE, latest_report_txt)
    safe_write_text(GLOBAL_REPORT_FILE, normalize_line_spacing(global_report))
    safe_write_json(LATEST_REPORT_JSON_FILE, latest_report_json)

    copy_to_website_public(LATEST_REPORT_JSON_FILE)
    copy_to_website_public(LATEST_REPORT_TXT_FILE)
    copy_to_website_public(GLOBAL_REPORT_FILE)

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