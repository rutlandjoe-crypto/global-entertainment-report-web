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


def first_real_line(text: str):
    for line in text.splitlines():
        line = line.strip()
        if len(line) > 40:
            return line
    return "Entertainment developments continue across film, television and streaming."


def build_payload(text: str):
    headline = first_real_line(text)

    return {
        "title": "Global Entertainment Report",
        "headline": headline,
        "snapshot": headline,
        "updated_at": stamp(),
        "generated_at": stamp(),
        "sections": {
            "entertainment": {
                "title": "Entertainment",
                "headline": headline,
                "content": text,
                "updated_at": stamp(),
            }
        }
    }


def write_files(payload, text):
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    OUTPUT_TXT.write_text(text, encoding="utf-8")

    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)

    WEB_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    WEB_TXT.write_text(text, encoding="utf-8")


def main():
    print(f"[{stamp()}] ENTERTAINMENT BUILD STARTED")

    text = read_report()

    if not text:
        print("No entertainment report found.")
        return

    payload = build_payload(text)
    write_files(payload, text)

    print(f"[{stamp()}] ENTERTAINMENT BUILD COMPLETE")


if __name__ == "__main__":
    main()