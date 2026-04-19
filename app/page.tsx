import fs from "fs";
import path from "path";

export default function Home() {
  // Load latest report JSON
  const filePath = path.join(process.cwd(), "public", "latest_report.json");
  let data: any = null;

  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    data = JSON.parse(fileContents);
  } catch (err) {
    console.error("Error loading latest_report.json:", err);
  }

  const sections = data?.sections || [];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Global Sports Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Automated sports journalism support for the modern newsroom
          </p>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">

          {/* LEFT: REPORT CONTENT */}
          <div className="space-y-6">

            {/* GLOBAL SNAPSHOT */}
            {data?.snapshot && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Global Snapshot
                </h2>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
                  {data.snapshot}
                </p>
              </div>
            )}

            {/* SECTIONS */}
            {sections.map((section: any, index: number) => (
              <div
                key={index}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-slate-900">
                  {section.title}
                </h2>

                {/* Snapshot */}
                {section.snapshot && (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
                    {section.snapshot}
                  </p>
                )}

                {/* Key Storylines */}
                {section.key_storylines?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      Key Storylines
                    </h3>
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {section.key_storylines.map(
                        (item: string, i: number) => (
                          <li key={i}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* RIGHT: SIDEBAR */}
          <div className="space-y-6">

            {/* VIDEO BRIEFING BOX */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Video Briefing
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Daily sports wrap-up
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

            {/* FULL REPORT BOX */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Full Report
              </h3>

              <pre className="mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap text-xs text-slate-800">
                {data?.full_report || "Full report not available."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}