import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportSection = {
  name: string;
  content: string;
};

type ReportData = {
  title: string;
  headline?: string;
  key_storylines?: string[];
  sections?: ReportSection[];
  full_report?: string;
  updated_at?: string;
  disclaimer?: string;
};

const WATCH_OPTIONS = [
  "MLB",
  "NBA",
  "NFL",
  "NHL",
  "Soccer",
  "WNBA",
  "NCAAFB",
  "Betting Odds",
  "Fantasy",
];

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

function normalizeText(value?: string): string {
  if (!value) return "";
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFullSearchText(report: ReportData): string {
  const sectionText =
    report.sections?.map((section) => `${section.name}\n${section.content}`).join("\n\n") || "";

  return normalizeText(
    [
      report.title || "",
      report.headline || "",
      (report.key_storylines || []).join("\n"),
      sectionText,
      report.full_report || "",
      report.disclaimer || "",
    ].join("\n\n")
  );
}

function getSection(report: ReportData, name: string): ReportSection | undefined {
  return report.sections?.find(
    (section) => section.name.toLowerCase().trim() === name.toLowerCase().trim()
  );
}

function getSectionByIncludes(report: ReportData, term: string): ReportSection | undefined {
  return report.sections?.find((section) =>
    section.name.toLowerCase().includes(term.toLowerCase())
  );
}

function extractLinesContainingTerm(text: string, term: string, maxLines = 6): string[] {
  if (!text || !term) return [];

  const lowerTerm = term.toLowerCase();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const matches: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().includes(lowerTerm)) {
      matches.push(line);
    }
    if (matches.length >= maxLines) break;
  }

  return matches;
}

function getWatchFallback(label: string, term: string): string[] {
  const cleanTerm = term.trim() || label;

  if (label === "PLAYER WATCH") {
    return [`${cleanTerm} was not mentioned in today’s report window.`];
  }

  if (label === "TEAM WATCH") {
    return [`No recent updates found for ${cleanTerm}.`];
  }

  if (label === "QUERY WATCH") {
    return [`No direct matches were found for ${cleanTerm}.`];
  }

  return [`No direct matches were found for ${cleanTerm}.`];
}

function buildWatchSummary(label: string, term: string, matches: string[]): string[] {
  if (matches.length > 0) return matches;
  return getWatchFallback(label, term);
}

function getLeagueFocus(report: ReportData, league: string): string[] {
  const directSection = getSection(report, league);
  const fallbackSection = getSectionByIncludes(report, league);
  const section = directSection || fallbackSection;

  if (!section?.content) {
    return [`No direct ${league} section was available in this report window.`];
  }

  const cleaned = normalizeText(section.content);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.toLowerCase().startsWith("generated:") &&
        !line.toLowerCase().startsWith("updated:")
    );

  return lines.slice(0, 8);
}

function getSectionCards(report: ReportData): ReportSection[] {
  return (report.sections || []).filter((section) => {
    const name = section.name.toLowerCase();
    return (
      name !== "full report" &&
      name !== "disclaimer" &&
      name !== "headline" &&
      normalizeText(section.content).length > 0
    );
  });
}

