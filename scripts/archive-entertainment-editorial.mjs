import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function parsePublishedDate(value) {
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+ET$/i,
  );
  if (!match) return null;

  const [, year, month, day, hourText, minute, second, meridiem] = match;
  let hour = Number(hourText) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;

  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour,
    Number(minute),
    Number(second),
  );
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date(localAsUtc))
    .find((part) => part.type === "timeZoneName")?.value;
  const offsetMatch = timeZoneName?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!offsetMatch) return null;

  const offsetMinutes =
    (offsetMatch[1] === "+" ? 1 : -1) *
    (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] ?? 0));
  return new Date(localAsUtc - offsetMinutes * 60_000);
}

export function isEditorialStory(value) {
  const context = value?.snapshot ?? value?.summary;
  const sourceName = value?.source_name ?? value?.source;
  const published = value?.published_at ?? value?.published;

  if (
    !value ||
    typeof value !== "object" ||
    !value.headline ||
    !context ||
    !value.url ||
    !sourceName ||
    !published ||
    !parsePublishedDate(published)
  ) {
    return false;
  }

  try {
    new URL(value.url);
    return true;
  } catch {
    return false;
  }
}

export function storySlug(story) {
  const published = story.published_at ?? story.published;
  const date = parsePublishedDate(published)?.toISOString().slice(0, 10) ?? "undated";
  const headline = story.headline
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const source = new URL(story.url).hostname
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-");

  return `${date}-${headline}-${source}`;
}

export function mergeEditorialStories(archived, reports) {
  const unique = new Map();

  for (const story of archived) {
    if (isEditorialStory(story)) unique.set(storySlug(story), story);
  }

  for (const report of reports) {
    const cards = Array.isArray(report?.homepage_cards)
      ? report.homepage_cards
      : [];

    for (const story of cards) {
      if (isEditorialStory(story)) unique.set(storySlug(story), story);
    }
  }

  return [...unique.values()].sort((a, b) => {
    const aPublished = a.published_at ?? a.published;
    const bPublished = b.published_at ?? b.published;
    return (
      (parsePublishedDate(bPublished)?.getTime() ?? 0) -
      (parsePublishedDate(aPublished)?.getTime() ?? 0)
    );
  });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function reportsFromHistory(repoRoot, sinceCommit) {
  const range = sinceCommit ? `${sinceCommit}^..HEAD` : "HEAD";
  const hashes = execFileSync(
    "git",
    ["log", "--format=%H", range, "--", "public/latest_report.json"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean);

  return hashes.flatMap((hash) => {
    try {
      const json = execFileSync(
        "git",
        ["show", `${hash}:public/latest_report.json`],
        { cwd: repoRoot, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
      );
      return [JSON.parse(json)];
    } catch {
      return [];
    }
  });
}

export function updateArchive({ reportPath, archivePath, historicalReports = [] }) {
  const report = readJson(reportPath, {});
  const archived = readJson(archivePath, []);
  const merged = mergeEditorialStories(
    Array.isArray(archived) ? archived : [],
    [...historicalReports, report],
  );
  const output = `${JSON.stringify(merged, null, 2)}\n`;
  const previous = fs.existsSync(archivePath)
    ? fs.readFileSync(archivePath, "utf8")
    : "";

  if (output !== previous) {
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.writeFileSync(archivePath, output, "utf8");
  }

  return { changed: output !== previous, count: merged.length };
}

const isMain = process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const reportPath = path.join(repoRoot, "public", "latest_report.json");
  const archivePath = path.join(
    repoRoot,
    "public",
    "entertainment-editorial-archive.json",
  );
  const sinceIndex = process.argv.indexOf("--history-since");
  const historicalReports = sinceIndex >= 0
    ? reportsFromHistory(repoRoot, process.argv[sinceIndex + 1])
    : [];
  const result = updateArchive({ reportPath, archivePath, historicalReports });
  console.log(
    `Entertainment editorial archive: ${result.count} stories (${result.changed ? "updated" : "unchanged"}).`,
  );
}
