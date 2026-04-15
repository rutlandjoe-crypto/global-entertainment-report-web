export const dynamic = "force-dynamic";
import fs from "fs";
import path from "path";

type AdvancedReportSections = {
  statcast_watch?: string[];
  matchup_flags?: string[];
  pitcher_signals?: string[];
  hitter_signals?: string[];
  bullpen_signals?: string[];
  team_trends?: string[];
  betting_signals?: string[];
  editors_note?: string[];
  editor_s_note?: string[];
  league_efficiency_watch?: string[];
  team_efficiency_watch?: string[];
  draft_signals?: string[];
  why_it_matters?: string[];
  story_angles?: string[];
  key_data_points?: string[];
  watch_list?: string[];
  report_note?: string[];
  [key: string]: string[] | undefined;
};

type AdvancedReport = {
  title?: string;
  source_file?: string;
  updated_at?: string;
  sections?: AdvancedReportSections;
};

type ReportSection = {
  name: string;
  title?: string;
  headline?: string;
  snapshot?: string;
  key_storylines?: string[];
  content: string;
  source_file?: string;
  advanced?: AdvancedReport;
};

type ReportData = {
  title: string;
  headline?: string;
  key_storylines?: string[];
  snapshot?: string;
  sections?: ReportSection[];
  full_text?: string;
  generated_at?: string;
  updated_at?: string;
  published_at?: string;
  disclaimer?: string;
};

function readReportData(): ReportData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ReportData;

    return {
      title: parsed.title || "GLOBAL SPORTS REPORT",
      headline: parsed.headline || "",
      key_storylines: Array.isArray(parsed.key_storylines)
        ? parsed.key_storylines
        : [],
      snapshot: parsed.snapshot || "",
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      full_text: parsed.full_text || "",
      generated_at: parsed.generated_at || "",
      updated_at: parsed.updated_at || parsed.generated_at || "",
      published_at: parsed.published_at || parsed.updated_at || parsed.generated_at || "",
      disclaimer: parsed.disclaimer || "",
    };
  } catch (error) {
    console.error("Failed to read latest_report.json:", error);
    return null;
  }
}

function normalizeSectionName(name: string): string {
  return name.trim().toUpperCase();
}

function isDraftSection(name: string): boolean {
  const normalized = normalizeSectionName(name);
  return normalized === "NFL DRAFT SIGNALS" || normalized === "NFL_DRAFT";
}

function sectionTone(name: string): string {
  switch (normalizeSectionName(name)) {
    case "MLB":
      return "border-blue-200 bg-blue-50";
    case "NBA":
      return "border-orange-200 bg-orange-50";
    case "NHL":
      return "border-sky-200 bg-sky-50";
    case "NFL":
      return "border-emerald-200 bg-emerald-50";
    case "NFL DRAFT SIGNALS":
    case "NFL_DRAFT":
      return "border-fuchsia-200 bg-fuchsia-50";
    case "SOCCER":
      return "border-lime-200 bg-lime-50";
    case "FANTASY":
      return "border-violet-200 bg-violet-50";
    case "BETTING":
      return "border-rose-200 bg-rose-50";
    default:
      return "border-slate-200 bg-white";
  }
}

