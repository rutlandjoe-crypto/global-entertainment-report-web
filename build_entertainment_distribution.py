from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent

REPORT_FILE = BASE_DIR / "entertainment_report.txt"

OUTPUT_JSON = BASE_DIR / "latest_report.json"
OUTPUT_TXT = BASE_DIR / "latest_report.txt"

WEB_DIR = Path(r"C:\Users\joeru\OneDrive\Desktop\global-entertainment-report-web")
WEB_PUBLIC = WEB_DIR / "public"

WEB_JSON = WEB_PUBLIC / "latest_report.json"
WEB_TXT = WEB_PUBLIC / "latest_report.txt"


def now_et():
    return datetime.now(ET)


def stamp():
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def read_report():
    if not REPORT_FILE.exists():
        return ""
    return REPORT_FILE.read_text(encoding="utf-8").strip()


def load_existing_json(path: Path):
    if not path.exists():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def is_valid_newsroom_payload(payload):
    if not isinstance(payload, dict):
        return False

    headline = str(payload.get("headline", "")).strip()
    updated_at = str(payload.get("updated_at", "")).strip()

    has_newsroom = isinstance(payload.get("live_newsroom"), list) and len(payload["live_newsroom"]) > 0
    has_sections_list = isinstance(payload.get("sections"), list) and len(payload["sections"]) > 0

    has_valid_identity = (
        payload.get("site") == "Global Entertainment Report"
        or payload.get("vertical") == "Entertainment"
    )

    return bool(headline and updated_at and has_valid_identity and (has_newsroom or has_sections_list))


def first_real_line(text: str):
    for line in text.splitlines():
        line = line.strip()
        if len(line) > 40:
            return line
    return "Entertainment developments continue across film, television and streaming."


def build_payload(text: str):
    headline = first_real_line(text)
    current_stamp = stamp()

    return {
        "site": "Global Entertainment Report",
        "vertical": "Entertainment",
        "headline": headline,
        "snapshot": headline,
        "updated_at": current_stamp,
        "generated_at": current_stamp,
        "sections": [
            {
                "headline": headline,
                "snapshot": text,
                "source_name": "Entertainment Report",
                "freshness_status": "fallback",
                "editor_note": "Fallback text report used because no valid newsroom JSON was available.",
                "key_data": [],
                "why_it_matters": [
                    "This fallback should only appear when the live entertainment content engine has not produced a valid newsroom payload."
                ],
                "what_to_watch": [
                    "Run content_engine.py to restore full live newsroom coverage."
                ],
            }
        ],
    }


def write_files(payload, text):
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    OUTPUT_TXT.write_text(text, encoding="utf-8")

    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)

    WEB_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    WEB_TXT.write_text(text, encoding="utf-8")


def main():
    print(f"[{stamp()}] ENTERTAINMENT BUILD STARTED")

    existing_web_payload = load_existing_json(WEB_JSON)
    if is_valid_newsroom_payload(existing_web_payload):
        print("[SKIP] Valid live newsroom payload already exists.")
        print("[SKIP] build_entertainment_distribution.py will not overwrite public/latest_report.json.")
        print(f"[{stamp()}] ENTERTAINMENT BUILD COMPLETE")
        return

    text = read_report()

    if not text:
        print("No entertainment report found.")
        return

    payload = build_payload(text)
    write_files(payload, text)

    print("[WARN] Wrote fallback entertainment payload because no valid newsroom JSON existed.")
    print(f"[{stamp()}] ENTERTAINMENT BUILD COMPLETE")


if __name__ == "__main__":
    main()