export default function HomePage() {
  const report = readReportData();

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
            <h1 className="text-3xl font-bold tracking-tight">Global Sports Report</h1>
            <p className="mt-4 text-slate-300">Could not load report data.</p>
          </div>
        </div>
      </main>
    );
  }

  const fullSearchText = getFullSearchText(report);
  const playerWatch = buildWatchSummary(
    "PLAYER WATCH",
    "Shohei Ohtani",
    extractLinesContainingTerm(fullSearchText, "Shohei Ohtani", 4)
  );
  const teamWatch = buildWatchSummary(
    "TEAM WATCH",
    "Inter Miami",
    extractLinesContainingTerm(fullSearchText, "Inter Miami", 4)
  );
  const queryWatch = buildWatchSummary(
    "QUERY WATCH",
    "Messi Inter Miami",
    extractLinesContainingTerm(fullSearchText, "Messi Inter Miami", 4)
  );
  const soccerFocus = getLeagueFocus(report, "Soccer");
  const cards = getSectionCards(report);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
                Automated sports journalism support
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
                {report.title || "Global Sports Report"}
              </h1>
              {report.headline ? (
                <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                  {report.headline}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px]">
              <div className="rounded-2xl border border-blue-900/50 bg-slate-900/80 p-4">
                <div className="text-xs uppercase tracking-widest text-blue-300">Updated</div>
                <div className="mt-2 text-sm font-medium text-slate-100">
                  {report.updated_at || "Not available"}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-900/50 bg-slate-900/80 p-4">
                <div className="text-xs uppercase tracking-widest text-blue-300">Edition</div>
                <div className="mt-2 text-sm font-medium text-slate-100">Daily Newsroom View</div>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Top Storylines</h2>
              <span className="rounded-full border border-blue-900/60 bg-blue-950/50 px-3 py-1 text-xs uppercase tracking-widest text-blue-300">
                Live File Read
              </span>
            </div>

            {report.key_storylines && report.key_storylines.length > 0 ? (
              <div className="space-y-3">
                {report.key_storylines.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
                No key storylines were available in the current report.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Search Center</h2>
            <p className="mt-2 text-sm text-slate-300">
              Use this area later for dynamic player, team, and league lookups.
            </p>

            <div className="mt-5 space-y-3">
              <select
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none"
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a league or report section
                </option>
                {WATCH_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search players, teams, leagues, or topics"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
              />

              <button
                type="button"
                className="w-full rounded-2xl border border-blue-800 bg-blue-900/70 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Search GSR
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
              Front-end layout is ready here. Dynamic search behavior can be wired in next.
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="text-xs uppercase tracking-widest text-blue-300">Player Watch</div>
            <h3 className="mt-2 text-lg font-semibold">Shohei Ohtani</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {playerWatch.map((item, index) => (
                <p key={`player-${index}`} className="rounded-2xl bg-slate-950/60 p-3">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="text-xs uppercase tracking-widest text-blue-300">Team Watch</div>
            <h3 className="mt-2 text-lg font-semibold">Inter Miami</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {teamWatch.map((item, index) => (
                <p key={`team-${index}`} className="rounded-2xl bg-slate-950/60 p-3">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="text-xs uppercase tracking-widest text-blue-300">Query Watch</div>
            <h3 className="mt-2 text-lg font-semibold">Messi Inter Miami</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {queryWatch.map((item, index) => (
                <p key={`query-${index}`} className="rounded-2xl bg-slate-950/60 p-3">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="text-xs uppercase tracking-widest text-blue-300">Soccer Focus</div>
            <h3 className="mt-2 text-lg font-semibold">Latest Soccer Snapshot</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {soccerFocus.map((item, index) => (
                <p key={`soccer-${index}`} className="rounded-2xl bg-slate-950/60 p-3">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">League and Topic Sections</h2>
            <span className="text-xs uppercase tracking-widest text-slate-400">
              Parsed from latest_report.json
            </span>
          </div>

          {cards.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {cards.map((section) => {
                const lines = normalizeText(section.content)
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 8);

                return (
                  <article
                    key={section.name}
                    className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"
                  >
                    <h3 className="text-lg font-semibold text-blue-300">{section.name}</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      {lines.length > 0 ? (
                        lines.map((line, index) => (
                          <p key={`${section.name}-${index}`} className="leading-6 break-words">
                            {line}
                          </p>
                        ))
                      ) : (
                        <p>No content available.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              No report sections were available to display.
            </div>
          )}
        </section>

        {report.full_report ? (
          <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Full Report</h2>

            <div className="mt-4 max-h-[500px] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                {normalizeText(report.full_report)}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}