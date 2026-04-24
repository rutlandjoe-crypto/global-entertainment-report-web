import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonObject
  | JsonValue[];

type JsonObject = {
  [key: string]: JsonValue;
};

const BRAND = {
  siteName: "GLOBAL ENTERTAINMENT REPORT",
  tagline: "Built for journalists, by a journalist.",
  accent: "from-purple-500 via-fuchsia-500 to-amber-300",
  softAccent: "bg-purple-500/10 border-purple-400/30",
  textAccent: "text-purple-200",
};

const VIDEO_URL = process.env.NEXT_PUBLIC_GER_VIDEO_URL || "";

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: JsonValue, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asArray(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function readLatestReport(): JsonObject {
  const filePath = path.join(process.cwd(), "public", "latest_report.json");

  try {
    if (!fs.existsSync(filePath)) {
      return {
        title: BRAND.siteName,
        headline: "Entertainment report file not found.",
        snapshot:
          "Add public/latest_report.json to display live entertainment headlines, story angles, and newsroom-ready context.",
        generated_date: new Date().toLocaleString("en-US", {
          timeZone: "America/New_York",
          dateStyle: "full",
          timeStyle: "short",
        }),
        key_storylines: [
          "Entertainment feed shell is live.",
          "JSON data is ready to connect.",
          "Video module will activate when a reliable embeddable stream is added.",
        ],
      };
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (isRecord(parsed)) return parsed;

    return {
      title: BRAND.siteName,
      headline: "Entertainment report data format error.",
      snapshot: "latest_report.json exists but did not return an object.",
    };
  } catch (error) {
    return {
      title: BRAND.siteName,
      headline: "Entertainment report could not be loaded.",
      snapshot:
        error instanceof Error
          ? error.message
          : "Unknown error while reading latest_report.json.",
    };
  }
}

function getDate(report: JsonObject): string {
  return (
    asString(report.generated_date) ||
    asString(report.updated_at) ||
    asString(report.published_at) ||
    asString(report.generated_at) ||
    new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "short",
    })
  );
}

function getSections(report: JsonObject): JsonObject[] {
  const sections = report.sections;

  if (Array.isArray(sections)) {
    return sections.filter(isRecord);
  }

  if (isRecord(sections)) {
    return Object.entries(sections).map(([key, value]) => {
      if (isRecord(value)) {
        return {
          slug: key,
          ...value,
        };
      }

      return {
        slug: key,
        title: key,
        content: asString(value),
      };
    });
  }

  const fallbackKeys = [
    "film",
    "tv",
    "music",
    "streaming",
    "celebrity",
    "box_office",
    "awards",
    "business",
  ];

  return fallbackKeys
    .map((key) => report[key])
    .filter(isRecord);
}

function getBullets(section: JsonObject): string[] {
  const keys = [
    "key_storylines",
    "storylines",
    "key_data_points",
    "story_angles",
    "items",
    "bullets",
  ];

  for (const key of keys) {
    const value = section[key];
    if (Array.isArray(value)) {
      return value.map((item) => asString(item)).filter(Boolean);
    }
  }

  return [];
}

