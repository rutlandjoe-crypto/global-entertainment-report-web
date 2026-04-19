export const dynamic = "force-dynamic";

import fs from "fs";
import path from "path";

function readReport() {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function HomePage() {
  const data = readReport();

  if (!data) {
    return <div className="p-6">Report not available.</div>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* HEADER */}
        <header className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black">{data.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Automated sports journalism support for the modern newsroom
          </p>

          {data.snapshot && (
            <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase text-slate-500">
                Global Snapshot
              </div>
              <p className="mt-2 text-sm">{data.snapshot}</p>
            </div>
          )}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

          {/* LEFT SIDE */}
          <div className="space-y-5">
            {Object.values(data.sections || {}).map((section: any, i) => (
              <div key={i} className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">{section.title}</h2>
              </div>
            ))}
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-5">

            {/* X BUTTON */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <a
                href="https://twitter.com/GlobalSportsRp"
                target="_blank"
                className="inline-block rounded-lg bg-black px-4 py-2 text-white text-sm"
              >
                View Latest Thread →
              </a>
            </div>

            {/* 🎥 VIDEO BOX (CLEAN + SMALL) */}
            <div className="rounded-2xl border bg-white p-3 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 mb-2">
                Video Briefing
              </div>

              <div className="aspect-video w-full overflow-hidden rounded-lg">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                  title="Video briefing"
                  allowFullScreen
                />
              </div>
            </div>

            {/* FULL REPORT */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500">
                Full Report
              </div>

              <pre className="mt-3 text-xs whitespace-pre-wrap">
                {data.full_text || "Full report not available."}
              </pre>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}