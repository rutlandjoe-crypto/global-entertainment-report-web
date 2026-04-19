import fs from "fs";
import path from "path";

type ReportSection = {
  title?: string;
  snapshot?: string;
  key_storylines?: string[];
  [key: string]: any;
};

function normalizeSections(input: any): ReportSection[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.map((section, index) => ({
      title: section?.title || `Section ${index + 1}`,
      snapshot: section?.snapshot || "",
      key_storylines: Array.isArray(section?.key_storylines)
        ? section.key_storylines
        : [],
      ...section,
    }));
  }

  if (typeof input === "object") {
    return Object.entries(input).map(([key, value]: [string, any]) => ({
      title: value?.title || key.replace(/_/g, " ").toUpperCase(),
      snapshot: value?.snapshot || "",
      key_storylines: Array.isArray(value?.key_storylines)
        ? value.key_storylines
        : [],
      ...value,
    }));
  }

  return [];
}

export default function Home() {
  const filePath = path.join(process.cwd(), "public", "latest_report.json");

  let data: any = null;

  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    data = JSON.parse(fileContents);
  } catch (err) {
    console.error("Error loading latest_report.json:", err);
  }

  const sections = normalizeSections(data?.sections);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Global Sports Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Automated sports journalism support for the modern newsroom
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {data?.snapshot && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Global Snapshot
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {data.snapshot}
                </p>
              </div>
            )}

            {sections.length > 0 ? (
              sections.map((section: ReportSection, index: number) => (
                <div
                  key={index}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    {section.title}
                  </h2>

                  {section.snapshot && (
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                      {section.snapshot}
                    </p>
                  )}

                  {Array.isArray(section.key_storylines) &&
                    section.key_storylines.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                          Key Storylines
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {section.key_storylines.map(
                            (item: string, i: number) => (
                              <li key={i}>{item}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Daily Report
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {data?.full_report ||
                    data?.report ||
                    "No report sections are available right now."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Video Briefing
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Daily sports video wrap-up
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <div className="aspect-video w-full">
                  <iframe
                    className="h-full w-full"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Global Sports Report Video Briefing"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                External video source. Updated separately from the written report.
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Full Report
              </h3>

              <pre className="mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap text-xs text-slate-800">
                {data?.full_report || data?.report || "Full report not available."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}