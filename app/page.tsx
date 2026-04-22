import fs from "fs";
import path from "path";

type Primitive = string | number | boolean | null | undefined;
type JsonValue = Primitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const VIDEO_URL =
  process.env.NEXT_PUBLIC_GSR_VIDEO_URL ||
  "https://www.youtube.com/embed/PMDQ82w1pAE?autoplay=1&mute=1";

const PRIMARY_ORDER = [
  "mlb",
  "nba",
  "nhl",
  "nfl",
  "ncaafb",
  "soccer",
  "fantasy",
  "betting_odds",
] as const;

type PrimaryKey = (typeof PRIMARY_ORDER)[number];

const PRIMARY_LABELS: Record<PrimaryKey, string> = {
  mlb: "MLB",
  nba: "NBA",
  nhl: "NHL",
  nfl: "NFL",
  ncaafb: "NCAA FOOTBALL",
  soccer: "SOCCER",
  fantasy: "FANTASY",
  betting_odds: "BETTING ODDS",
};

const HIDDEN_FIELDS = new Set([
  "source_file",
  "disclaimer",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLatestReport(): JsonObject {
  const filePath = path.join(process.cwd(), "public", "latest_report.json");

  try {
    if (!fs.existsSync(filePath)) {
      return {
        title: "GLOBAL SPORTS REPORT",
        generated_date: new Date().toLocaleString("en-US", {
          timeZone: "America/New_York",
          dateStyle: "full",
          timeStyle: "short",
        }),
        headline: "Latest report file not found.",
        snapshot: "Add public/latest_report.json to display live data.",
      };
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as JsonObject;

    if (isRecord(parsed)) return parsed;

    return {
      title: "GLOBAL SPORTS REPORT",
      generated_date: new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "full",
        timeStyle: "short",
      }),
      headline: "The JSON file loaded, but its root structure is invalid.",
      snapshot: "The file must contain a top-level JSON object.",
    };
  } catch (error) {
    return {
      title: "GLOBAL SPORTS REPORT",
      generated_date: new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "full",
        timeStyle: "short",
      }),
      headline: "There was an error reading latest_report.json.",
      snapshot:
        error instanceof Error ? error.message : "Unknown file read error.",
    };
  }
}

function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function cleanLabel(label: string): string {
  return label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();

  return (
    lower.includes("http 401") ||
    lower.includes("out_of_usage_credits") ||
    lower.includes("details_url") ||
    lower.includes("could not load odds") ||
    lower.includes("usage quota has been reached") ||
    lower.includes("the-odds-api.com")
  );
}

function cleanTextBlock(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !isNoiseLine(line));

  const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!cleaned) {
    return "Limited betting data was available during this report window.";
  }

  return cleaned;
}

function splitLines(text: string): string[] {
  return cleanTextBlock(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        const cleaned = cleanTextBlock(item);
        return cleaned ? splitLines(cleaned) : [];
      }

      if (typeof item === "number" || typeof item === "boolean") {
        return [String(item)];
      }

      if (isRecord(item)) {
        const bits = Object.entries(item)
          .filter(([k]) => !HIDDEN_FIELDS.has(k))
          .map(([k, v]) => {
            const text = toDisplayText(v);
            return text ? `${cleanLabel(k)}: ${text}` : "";
          })
          .filter(Boolean);

        return bits.length ? [bits.join(" | ")] : [];
      }

      return [];
    })
    .filter((item) => !isNoiseLine(item) && item.trim().length > 0);
}

