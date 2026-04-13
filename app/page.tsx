import fs from "fs";
import path from "path";

type ReportSection = {
  name: string;
  content: string;
};

type ReportData = {
  title: string;
  headline?: string;
  updated_at?: string;
  edition?: string;
  disclaimer?: string;
  key_storylines?: string[];
  full_report?: string;
  sections?: ReportSection[];
};

function readReportData(): ReportData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to read latest_report.json:", error);
    return null;
  }
}

export const dynamic = "force-dynamic";

/* ---------------- UTILS ---------------- */

function cleanText(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/\r/g, "")
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€"/g, "—")
    .replace(/â€“/g, "–")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function splitLines(value: string | undefined | null): string[] {
  return cleanText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeForMatch(value: string): string {
  return cleanText(value).toLowerCase();
}

function dedupe(lines: string[]): string[] {
  return [...new Set(lines.map((line) => cleanText(line)).filter(Boolean))];
}

/* ---------------- DATA HELPERS ---------------- */

function getSections(report: ReportData): ReportSection[] {
  if (!Array.isArray(report.sections)) return [];
  return report.sections.map((section) => ({
    name: cleanText(section.name),
    content: cleanText(section.content),
  }));
}

function getLeagueBadge(name: string): string {
  const key = normalizeForMatch(name);
  if (key.includes("mlb")) return "MLB";
  if (key.includes("nba")) return "NBA";
  if (key.includes("nfl")) return "NFL";
  if (key.includes("nhl")) return "NHL";
  if (key.includes("soccer")) return "SOCCER";
  if (key.includes("fantasy")) return "FANTASY";
  if (key.includes("betting")) return "BETTING";
  return "SECTION";
}

function getLeagueColor(name: string): string {
  const key = normalizeForMatch(name);
  if (key.includes("mlb")) return "border-blue-300 bg-blue-50";
  if (key.includes("nba")) return "border-sky-300 bg-sky-50";
  if (key.includes("nfl")) return "border-indigo-300 bg-indigo-50";
  if (key.includes("nhl")) return "border-cyan-300 bg-cyan-50";
  if (key.includes("soccer")) return "border-teal-300 bg-teal-50";
  if (key.includes("fantasy")) return "border-violet-300 bg-violet-50";
  if (key.includes("betting")) return "border-emerald-300 bg-emerald-50";
  return "border-slate-300 bg-white";
}

function findMatches(lines: string[], query: string): string[] {
  const q = normalizeForMatch(query);
  if (!q) return [];

  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "at",
    "vs",
    "of",
    "in",
    "on",
  ]);

  const terms = q
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term && !stopWords.has(term));

  const scored = lines
    .map((line) => {
      const normalizedLine = normalizeForMatch(line);

      if (normalizedLine.includes(q)) {
        return { line, score: 100 };
      }

      const matchCount = terms.filter((term) =>
        normalizedLine.includes(term)
      ).length;

      return { line, score: matchCount };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedupe(scored.map((item) => item.line)).slice(0, 12);
}

function getGlobalLines(report: ReportData): string[] {
  const lines: string[] = [];

  if (report.title) lines.push(report.title);
  if (report.headline) lines.push(report.headline);
  if (report.updated_at) lines.push(report.updated_at);
  if (report.edition) lines.push(report.edition);
  if (report.disclaimer) lines.push(report.disclaimer);

  if (Array.isArray(report.key_storylines)) {
    for (const storyline of report.key_storylines) {
      lines.push(cleanText(storyline));
    }
  }

  if (report.full_report) {
    lines.push(...splitLines(report.full_report));
  }

  if (Array.isArray(report.sections)) {
    for (const section of report.sections) {
      lines.push(cleanText(section.name));
      lines.push(...splitLines(section.content));
    }
  }

  return dedupe(lines);
}

/* ---------------- PAGE ---------------- */

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params?.q) ? params.q[0] : params?.q;
  const query = cleanText(rawQuery || "");

  const report = readReportData();

  if (!report) {
    return <main className="p-8">Could not load report.</main>;
  }

  const sections = getSections(report);

  const headline =
    cleanText(report.headline) ||
    "Automated sports journalism support for the modern newsroom.";

  const updatedAt =
    cleanText(report.updated_at) || "Update time unavailable";

  const topStorylines = (report.key_storylines || [])
    .map(cleanText)
    .filter(Boolean);

  const globalLines = getGlobalLines(report);
  const globalMatches = query ? findMatches(globalLines, query) : [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
          <h1 className="text-4xl font-bold">{cleanText(report.title)}</h1>
          <p className="mt-3 text-lg text-slate-300">{headline}</p>
          <div className="mt-3 text-sm text-slate-400">{updatedAt}</div>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold">Search Center</h2>

          <form action="/" method="GET" className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search players, teams, leagues, or topics"
              className="flex-1 rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800"
            >
              Search
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600">
            Search the latest GSR report by player, team, league, or topic.
          </div>
        </section>

        {query && (
          <section className="mt-6 rounded-3xl bg-white p-6 shadow">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Search Results</h2>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                Query: <span className="font-semibold text-slate-900">{query}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {globalMatches.length > 0 ? (
                globalMatches.map((line, index) => (
                  <div
                    key={`${index}-${line.slice(0, 40)}`}
                    className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-800"
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 text-slate-500">
                  No matches found for "{query}" in the current report data.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold">Top Storylines</h2>

          <div className="mt-4 space-y-2">
            {topStorylines.length > 0 ? (
              topStorylines.map((storyline, index) => (
                <div key={index} className="rounded-xl bg-slate-50 p-3">
                  {storyline}
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-slate-500">
                No storylines available in this edition.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {sections.map((section) => {
            const lines = splitLines(section.content);
            const matches = query ? findMatches(lines, query) : lines.slice(0, 6);

            return (
              <div
                key={section.name}
                className={`rounded-3xl border p-5 ${getLeagueColor(section.name)}`}
              >
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                  {getLeagueBadge(section.name)}
                </div>

                <h3 className="mb-3 text-lg font-bold">{section.name}</h3>

                <div className="space-y-2">
                  {matches.length > 0 ? (
                    matches.map((line, index) => (
                      <div key={index} className="rounded bg-white p-2">
                        {line}
                      </div>
                    ))
                  ) : query ? (
                    <div className="rounded bg-white p-2 text-slate-500">
                      No direct matches in this section.
                    </div>
                  ) : (
                    <div className="rounded bg-white p-2 text-slate-500">
                      No content available in this section.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <footer className="mt-6 rounded-3xl bg-slate-900 p-4 text-white">
          {cleanText(report.disclaimer) ||
            "This report is an automated summary intended to support, not replace, human sports journalism."}
        </footer>
      </div>
    </main>
  );
}