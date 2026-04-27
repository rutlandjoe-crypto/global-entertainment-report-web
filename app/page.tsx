import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

type JsonObject = { [key: string]: any };

// ✅ STABLE VIDEO
const VIDEO_URL = "https://www.youtube.com/embed/21X5lGlDOfg?rel=0&autoplay=1&mute=1";

function readReport(): JsonObject {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      headline: "Entertainment Report Loading",
      snapshot: "",
      sections: [],
    };
  }
}

function clean(v: any): string {
  if (!v) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function list(v: any): string[] {
  if (!v) return [];

  if (Array.isArray(v)) {
    return v.map(clean).filter(Boolean);
  }

  if (typeof v === "string") {
    return v
      .split(/\n|•|- /)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

function getStories(report: JsonObject): any[] {
  if (Array.isArray(report.sections)) return report.sections;

  if (report.sections && typeof report.sections === "object") {
    return Object.values(report.sections);
  }

  return [];
}

// 🎬 STORY CARD (UPGRADE FROM NEWSLINE)
function StoryCard({ story, index }: { story: any; index: number }) {
  const headline = clean(story.headline) || `Entertainment Story ${index + 1}`;
  const url = story.url || "#";
  const summary = clean(story.snapshot || story.summary);

  const keyData = list(story.key_data);
  const why = list(story.why_it_matters);
  const watch = list(story.what_to_watch);

  return (
    <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900 mb-6">

      {/* HEADLINE */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-2xl font-extrabold text-white hover:text-amber-400 block"
      >
        {headline}
      </a>

      {/* SUMMARY */}
      {summary && (
        <div className="text-sm text-neutral-400 mt-2">
          {summary}
        </div>
      )}

      {/* DATA GRID */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">

        {/* KEY DATA */}
        <div className="bg-black p-3 rounded-lg">
          <div className="text-xs font-black text-amber-400 mb-2">
            KEY DATA
          </div>
          {keyData.length ? keyData.map((d, i) => (
            <div key={i} className="text-sm border-b border-neutral-800 py-1">
              {d}
            </div>
          )) : <div className="text-sm text-neutral-500">No data</div>}
        </div>

        {/* WHY IT MATTERS */}
        <div className="bg-black p-3 rounded-lg">
          <div className="text-xs font-black text-amber-400 mb-2">
            WHY IT MATTERS
          </div>
          {why.length ? why.map((d, i) => (
            <div key={i} className="text-sm border-b border-neutral-800 py-1">
              {d}
            </div>
          )) : <div className="text-sm text-neutral-500">Editorial relevance developing</div>}
        </div>

        {/* WHAT TO WATCH */}
        <div className="bg-black p-3 rounded-lg">
          <div className="text-xs font-black text-amber-400 mb-2">
            WHAT TO WATCH
          </div>
          {watch.length ? watch.map((d, i) => (
            <div key={i} className="text-sm border-b border-neutral-800 py-1">
              {d}
            </div>
          )) : <div className="text-sm text-neutral-500">Next movement pending</div>}
        </div>

      </div>
    </div>
  );
}

export default function Home() {
  const report = readReport();

  const headline = clean(report.headline);
  const snapshot = clean(report.snapshot);
  const updated = clean(report.updated_at || report.generated_at);

  let stories = getStories(report);

  if (!stories.length) {
    stories = [{
      headline: headline,
      snapshot: snapshot,
      key_data: ["Entertainment pipeline awaiting update"],
      why_it_matters: ["Coverage gap for newsroom"],
      what_to_watch: ["Next content engine run"]
    }];
  }

  const keyStorylines = list(report.key_storylines);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* HEADER */}
        <header className="border-b border-neutral-800 pb-6 mb-6">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">

            <div>
              <div className="text-xs uppercase font-black tracking-widest text-amber-400 mb-2">
                GLOBAL ENTERTAINMENT REPORT
              </div>

              <h1 className="text-4xl font-extrabold">
                {headline}
              </h1>

              {snapshot && (
                <p className="text-neutral-400 mt-3 max-w-2xl">
                  {snapshot}
                </p>
              )}

              <div className="text-xs text-neutral-500 mt-3">
                Updated {updated}
              </div>
            </div>

            {/* VIDEO */}
            <div>
              <div className="text-xs font-bold mb-2 text-amber-400">
                LIVE COVERAGE
              </div>

              <div className="aspect-video rounded-xl overflow-hidden border border-neutral-800">
                <iframe
                  src={VIDEO_URL}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>

          </div>
        </header>

        {/* STORYLINES */}
        <section className="mb-6">
          {keyStorylines.map((s, i) => (
            <div key={i} className="py-2 border-b border-neutral-800">
              {s}
            </div>
          ))}
        </section>

        {/* STORIES */}
        <section>
          {stories.slice(0, 10).map((s, i) => (
            <StoryCard key={i} story={s} index={i} />
          ))}
        </section>

        {/* TOOLKIT */}
        <section className="mt-8 border-t border-neutral-800 pt-6">
          <div className="text-xs uppercase font-black text-amber-400 mb-3">
            Journalist Toolkit
          </div>

          <div className="space-y-2 text-sm">
            <a href="https://variety.com" target="_blank" className="block hover:underline">Variety</a>
            <a href="https://www.hollywoodreporter.com" target="_blank" className="block hover:underline">Hollywood Reporter</a>
            <a href="https://deadline.com" target="_blank" className="block hover:underline">Deadline</a>
            <a href="https://www.boxofficemojo.com" target="_blank" className="block hover:underline">Box Office Mojo</a>
            <a href="https://www.imdb.com" target="_blank" className="block hover:underline">IMDb</a>
          </div>
        </section>

      </div>
    </main>
  );
}