function formatSectionText(value: unknown): string {
  if (typeof value === "string") return cleanTextBlock(value);

  if (Array.isArray(value)) {
    return normalizeArray(value).join("\n");
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([k]) => !HIDDEN_FIELDS.has(k))
      .map(([k, v]) => {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          const text = toDisplayText(v);
          return text && !isNoiseLine(text) ? `${cleanLabel(k)}: ${text}` : "";
        }

        if (Array.isArray(v)) {
          const arr = normalizeArray(v);
          return arr.length ? `${cleanLabel(k)}:\n${arr.map((x) => `- ${x}`).join("\n")}` : "";
        }

        return "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  return "";
}

function extractListItems(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeArray(value);

  if (typeof value === "string") {
    const lines = splitLines(value);
    return lines
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter((line) => !isNoiseLine(line));
  }

  return [];
}

function renderTextBlock(text: string) {
  const lines = splitLines(text);

  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^[-•*]\s*/, "").trim();
        const isBullet = /^[-•*]\s*/.test(line);

        if (!cleaned || isNoiseLine(cleaned)) return null;

        if (isBullet) {
          return (
            <li key={idx} className="ml-5 list-disc text-sm leading-6 text-zinc-300">
              {cleaned}
            </li>
          );
        }

        return (
          <p key={idx} className="text-sm leading-6 text-zinc-300">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function renderValue(value: unknown) {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const cleanedText = cleanTextBlock(value);
    const items = extractListItems(cleanedText);
    const bulletLike =
      items.length >= 2 &&
      splitLines(cleanedText).every((line) => /^[-•*]\s*/.test(line));

    if (bulletLike) {
      return (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="ml-5 list-disc text-sm leading-6 text-zinc-300">
              {item}
            </li>
          ))}
        </ul>
      );
    }

    return renderTextBlock(cleanedText);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <p className="text-sm leading-6 text-zinc-300">{String(value)}</p>;
  }

  if (Array.isArray(value)) {
    const items = normalizeArray(value);
    if (!items.length) return null;

    return (
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="ml-5 list-disc text-sm leading-6 text-zinc-300">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([key, v]) => {
      if (HIDDEN_FIELDS.has(key)) return false;
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return cleanTextBlock(v).trim().length > 0;
      if (Array.isArray(v)) return normalizeArray(v).length > 0;
      if (isRecord(v)) return Object.keys(v).some((k) => !HIDDEN_FIELDS.has(k));
      return true;
    });

    if (!entries.length) return null;

    return (
      <div className="space-y-4">
        {entries.map(([key, val]) => (
          <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {cleanLabel(key)}
            </h4>
            {renderValue(val)}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function getPrimaryCards(data: JsonObject) {
  return PRIMARY_ORDER.map((key) => {
    const value = data[key];
    if (!isRecord(value)) return null;

    return {
      key,
      label: PRIMARY_LABELS[key],
      value,
    };
  }).filter(Boolean) as { key: PrimaryKey; label: string; value: Record<string, unknown> }[];
}

function getExtraSections(data: JsonObject) {
  return Object.entries(data)
    .filter(([key, value]) => {
      return (
        !PRIMARY_ORDER.includes(key as PrimaryKey) &&
        isRecord(value) &&
        key !== "meta"
      );
    })
    .map(([key, value]) => ({
      key,
      label: cleanLabel(key),
      value: value as Record<string, unknown>,
    }));
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  if (!value.trim()) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg shadow-black/20">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {title}
      </div>
      <div className="text-sm leading-6 text-zinc-200">{value}</div>
    </div>
  );
}

function LeagueCard({
  title,
  section,
}: {
  title: string;
  section: Record<string, unknown>;
}) {
  const preferredOrder = [
    "title",
    "headline",
    "snapshot",
    "key_storylines",
    "key_data_points",
    "final_scores",
    "live",
    "upcoming",
    "analytics",
    "fantasy_spotlight",
    "betting_angles",
    "notable_lines",
    "watch_list",
    "content",
    "advanced",
    "body",
    "summary",
  ];

  const used = new Set<string>();
  const orderedEntries: [string, unknown][] = [];

  preferredOrder.forEach((field) => {
    if (field in section && !HIDDEN_FIELDS.has(field)) {
      orderedEntries.push([field, section[field]]);
      used.add(field);
    }
  });

  Object.entries(section).forEach(([key, value]) => {
    if (!used.has(key) && !HIDDEN_FIELDS.has(key)) {
      orderedEntries.push([key, value]);
    }
  });

  const hasAnyContent = orderedEntries.some(([key, value]) => {
    if (HIDDEN_FIELDS.has(key)) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return cleanTextBlock(value).trim().length > 0;
    if (Array.isArray(value)) return normalizeArray(value).length > 0;
    if (isRecord(value)) return Object.keys(value).some((k) => !HIDDEN_FIELDS.has(k));
    return true;
  });

  if (!hasAnyContent) return null;

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/85 p-5 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <h2 className="text-lg font-bold tracking-[0.16em] text-white">{title}</h2>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
          Live Desk
        </span>
      </div>

      <div className="space-y-4">
        {orderedEntries.map(([key, value]) => {
          if (HIDDEN_FIELDS.has(key)) return null;

          if (
            value === null ||
            value === undefined ||
            (typeof value === "string" && !cleanTextBlock(value).trim()) ||
            (Array.isArray(value) && normalizeArray(value).length === 0) ||
            (isRecord(value) &&
              !Object.entries(value).some(([childKey, childVal]) => {
                if (HIDDEN_FIELDS.has(childKey)) return false;
                if (childVal === null || childVal === undefined) return false;
                if (typeof childVal === "string") return cleanTextBlock(childVal).trim().length > 0;
                if (Array.isArray(childVal)) return normalizeArray(childVal).length > 0;
                if (isRecord(childVal)) return Object.keys(childVal).length > 0;
                return true;
              }))
          ) {
            return null;
          }

          const isTitle = key === "title";
          const showAsHeadingOnly =
            isTitle && typeof value === "string" && value.trim().length > 0;

          if (showAsHeadingOnly) {
            return (
              <div key={key} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                <p className="text-sm font-semibold tracking-wide text-zinc-100">{value}</p>
              </div>
            );
          }

          return (
            <div key={key} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                {cleanLabel(key)}
              </h3>
              {renderValue(value)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Page() {
  const data = readLatestReport();

  const title = toDisplayText(data.title) || "GLOBAL SPORTS REPORT";
  const generatedDate =
    toDisplayText(data.generated_date) ||
    toDisplayText(data.generated_at) ||
    new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    });

  const headline = formatSectionText(data.headline);
  const snapshot = formatSectionText(data.snapshot);
  const keyStorylines = data.key_storylines;
  const primaryCards = getPrimaryCards(data);
  const extraSections = getExtraSections(data);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[1.15fr_0.85fr] xl:items-stretch">
            <div className="space-y-4">
              <div className="inline-flex w-fit rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                Built for Journalists
              </div>

              <div>
                <h1 className="text-3xl font-black uppercase tracking-[0.14em] text-white sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-2 text-sm text-zinc-400">Updated: {generatedDate}</p>
              </div>

              {headline ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Headline
                  </div>
                  <p className="text-base leading-7 text-zinc-100">{headline}</p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <SummaryCard title="Snapshot" value={snapshot} />
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg shadow-black/20">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Newsroom Note
                  </div>
                  <p className="text-sm leading-6 text-zinc-200">
                    This report is an automated summary intended to support, not replace,
                    human sports journalism.
                  </p>
                </div>
              </div>

              {keyStorylines ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg shadow-black/20">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Key Storylines
                  </div>
                  {renderValue(keyStorylines)}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
              <div className="border-b border-zinc-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Yahoo Sports Network
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={VIDEO_URL}
                  title="Yahoo Sports Network Live"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </header>

        {primaryCards.length ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400">
                League Reports
              </h2>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {primaryCards.map((card) => (
                <LeagueCard key={card.key} title={card.label} section={card.value} />
              ))}
            </div>
          </section>
        ) : null}

        {extraSections.length ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400">
                Additional Coverage
              </h2>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {extraSections.map((section) => (
                <LeagueCard key={section.key} title={section.label} section={section.value} />
              ))}
            </div>
          </section>
        ) : null}

        <footer className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 text-center shadow-2xl shadow-black/40">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            Global Sports Report
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Automated sports journalism support for the modern newsroom.
          </p>
        </footer>
      </div>
    </main>
  );
}