from __future__ import annotations

import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests

BASE_DIR = Path(__file__).resolve().parent
REPORT_FILE = BASE_DIR / "mlb_report.txt"
ADVANCED_REPORT_FILE = BASE_DIR / "mlb_advanced_report.txt"

TIMEZONE = ZoneInfo("America/New_York")
SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule"

DISCLAIMER = (
    "This report is an automated summary intended to support, not replace, human sports journalism."
)

REQUEST_TIMEOUT = 20
OVERNIGHT_CUTOFF_HOUR = 5


def now_et() -> datetime:
    return datetime.now(TIMEZONE)


def report_date() -> str:
    return now_et().strftime("%Y-%m-%d")


def generated_stamp() -> str:
    return now_et().strftime("%Y-%m-%d %I:%M:%S %p ET")


def clean_text(text: str) -> str:
    if not text:
        return ""
    replacements = {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2014": "-",
        "\u2013": "-",
        "\xa0": " ",
        "â€™": "'",
        "â€œ": '"',
        "â€\x9d": '"',
        "â€”": "-",
        "â€“": "-",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return re.sub(r"[ \t]+", " ", text).strip()


def save_report(text: str) -> None:
    REPORT_FILE.write_text(text.rstrip() + "\n", encoding="utf-8")


def fetch_schedule(date_str: str) -> dict[str, Any]:
    params = {
        "sportId": 1,
        "date": date_str,
        "hydrate": (
            "team,linescore,probablePitcher,decisions,game(content(summary,media(epg))),"
            "flags,seriesStatus,venue,review,person,stats"
        ),
    }
    response = requests.get(SCHEDULE_URL, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def extract_games(payload: dict[str, Any]) -> list[dict[str, Any]]:
    dates = payload.get("dates", [])
    return dates[0].get("games", []) if dates else []


def format_game_time(game_datetime: str | None) -> str:
    if not game_datetime:
        return "TBD"
    try:
        dt = datetime.fromisoformat(game_datetime.replace("Z", "+00:00")).astimezone(TIMEZONE)
        return dt.strftime("%I:%M %p ET").lstrip("0")
    except Exception:
        return "TBD"


def game_status(game: dict[str, Any]) -> tuple[str, str]:
    status = game.get("status", {})
    abstract_state = clean_text(status.get("abstractGameState", ""))
    detailed_state = clean_text(status.get("detailedState", ""))
    coded_state = clean_text(status.get("codedGameState", ""))

    state = abstract_state.lower()
    detail = detailed_state.lower()

    if state == "final" or "final" in detail or coded_state == "F":
        return "final", detailed_state or "Final"

    if (
        state == "live"
        or coded_state in {"I", "M"}
        or "in progress" in detail
        or "manager challenge" in detail
    ):
        return "live", detailed_state or "Live"

    if state in {"preview", "pre-game"} or "scheduled" in detail or "pre-game" in detail:
        return "upcoming", detailed_state or "Scheduled"

    return "upcoming", detailed_state or "Scheduled"


def probable_pitcher_name(team_block: dict[str, Any]) -> str:
    probable = team_block.get("probablePitcher") or {}
    return clean_text(probable.get("fullName", ""))


def probable_pitchers_text(game: dict[str, Any]) -> str:
    away = probable_pitcher_name(game.get("teams", {}).get("away", {}))
    home = probable_pitcher_name(game.get("teams", {}).get("home", {}))

    if not away or not home:
        return ""
    if len(away.split()) < 2 or len(home.split()) < 2:
        return ""

    return f" Probables: {away} vs. {home}."


def team_name(team_block: dict[str, Any]) -> str:
    return clean_text(team_block.get("team", {}).get("name", "Unknown Team"))


def team_score(team_block: dict[str, Any]) -> int | None:
    score = team_block.get("score")
    return score if isinstance(score, int) else None


def inning_state_text(linescore: dict[str, Any]) -> str:
    inning_half = clean_text(linescore.get("inningHalf", ""))
    current_inning = linescore.get("currentInning")
    if inning_half and current_inning:
        return f"{inning_half} {current_inning}"
    if inning_half:
        return inning_half
    return ""


def build_final_line(game: dict[str, Any]) -> str:
    away_block = game.get("teams", {}).get("away", {})
    home_block = game.get("teams", {}).get("home", {})
    away_name = team_name(away_block)
    home_name = team_name(home_block)
    away_score = team_score(away_block)
    home_score = team_score(home_block)

    if away_score is None or home_score is None:
        return f"{away_name} at {home_name} - Final."

    if away_score > home_score:
        winner = away_name
        loser = home_name
        win_score = away_score
        lose_score = home_score
    else:
        winner = home_name
        loser = away_name
        win_score = home_score
        lose_score = away_score

    return f"{winner} beat {loser}, {win_score}-{lose_score}."


def build_live_line(game: dict[str, Any]) -> str:
    away_block = game.get("teams", {}).get("away", {})
    home_block = game.get("teams", {}).get("home", {})
    away_name = team_name(away_block)
    home_name = team_name(home_block)
    away_score = team_score(away_block)
    home_score = team_score(home_block)
    linescore = game.get("linescore", {})
    inning_text = inning_state_text(linescore)

    if away_score is None or home_score is None:
        if inning_text:
            return f"{away_name} at {home_name} - {inning_text}."
        return f"{away_name} at {home_name} - Live."

    if inning_text:
        return f"{away_name} {away_score}, {home_name} {home_score} - {inning_text}."
    return f"{away_name} {away_score}, {home_name} {home_score} - Live."


def build_upcoming_line(game: dict[str, Any]) -> str:
    away_name = team_name(game.get("teams", {}).get("away", {}))
    home_name = team_name(game.get("teams", {}).get("home", {}))
    game_time = format_game_time(game.get("gameDate"))
    probables = probable_pitchers_text(game)
    return f"{away_name} at {home_name} - {game_time}.{probables}".strip()


def parse_advanced_report() -> tuple[list[str], list[str]]:
    if not ADVANCED_REPORT_FILE.exists():
        return [], []

    try:
        raw_text = ADVANCED_REPORT_FILE.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return [], []

    statcast_watch: list[str] = []
    matchup_flags: list[str] = []
    current_section = ""

    for raw_line in raw_text.splitlines():
        line = clean_text(raw_line)
        if not line:
            continue

        upper = line.upper()
        if upper == "STATCAST WATCH":
            current_section = "statcast"
            continue
        if upper == "MATCHUP FLAGS":
            current_section = "matchups"
            continue
        if upper == "BOARD CONTEXT":
            current_section = "context"
            continue

        if line.startswith("- "):
            bullet = line[2:].strip()
            if current_section == "statcast" and len(statcast_watch) < 3:
                statcast_watch.append(bullet)
            elif current_section == "matchups" and len(matchup_flags) < 3:
                matchup_flags.append(bullet)

    return statcast_watch, matchup_flags


def build_key_sections(
    finals: list[str],
    live: list[str],
    upcoming: list[str],
    upcoming_games: list[dict[str, Any]],
    advanced_key_points: list[str],
    advanced_matchups: list[str],
    overnight_mode: bool,
) -> tuple[list[str], list[str], list[str]]:
    key_data_points: list[str] = []
    why_it_matters: list[str] = []
    story_angles: list[str] = []

    probable_count = sum(1 for g in upcoming_games if probable_pitchers_text(g))
    late_games = sum(
        1
        for g in upcoming_games
        if "PM ET" in build_upcoming_line(g)
        and any(token in build_upcoming_line(g) for token in ["8:", "9:", "10:"])
    )

    if overnight_mode:
        key_data_points.append(
            f"The overnight MLB window includes {len(finals)} final, {len(live)} live, and {len(upcoming)} upcoming game(s)."
        )
    else:
        total_games = len(finals) + len(live) + len(upcoming)
        key_data_points.append(
            f"The MLB board shows {total_games} total game(s) in this report window."
        )

    if upcoming:
        key_data_points.append(
            f"{len(upcoming)} game(s) are still ahead on the schedule, keeping the focus on pregame matchup context."
        )

    if probable_count:
        key_data_points.append(
            f"{probable_count} upcoming game(s) currently list probable starters on both sides."
        )
    elif live or finals:
        key_data_points.append(
            "The board is being driven more by game state and results than by pregame probable-starter context."
        )

    for item in advanced_key_points[:2]:
        key_data_points.append(item)

    if probable_count >= 5:
        why_it_matters.append(
            "A healthy number of listed probable starters gives reporters stronger footing for preview coverage before first pitch."
        )
    else:
        why_it_matters.append(
            "Limited probable-starter detail on parts of the board increases the value of matchup framing and schedule context."
        )

    if live:
        why_it_matters.append(
            "Live action on the board shifts the editorial lens toward leverage moments, bullpen usage, and in-game momentum."
        )
    elif finals:
        why_it_matters.append(
            "With finals already posting, the board supports both quick-turn recap writing and forward-looking setup for the remaining slate."
        )
    else:
        why_it_matters.append(
            "With the board still in pregame mode, the strongest early angles come from probable pitchers, scheduling context, and market expectation."
        )

    if overnight_mode:
        why_it_matters.append(
            "An overnight MLB edition helps preserve late West Coast results while still setting up the next day's board."
        )

    if late_games:
        story_angles.append(
            "A meaningful late window keeps the MLB news cycle active deep into the night, which is useful for live blogs, newsletters, and west-coast follow coverage."
        )

    story_angles.append(
        "Where probable starters are confirmed, pitching becomes the cleanest pregame frame for reporters looking to separate signal from schedule noise."
    )

    for item in advanced_matchups[:2]:
        story_angles.append(item)

    return key_data_points[:5], why_it_matters[:3], story_angles[:4]


def build_snapshot_text(finals: list[str], live: list[str], upcoming: list[str]) -> str:
    snapshot_parts: list[str] = []
    if finals:
        snapshot_parts.append(f"{len(finals)} final")
    if live:
        snapshot_parts.append(f"{len(live)} live")
    if upcoming:
        snapshot_parts.append(f"{len(upcoming)} upcoming")

    if snapshot_parts:
        return f"The MLB slate currently shows {', '.join(snapshot_parts)} game(s)."
    return "No MLB games were available during this report window."


def build_report(
    final_games: list[dict[str, Any]],
    live_games: list[dict[str, Any]],
    upcoming_games: list[dict[str, Any]],
    overnight_mode: bool,
) -> str:
    finals = [build_final_line(game) for game in final_games]
    live = [build_live_line(game) for game in live_games]
    upcoming = [build_upcoming_line(game) for game in upcoming_games]

    snapshot_text = build_snapshot_text(finals, live, upcoming)

    advanced_key_points, advanced_matchups = parse_advanced_report()
    key_data_points, why_it_matters, story_angles = build_key_sections(
        finals=finals,
        live=live,
        upcoming=upcoming,
        upcoming_games=upcoming_games,
        advanced_key_points=advanced_key_points,
        advanced_matchups=advanced_matchups,
        overnight_mode=overnight_mode,
    )

    final_heading = "FINAL SCORES"
    live_heading = "LIVE"
    upcoming_heading = "UPCOMING"

    if overnight_mode:
        final_heading = "FINAL SCORES (PREVIOUS DAY)"
        live_heading = "LIVE (LATE WINDOW)"
        upcoming_heading = "UPCOMING (TODAY)"

    lines: list[str] = [
        f"MLB PRO REPORT | {report_date()}",
        "",
        "HEADLINE",
        "Major League Baseball's schedule is driving the day, with the board centered on matchup setup, probable starters, and game-state movement.",
        "",
        "SNAPSHOT",
        snapshot_text,
        "",
        "KEY DATA POINTS",
    ]

    if key_data_points:
        lines.extend([f"- {clean_text(item)}" for item in key_data_points])
    else:
        lines.append("- No advanced MLB data points were available during this report window.")

    lines.extend(["", "WHY IT MATTERS"])

    if why_it_matters:
        lines.extend([f"- {clean_text(item)}" for item in why_it_matters])
    else:
        lines.append("- The clearest value on the board comes from schedule positioning and probable pitching context.")

    lines.extend(["", "STORY ANGLES"])

    if story_angles:
        lines.extend([f"- {clean_text(item)}" for item in story_angles])
    else:
        lines.append("- Pregame pitching context remains the clearest entry point for MLB coverage in this report window.")

    lines.extend(["", final_heading])

    if finals:
        lines.extend(finals)
    else:
        lines.append("No final scores were available during this report window.")

    lines.extend(["", live_heading])

    if live:
        lines.extend(live)
    else:
        lines.append("No live games were available during this report window.")

    lines.extend(["", upcoming_heading])

    if upcoming:
        lines.extend(upcoming)
    else:
        lines.append("No upcoming games were available during this report window.")

    lines.extend(["", DISCLAIMER, "", f"Generated: {generated_stamp()}"])

    return "\n".join(lines)


def build_fallback_report(reason: str) -> str:
    reason = clean_text(reason)
    return "\n".join(
        [
            f"MLB PRO REPORT | {report_date()}",
            "",
            "HEADLINE",
            "Major League Baseball remains in focus, but full report generation was limited during this window.",
            "",
            "SNAPSHOT",
            "The MLB board could not be fully processed during this report window.",
            "",
            "KEY DATA POINTS",
            "- Live MLB schedule data was temporarily unavailable.",
            "",
            "WHY IT MATTERS",
            "- Even when data is interrupted, the MLB board remains central to daily newsroom planning and preview coverage.",
            "",
            "STORY ANGLES",
            "- The next clean data pull should restore full matchup context, probable starters, and board-level framing.",
            "",
            "FINAL SCORES",
            "No final scores were available during this report window.",
            "",
            "LIVE",
            "No live games were available during this report window.",
            "",
            "UPCOMING",
            "No upcoming games were available during this report window.",
            "",
            DISCLAIMER,
            "",
            f"Generated: {generated_stamp()}",
            f"Fallback reason: {reason}",
        ]
    )


def classify_games(
    yesterday_games: list[dict[str, Any]],
    today_games: list[dict[str, Any]],
    overnight_mode: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if overnight_mode:
        final_games = [g for g in yesterday_games if game_status(g)[0] == "final"]
        live_games = [g for g in yesterday_games if game_status(g)[0] == "live"]
        upcoming_games = [g for g in today_games if game_status(g)[0] == "upcoming"]
        return final_games, live_games, upcoming_games

    today_finals = [g for g in today_games if game_status(g)[0] == "final"]
    today_live = [g for g in today_games if game_status(g)[0] == "live"]
    today_upcoming = [g for g in today_games if game_status(g)[0] == "upcoming"]
    return today_finals, today_live, today_upcoming


def main() -> None:
    try:
        now = now_et()
        overnight_mode = now.hour < OVERNIGHT_CUTOFF_HOUR

        today_date = now.strftime("%Y-%m-%d")
        yesterday_date = (now - timedelta(days=1)).strftime("%Y-%m-%d")

        today_payload = fetch_schedule(today_date)
        today_games = extract_games(today_payload)

        yesterday_games: list[dict[str, Any]] = []
        if overnight_mode:
            yesterday_payload = fetch_schedule(yesterday_date)
            yesterday_games = extract_games(yesterday_payload)

        final_games, live_games, upcoming_games = classify_games(
            yesterday_games=yesterday_games,
            today_games=today_games,
            overnight_mode=overnight_mode,
        )

        report = build_report(
            final_games=final_games,
            live_games=live_games,
            upcoming_games=upcoming_games,
            overnight_mode=overnight_mode,
        )
        save_report(report)

        print(report)
        print()
        print(f"Saved to {REPORT_FILE}")

    except Exception as exc:
        fallback = build_fallback_report(str(exc))
        save_report(fallback)

        print(fallback)
        print()
        print(f"Saved fallback to {REPORT_FILE}")


if __name__ == "__main__":
    main()