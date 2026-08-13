import { list } from "@vercel/blob";
import report from "../../public/latest_report.json";

export const SITE_URL = "https://www.globalentertainmentreport.com";

export type EditorialItem = {
  slug: string;
  headline: string;
  context: string;
  keyData: string[];
  whyItMatters: string[];
  whatToWatch: string[];
  storyAngles: string[];
  sourceName: string;
  sourceUrl: string;
  published: string;
};

type ReportItem = {
  headline?: string;
  snapshot?: string;
  summary?: string;
  url?: string;
  source_name?: string;
  source?: string;
  published_at?: string;
  published?: string;
  key_data?: unknown;
  why_it_matters?: unknown;
  what_to_watch?: unknown;
  story_angles?: unknown;
  reporting_angles?: unknown;
};

function toTextList(value: unknown): string[] {
  if (!value) return [];
  const values = Array.isArray(value)
    ? value
    : typeof value === "object"
      ? Object.values(value)
      : String(value).split(/\n|\u2022|\|/);
  return values
    .map((item) => String(item).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parsePublishedDate(value: string): Date | null {
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = value.match(
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

export function slugFor(item: ReportItem): string {
  const published = item.published_at ?? item.published ?? "";
  const date = parsePublishedDate(published)?.toISOString().slice(0, 10) ?? "undated";
  const headline = (item.headline ?? "editorial")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const source = item.url
    ? new URL(item.url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/g, "-")
    : "source";
  return `${date}-${headline}-${source}`;
}

export function toEditorialItem(item: ReportItem): EditorialItem | null {
  const context = item.snapshot ?? item.summary;
  const sourceName = item.source_name ?? item.source;
  const published = item.published_at ?? item.published;
  if (!item.headline || !context || !item.url || !sourceName || !published) return null;

  return {
    slug: slugFor(item),
    headline: item.headline,
    context,
    keyData: toTextList(item.key_data),
    whyItMatters: toTextList(item.why_it_matters),
    whatToWatch: toTextList(item.what_to_watch),
    storyAngles: toTextList(item.story_angles ?? item.reporting_angles),
    sourceName,
    sourceUrl: item.url,
    published,
  };
}

export const seededEditorialItems: EditorialItem[] = (
  report.homepage_cards as ReportItem[]
)
  .map(toEditorialItem)
  .filter((item): item is EditorialItem => item !== null);

async function getStoredEditorialItems(): Promise<EditorialItem[]> {
  try {
    const { blobs } = await list({ prefix: "editorial/", limit: 1000 });
    const items = await Promise.all(
      blobs.filter((blob) => blob.pathname.endsWith(".json")).map(async (blob) => {
        const response = await fetch(blob.url, { next: { revalidate: 300 } });
        return response.ok ? ((await response.json()) as EditorialItem) : null;
      }),
    );
    return items.filter((item): item is EditorialItem => item !== null);
  } catch {
    return [];
  }
}

export async function getEditorialItems(): Promise<EditorialItem[]> {
  const stored = await getStoredEditorialItems();
  const unique = new Map<string, EditorialItem>();
  [...seededEditorialItems, ...stored].forEach((item) => unique.set(item.slug, item));
  return [...unique.values()].sort((a, b) => {
    const aTime = parsePublishedDate(a.published)?.getTime() ?? 0;
    const bTime = parsePublishedDate(b.published)?.getTime() ?? 0;
    return bTime - aTime;
  });
}