function SectionCard({ section }: { section: JsonObject }) {
  const title =
    asString(section.title) ||
    asString(section.name) ||
    asString(section.slug) ||
    "Entertainment Desk";

  const headline = asString(section.headline);
  const snapshot =
    asString(section.snapshot) ||
    asString(section.summary) ||
    asString(section.description);

  const content = asString(section.content) || asString(section.body);
  const bullets = getBullets(section);

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black uppercase tracking-wide text-white">
          {title}
        </h3>
        <span className="rounded-full border border-purple-300/30 bg-purple-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-purple-100">
          Live Desk
        </span>
      </div>

      {headline ? (
        <h4 className="mb-2 text-xl font-extrabold leading-snug text-white">
          {headline}
        </h4>
      ) : null}

      {snapshot ? (
        <p className="mb-4 text-sm leading-6 text-zinc-300">{snapshot}</p>
      ) : null}

      {bullets.length ? (
        <ul className="mb-4 space-y-2">
          {bullets.slice(0, 6).map((bullet, index) => (
            <li
              key={`${title}-bullet-${index}`}
              className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-200"
            >
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      {content ? (
        <div className="whitespace-pre-line rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-zinc-300">
          {content}
        </div>
      ) : null}
    </article>
  );
}

function VideoPanel() {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/30">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-purple-200">
          Entertainment Video
        </p>
        <h2 className="mt-1 text-2xl font-black text-white">
          Live / Featured Stream
        </h2>
      </div>

      {VIDEO_URL ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <iframe
            className="aspect-video w-full"
            src={VIDEO_URL}
            title="Global Entertainment Report video stream"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-5">
          <p className="text-sm leading-6 text-zinc-200">
            No stable embeddable 24/7 entertainment stream is locked yet. This
            block is intentionally protected so the site does not show a broken
            or private video warning.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Add a trusted embed later with{" "}
            <span className="font-mono text-purple-100">
              NEXT_PUBLIC_GER_VIDEO_URL
            </span>
            .
          </p>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const report = readLatestReport();

  const title = asString(report.title, BRAND.siteName);
  const headline =
    asString(report.headline) ||
    "Entertainment industry storylines, data points, and newsroom angles in one place.";

  const snapshot =
    asString(report.snapshot) ||
    asString(report.summary) ||
    "Global Entertainment Report tracks film, television, streaming, music, awards, box office, and media-business movement for journalists.";

  const date = getDate(report);

  const topStorylines = asArray(report.key_storylines)
    .map((item) => asString(item))
    .filter(Boolean);

  const storyAngles = asArray(report.story_angles)
    .map((item) => asString(item))
    .filter(Boolean);

  const sections = getSections(report);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.28),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(135deg,_#05010a_0%,_#12051d_45%,_#060006_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div
                className={`mb-3 inline-flex rounded-full border border-white/10 bg-gradient-to-r ${BRAND.accent} px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-black`}
              >
                GSR Network
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                {title}
              </h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-purple-200">
                {BRAND.tagline}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-right">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">
                Last Updated
              </p>
              <p className="mt-1 text-sm font-bold text-white">{date}</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-amber-200">
                Headline
              </p>
              <h2 className="text-2xl font-black leading-tight sm:text-3xl">
                {headline}
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-300">
                {snapshot}
              </p>
            </div>

            <div className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-purple-100">
                Newsroom Snapshot
              </p>
              <ul className="space-y-3">
                {(topStorylines.length
                  ? topStorylines.slice(0, 4)
                  : [
                      "Film, TV, streaming, music, awards, and media business coverage in one dashboard.",
                      "Designed to surface story angles quickly for editors, writers, and producers.",
                      "Built to connect with automated entertainment JSON updates.",
                    ]
                ).map((item, index) => (
                  <li
                    key={`top-${index}`}
                    className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-zinc-200"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-6">
            <VideoPanel />

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-200">
                Story Angles
              </p>

              <div className="mt-4 space-y-3">
                {(storyAngles.length
                  ? storyAngles.slice(0, 6)
                  : [
                      "Which entertainment stories have business impact beyond celebrity coverage?",
                      "What streaming, studio, music, or box-office movement matters to editors today?",
                      "Where can journalists find useful angles without chasing empty viral noise?",
                    ]
                ).map((angle, index) => (
                  <div
                    key={`angle-${index}`}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-200"
                  >
                    {angle}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-purple-200">
                Coverage Areas
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-bold">
                {[
                  "Film",
                  "TV",
                  "Streaming",
                  "Music",
                  "Awards",
                  "Box Office",
                  "Media Deals",
                  "Culture",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-zinc-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            {sections.length ? (
              sections.map((section, index) => (
                <SectionCard key={`section-${index}`} section={section} />
              ))
            ) : (
              <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-purple-200">
                  Entertainment Report
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Content pipeline ready.
                </h2>
                <p className="mt-4 leading-7 text-zinc-300">
                  Once public/latest_report.json is populated, this area will
                  automatically render entertainment sections, storylines,
                  newsroom angles, and report content.
                </p>
              </article>
            )}
          </section>
        </div>

        <footer className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-5 text-center text-xs font-bold uppercase tracking-[0.22em] text-zinc-400">
          Global Entertainment Report · GSR Network · Built for journalists, by
          a journalist.
        </footer>
      </div>
    </main>
  );
}