function advancedTone(name: string): string {
  switch (normalizeSectionName(name)) {
    case "MLB":
      return "border-indigo-200 bg-indigo-50";
    case "NBA":
      return "border-amber-200 bg-amber-50";
    case "NHL":
      return "border-cyan-200 bg-cyan-50";
    case "NFL":
      return "border-teal-200 bg-teal-50";
    case "NFL DRAFT SIGNALS":
    case "NFL_DRAFT":
      return "border-purple-200 bg-purple-50";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function formatAdvancedHeading(key: string): string {
  return key.replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

function getAdvancedSectionEntries(
  advanced?: AdvancedReport
): Array<[string, string[]]> {
  if (!advanced?.sections || typeof advanced.sections !== "object") {
    return [];
  }

  const orderedKeys = [
    "statcast_watch",
    "matchup_flags",
    "pitcher_signals",
    "hitter_signals",
    "bullpen_signals",
    "team_trends",
    "betting_signals",
    "league_efficiency_watch",
    "team_efficiency_watch",
    "draft_signals",
    "key_data_points",
    "why_it_matters",
    "story_angles",
    "watch_list",
    "report_note",
    "editors_note",
    "editor_s_note",
  ];

  const usedKeys = new Set<string>();
  const entries: Array<[string, string[]]> = [];

  for (const key of orderedKeys) {
    const value = advanced.sections[key];
    if (Array.isArray(value) && value.length > 0) {
      entries.push([key, value]);
      usedKeys.add(key);
    }
  }

  for (const [key, value] of Object.entries(advanced.sections)) {
    if (usedKeys.has(key)) {
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      entries.push([key, value]);
    }
  }

  return entries;
}

function hasAdvancedContent(advanced?: AdvancedReport): boolean {
  return getAdvancedSectionEntries(advanced).length > 0;
}

function removeSectionBlock(content: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|\\n)${escapedHeading}\\s*\\n[\\s\\S]*?(?=\\n[A-Z][A-Z '()/-]+\\n|$)`,
    "m"
  );

  return content.replace(pattern, "\n").trim();
}

function getVisibleBodyContent(content: string): string {
  let cleaned = content.trim();

  cleaned = removeSectionBlock(cleaned, "HEADLINE");
  cleaned = removeSectionBlock(cleaned, "SNAPSHOT");
  cleaned = removeSectionBlock(cleaned, "KEY STORYLINES");

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

function formatSectionContent(content: string): string[] {
  return getVisibleBodyContent(content)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function renderBodyLine(line: string, key: string) {
  const isLabel =
    line === "FINAL SCORES" ||
    line === "LIVE" ||
    line === "UPCOMING" ||
    line === "TOP BOARD" ||
    line === "GLOBAL SNAPSHOT" ||
    line === "FALLBACK NOTE" ||
    line === "BETTING MARKET NOTE" ||
    line === "MATCHUP FLAGS" ||
    line === "LEAGUE EFFICIENCY WATCH" ||
    line === "TEAM EFFICIENCY WATCH" ||
    line === "WHY IT MATTERS" ||
    line === "STORY ANGLES" ||
    line === "KEY DATA POINTS" ||
    line === "DRAFT SIGNALS" ||
    line === "WATCH LIST" ||
    line === "REPORT NOTE";

  if (isLabel) {
    return (
      <div
        key={key}
        className="pt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500"
      >
        {line}
      </div>
    );
  }

  const isBulletLike =
    line.startsWith("- ") ||
    line.startsWith("• ") ||
    /^[A-Z][A-Za-z\s'.()&/-]+ \(\d/.test(line);

  if (isBulletLike) {
    const cleanedLine = line.replace(/^[-•]\s*/, "").trim();
    return (
      <div key={key} className="flex gap-2 text-sm leading-7 text-slate-800">
        <span className="font-bold text-slate-500">-</span>
        <span>{cleanedLine}</span>
      </div>
    );
  }

  return (
    <p key={key} className="text-sm leading-7 text-slate-800">
      {line}
    </p>
  );
}

function sectionBadge(name: string): string {
  if (isDraftSection(name)) {
    return "Draft Intel";
  }

  switch (normalizeSectionName(name)) {
    case "FANTASY":
      return "Cross-League";
    case "BETTING":
      return "Market Watch";
    default:
      return "Section";
  }
}

function sectionSortValue(name: string): number {
  switch (normalizeSectionName(name)) {
    case "MLB":
      return 1;
    case "NBA":
      return 2;
    case "NHL":
      return 3;
    case "NFL":
      return 4;
    case "NFL DRAFT SIGNALS":
    case "NFL_DRAFT":
      return 5;
    case "SOCCER":
      return 6;
    case "FANTASY":
      return 7;
    case "BETTING":
      return 8;
    default:
      return 99;
  }
}

function inferStorylineLabel(item: string, index: number): string {
  const text = item.toLowerCase();

  const isAnalytics =
    text.includes("advanced") ||
    text.includes("statcast") ||
    text.includes("efficiency") ||
    text.includes("epa") ||
    text.includes("spin rate") ||
    text.includes("analytics");

  const isDraft =
    text.includes("draft") ||
    text.includes("quarterback") ||
    text.includes("roster") ||
    text.includes("first round");

  const isMLB =
    text.includes("mlb") ||
    text.includes("baseball") ||
    text.includes("probable starters") ||
    text.includes("pitching") ||
    text.includes("diamondbacks") ||
    text.includes("orioles");

  const isNBA =
    text.includes("nba") ||
    text.includes("pace") ||
    text.includes("net rating") ||
    text.includes("hornets") ||
    text.includes("heat") ||
    text.includes("suns") ||
    text.includes("trail blazers");

  const isNFL =
    text.includes("nfl") ||
    text.includes("epa") ||
    text.includes("pass efficiency") ||
    text.includes("rushing") ||
    text.includes("patriots") ||
    text.includes("bills") ||
    text.includes("rams");

  const isNHL =
    text.includes("nhl") ||
    text.includes("sabres") ||
    text.includes("lightning") ||
    text.includes("golden knights");

  const isSoccer =
    text.includes("soccer") ||
    text.includes("barcelona") ||
    text.includes("psg") ||
    text.includes("madrid");

  const isBetting =
    text.includes("betting") ||
    text.includes("moneyline") ||
    text.includes("spread") ||
    text.includes("odds");

  const isFantasy = text.includes("fantasy");

  if (isDraft) {
    return "NFL Draft Update";
  }
  if (isMLB && isAnalytics) {
    return "MLB Data Point";
  }
  if (isNBA && isAnalytics) {
    return "NBA Data Point";
  }
  if (isNFL && isAnalytics) {
    return "NFL Data Point";
  }
  if (isMLB) {
    return "MLB Update";
  }
  if (isNBA) {
    return "NBA Update";
  }
  if (isNFL) {
    return "NFL Update";
  }
  if (isNHL) {
    return "NHL Update";
  }
  if (isSoccer) {
    return "Soccer Update";
  }
  if (isBetting) {
    return "Betting Update";
  }
  if (isFantasy) {
    return "Fantasy Update";
  }
  if (isAnalytics) {
    return "Analytics Update";
  }

  return `Top Update ${index + 1}`;
}

export default function HomePage() {
  const report = readReportData();

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-black tracking-tight">
              Global Sports Report
            </h1>
            <p className="mt-4 text-base text-slate-700">
              The report feed could not be loaded from{" "}
              <span className="font-semibold">public/latest_report.json</span>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const {
    title,
    headline,
    key_storylines,
    snapshot,
    sections,
    full_text,
    published_at,
    disclaimer,
  } = report;

  const sortedSections = [...(sections ?? [])].sort(
    (a, b) => sectionSortValue(a.name) - sectionSortValue(b.name)
  );

  const sectionCount = sortedSections.length;
  const advancedSectionCount = sortedSections.filter((section) =>
    hasAdvancedContent(section.advanced)
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                Automated newsroom feed
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                {title}
              </h1>

              {headline ? (
                <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700">
                  {headline}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Report published</div>
              <div className="mt-1">{published_at || "Unavailable"}</div>
            </div>
          </div>

          {key_storylines && key_storylines.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Key Storylines
              </h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {key_storylines.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      {inferStorylineLabel(item, index)}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-800">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {snapshot ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Snapshot
              </div>
              <p className="mt-2 text-base font-medium text-slate-800">
                {snapshot}
              </p>
            </section>
          ) : null}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5">
            {sortedSections.length > 0 ? (
              sortedSections.map((section) => {
                const lines = formatSectionContent(section.content);
                const advancedEntries = getAdvancedSectionEntries(section.advanced);

                return (
                  <article
                    key={section.name}
                    className={`rounded-3xl border p-5 shadow-sm ${sectionTone(
                      section.name
                    )}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-2xl font-black tracking-tight">
                        {section.name}
                      </h2>
                      <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                        {sectionBadge(section.name)}
                      </div>
                    </div>

                    {section.headline ? (
                      <p className="mt-4 text-base leading-7 text-slate-800">
                        {section.headline}
                      </p>
                    ) : null}

                    {section.snapshot ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Snapshot
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-800">
                          {section.snapshot}
                        </p>
                      </div>
                    ) : null}

                    {section.key_storylines && section.key_storylines.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Key Storylines
                        </div>
                        <div className="mt-3 space-y-2">
                          {section.key_storylines.map((item, index) => (
                            <p
                              key={`${section.name}-story-${index}`}
                              className="text-sm leading-6 text-slate-800"
                            >
                              <span className="mr-2 font-bold text-slate-500">-</span>
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {lines.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {lines.map((line, index) =>
                          renderBodyLine(line, `${section.name}-${index}`)
                        )}
                      </div>
                    ) : null}

                    {section.advanced && hasAdvancedContent(section.advanced) ? (
                      <section
                        className={`mt-6 rounded-3xl border p-5 shadow-sm ${advancedTone(
                          section.name
                        )}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                              {isDraftSection(section.name)
                                ? "Draft Signals"
                                : "Advanced Metrics"}
                            </div>
                            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                              {section.advanced.title ||
                                `${section.name} ADVANCED REPORT`}
                            </h3>
                          </div>

                          <div className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
                            <div className="font-bold uppercase tracking-[0.18em] text-slate-500">
                              Updated
                            </div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {section.advanced.updated_at || published_at || "Unavailable"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4">
                          {advancedEntries.map(([key, items]) => (
                            <div
                              key={`${section.name}-${key}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                {formatAdvancedHeading(key)}
                              </div>

                              <div className="mt-3 space-y-3">
                                {items.map((item, index) => (
                                  <div
                                    key={`${section.name}-${key}-${index}`}
                                    className="text-sm leading-7 text-slate-800"
                                  >
                                    <span className="mr-2 font-bold text-slate-500">
                                      -
                                    </span>
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black tracking-tight">
                  Daily Report
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  No section data is currently available.
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black tracking-tight">
                Report Status
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Sections loaded
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {sectionCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Advanced sections
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {advancedSectionCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Report published
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {published_at || "Unavailable"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black tracking-tight">
                Full Report Feed
              </h2>

              {full_text ? (
                <pre className="mt-4 max-h-[900px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  {full_text}
                </pre>
              ) : (
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  Full report text is not currently available.
                </p>
              )}
            </section>

            {disclaimer ? (
              <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                  Editorial Note
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-800">
                  {disclaimer}
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}