import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

type JsonObject = { [key: string]: any };

// ✅ VIDEO FALLBACK CHAIN
const DEFAULT_VIDEO =
  process.env.NEXT_PUBLIC_GER_VIDEO_URL ||
  "https://www.youtube.com/embed/21X5lGlDOfg?rel=0&autoplay=1&mute=1";

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

function normalizeVideoUrl(value: any): string {
  const url = clean(value) || DEFAULT_VIDEO;

  const needsRel = !url.includes("rel=");
  const needsAutoplay = !url.includes("autoplay=");
  const needsMute = !url.includes("mute=");

  const params = [
    needsRel ? "rel=0" : "",
    needsAutoplay ? "autoplay=1" : "",
    needsMute ? "mute=1" : "",
  ].filter(Boolean);

  if (!params.length) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}`;
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

function StoryCard({ story, index }: { story: any; index: number }) {
  const headline = clean(story.headline) || `Entertainment Story ${index + 1}`;
  const url = clean(story.url) || "#";
  const summary = clean(story.snapshot || story.summary);

  const keyData = list(story.key_data);
  const why = list(story.why_it_matters);
  const watch = list(story.what_to_watch);

  return (
    <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-2xl font-extrabold text-white hover:text-amber-400"
      >
        {headline}
      </a>

      {summary && <div className="mt-2 text-sm text-neutral-400">{summary}</div>}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-black p-3">
          <div className="mb-2 text-xs font-black text-amber-400">KEY DATA</div>
          {keyData.length ? (
            keyData.map((d, i) => (
              <div key={i} className="border-b border-neutral-800 py-1 text-sm">
                {d}
              </div>
            ))
          ) : (
            <div className="text-sm text-neutral-500">No data</div>
          )}
        </div>

        <div className="rounded-lg bg-black p-3">
          <div className="mb-2 text-xs font-black text-amber-400">WHY IT MATTERS</div>
          {why.length ? (
            why.map((d, i) => (
              <div key={i} className="border-b border-neutral-800 py-1 text-sm">
                {d}
              </div>
            ))
          ) : (
            <div className="text-sm text-neutral-500">Editorial relevance developing</div>
          )}
        </div>

        <div className="rounded-lg bg-black p-3">
          <div className="mb-2 text-xs font-black text-amber-400">WHAT TO WATCH</div>
          {watch.length ? (
            watch.map((d, i) => (
              <div key={i} className="border-b border-neutral-800 py-1 text-sm">
                {d}
              </div>
            ))
          ) : (
            <div className="text-sm text-neutral-500">Next movement pending</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const report = readReport();

  const headline = clean(report.headline) || "Entertainment Report Loading";
  const snapshot = clean(report.snapshot);
  const updated = clean(report.updated_at || report.generated_at);
  const videoUrl = normalizeVideoUrl(report.video_url);

  let stories = getStories(report);

  if (!stories.length) {
    stories = [
      {
        headline,
        snapshot,
        key_data: ["Entertainment pipeline awaiting update"],
        why_it_matters: ["Coverage gap for newsroom"],
        what_to_watch: ["Next content engine run"],
      },
    ];
  }

  const keyStorylines = list(report.key_storylines);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 border-b border-neutral-800 pb-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-amber-400">
                GLOBAL ENTERTAINMENT REPORT
              </div>

              <h1 className="text-4xl font-extrabold">{headline}</h1>

              {snapshot && <p className="mt-3 max-w-2xl text-neutral-400">{snapshot}</p>}

              <div className="mt-3 text-xs text-neutral-500">Updated {updated}</div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold text-amber-400">LIVE COVERAGE</div>

              <div className="aspect-video overflow-hidden rounded-xl border border-neutral-800 bg-black">
                <iframe
                  src={videoUrl}
                  title="Live Entertainment Coverage"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>

              <div className="mt-2 text-xs text-neutral-500">
                Live entertainment news stream
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6">
          {keyStorylines.map((s, i) => (
            <div key={i} className="border-b border-neutral-800 py-2">
              {s}
            </div>
          ))}
        </section>

        <section>
          {stories.slice(0, 10).map((s, i) => (
            <StoryCard key={i} story={s} index={i} />
          ))}
        </section>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <div className="mb-3 text-xs font-black uppercase text-amber-400">
            Journalist Toolkit
          </div>

          <div className="space-y-2 text-sm">
            <a href="https://variety.com" target="_blank" rel="noopener noreferrer" className="block hover:underline">Variety</a>
            <a href="https://www.hollywoodreporter.com" target="_blank" rel="noopener noreferrer" className="block hover:underline">Hollywood Reporter</a>
            <a href="https://deadline.com" target="_blank" rel="noopener noreferrer" className="block hover:underline">Deadline</a>
            <a href="https://www.boxofficemojo.com" target="_blank" rel="noopener noreferrer" className="block hover:underline">Box Office Mojo</a>
            <a href="https://www.imdb.com" target="_blank" rel="noopener noreferrer" className="block hover:underline">IMDb</a>
          </div>
        </section>
      </div>
    </main>
  );
}