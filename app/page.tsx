import fs from "fs";
import path from "path";

type ReportSection = {
  name: string;
  content: string;
};

type ReportData = {
  title: string;
  headline?: string;
  key_storylines?: string[];
  sections?: ReportSection[];
  updated_at?: string;
  disclaimer?: string;
};

function readReportData(): ReportData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");

    if (!fs.existsSync(filePath)) {
      console.error("latest_report.json not found at:", filePath);
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      title: parsed.title || "GLOBAL SPORTS REPORT",
      headline: parsed.headline || "",
      key_storylines: Array.isArray(parsed.key_storylines)
        ? parsed.key_storylines
        : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      updated_at: parsed.updated_at || "",
      disclaimer: parsed.disclaimer || "",
    };
  } catch (error) {
    console.error("Failed to read latest_report.json:", error);
    return null;
  }
}

function getSectionCount(report: ReportData): number {
  return report.sections?.length || 0;
}

export default function HomePage() {
  const report = readReportData();

  if (!report) {
    return (
      <main className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center px-6">
        <div className="bg-[#111a2b] border border-[#1f2a44] rounded-2xl p-8 max-w-xl w-full shadow-xl">
          <h1 className="text-2xl font-bold mb-3 text-[#60a5fa]">
            Global Sports Report
          </h1>
          <p className="text-[#cbd5e1]">Could not load report data.</p>
          <p className="text-sm text-[#94a3b8] mt-3">
            Make sure <span className="font-semibold">public/latest_report.json</span>{" "}
            exists and contains valid JSON.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1220] text-[#e5e7eb]">
      <div className="bg-[#020617] border-b border-[#1f2a44] text-[#93c5fd] text-xs px-4 py-2 tracking-[0.2em] uppercase">
        MLB • NBA • Soccer • NHL • NFL • Live Data Active
      </div>

      <div className="border-b border-[#1f2a44] bg-[#0b1220]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[#3b82f6]" />
            <span className="text-sm sm:text-base font-semibold tracking-[0.25em] text-[#dbeafe] uppercase">
              Global Sports Report
            </span>
          </div>

          <div className="text-xs sm:text-sm tracking-[0.25em] uppercase text-[#93c5fd] text-right">
            Automated Newsroom Support
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#081225] via-[#0d1730] to-[#162a57] border-b border-[#1f2a44]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-[1.8fr_0.9fr] gap-8 items-start">
          <div>
            <p className="text-sm text-[#93c5fd] tracking-[0.3em] uppercase mb-5">
              Daily Edition
            </p>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
              {report.title}
            </h1>

            {report.headline && (
              <p className="mt-6 text-xl sm:text-2xl leading-relaxed text-[#e2e8f0] max-w-4xl">
                {report.headline}
              </p>
            )}
          </div>

          <div className="bg-[#0f1a33]/95 border border-[#1f2a44] rounded-2xl p-5 shadow-2xl">
            <h2 className="text-sm tracking-[0.25em] uppercase text-[#93c5fd] mb-5">
              Report Status
            </h2>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-[#1f2a44] pb-3">
                <span className="text-[#94a3b8]">Updated</span>
                <span className="text-white text-right">
                  {report.updated_at || "Unavailable"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#1f2a44] pb-3">
                <span className="text-[#94a3b8]">Sections</span>
                <span className="text-white">{getSectionCount(report)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8]">Mode</span>
                <span className="text-[#22c55e] font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {report.key_storylines && report.key_storylines.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white text-sm sm:text-base px-5 py-4 rounded-xl border border-[#3b82f6] shadow-lg flex items-center gap-3 cursor-default">
            <span className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="font-semibold text-[#dbeafe] uppercase tracking-wide shrink-0">
              Live Desk
            </span>
            <span className="text-[#eff6ff] leading-relaxed">
              {report.key_storylines.join(" • ")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-8">
          <aside className="bg-[#111a2b] border border-[#1f2a44] rounded-2xl p-5 h-fit shadow-xl">
            <h2 className="text-sm tracking-[0.28em] uppercase text-[#93c5fd] mb-5">
              News Desk
            </h2>

            <div className="space-y-3">
              <div className="bg-[#0b1220] border border-[#1f2a44] rounded-xl px-4 py-3 text-sm">
                <span className="font-semibold text-white">Coverage:</span>{" "}
                <span className="text-[#dbeafe]">Multi-league</span>
              </div>

              <div className="bg-[#0b1220] border border-[#1f2a44] rounded-xl px-4 py-3 text-sm">
                <span className="font-semibold text-white">Voice:</span>{" "}
                <span className="text-[#dbeafe]">Journalist-first</span>
              </div>

              <div className="bg-[#0b1220] border border-[#1f2a44] rounded-xl px-4 py-3 text-sm">
                <span className="font-semibold text-white">Focus:</span>{" "}
                <span className="text-[#dbeafe]">Fast readable intelligence</span>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            {report.sections && report.sections.length > 0 ? (
              report.sections.map((section, idx) => (
                <article
                  key={`${section.name}-${idx}`}
                  className="bg-[#111a2b] border border-[#1f2a44] rounded-2xl overflow-hidden shadow-xl hover:border-[#3b82f6] transition-colors duration-200"
                >
                  <div className="border-b border-[#1f2a44] px-5 sm:px-7 py-4 bg-[#091226]">
                    <h2 className="text-2xl font-bold text-[#60a5fa] border-l-4 border-[#3b82f6] pl-4">
                      {section.name}
                    </h2>
                  </div>

                  <div className="px-5 sm:px-7 py-6">
                    <div className="text-sm sm:text-[15px] leading-7 font-sans text-[#e5e7eb] space-y-2">
                      {section.content.split("\n").map((line, lineIdx) => (
                        <div key={lineIdx}>{line || "\u00A0"}</div>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="bg-[#111a2b] border border-[#1f2a44] rounded-2xl p-6 text-[#cbd5e1]">
                No report sections available.
              </div>
            )}

            {report.disclaimer && (
              <div className="bg-[#0f172a] border border-[#1f2a44] rounded-xl px-5 py-4 text-sm text-[#94a3b8]">
                {report.disclaimer}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}