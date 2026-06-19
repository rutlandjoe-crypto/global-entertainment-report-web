/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import EditorialStandard from "@/components/EditorialStandard";
import SocialIconLinks from "@/app/SocialIconLinks";
import { loadReport } from "@/app/report-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AnyObj = Record<string, unknown>;

const SITE = {
  name: "Global Entertainment Report",
  tagline: "Built for journalists, by a journalist.",
  topic: "Entertainment",
  descriptor:
    "Global Entertainment Report tracks film, television, streaming, music, talent, studios and media business, delivering journalist-ready signals for one of the world’s most visible cultural industries.",
};

const TOOLKIT = [
  ["Variety", "https://variety.com"],
  ["The Hollywood Reporter", "https://www.hollywoodreporter.com"],
  ["Deadline", "https://deadline.com"],
  ["Box Office Mojo", "https://www.boxofficemojo.com"],
  ["IMDb", "https://www.imdb.com"],
];

const GSR_NETWORK = [
  ["Sports", "https://globalsportsreport.com"],
  ["AI", "https://globalaireport.news"],
  ["Politics", "https://globalpoliticsreport.com"],
  ["Entertainment", "https://globalentertainmentreport.com"],
  ["Betting", "https://globalbettingreport.com"],
];

const DEFAULT_URL = "https://variety.com";

const CATEGORY_LABELS: Record<string, string> = {
  film: "Film",
  tv: "TV",
  television: "TV",
  streaming: "Streaming",
  music: "Music",
  awards: "Awards",
  box_office: "Box Office",
  celebrity: "Celebrity",
  hollywood: "Hollywood",
  gaming: "Gaming",
  media: "Media",
  entertainment: "Entertainment Watch",
};

const BAD_CONTENT_PHRASES = [
  "source refresh",
  "refresh needed",
  "needed before publication",
  "strict mode",
  "current-day update pending",
  "feed checked",
  "feed request",
  "checked feed",
  "accepted real rss",
  "rss item",
  "source mode",
  "required date",
  "rebuild distribution",
  "bad or stale",
  "not allowed onto the homepage",
  "no verified data point attached yet",
  "no current items available",
  "undefined",
];

function decodeHtmlEntities(value: string): string {
  let text = value;

  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&#x27;": "'",
    "&nbsp;": " ",
    "&#160;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&rsquo;": "'",
    "&lsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&ndash;": "â€“",
    "&mdash;": "â€”",
  };

  for (let pass = 0; pass < 6; pass += 1) {
    const before = text;

    Object.entries(namedEntities).forEach(([bad, good]) => {
      text = text.split(bad).join(good);
    });

    text = text.replace(/&#(\d+);/g, (_match, code) => {
      const num = Number(code);
      return Number.isFinite(num) ? String.fromCharCode(num) : _match;
    });

    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => {
      const num = parseInt(code, 16);
      return Number.isFinite(num) ? String.fromCharCode(num) : _match;
    });

    if (text === before) break;
  }

  return text;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(" • ");
  if (typeof value === "object") {
    return Object.values(value).map(cleanText).filter(Boolean).join(" • ");
  }

  let text = String(value);

  text = decodeHtmlEntities(text);
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);

  text = text
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2014/g, "â€”")
    .replace(/\u2013/g, "â€“")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function normalizeText(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function isBadContent(value: unknown): boolean {
  const text = normalizeText(value);
  if (!text) return true;
  return BAD_CONTENT_PHRASES.some((phrase) => text.includes(phrase));
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();

  return items
    .map(cleanText)
    .filter((item) => item && !isBadContent(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function asList(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => cleanText(item).split(/\n|•|\|/)));
  }

  if (typeof value === "object") {
    return unique(Object.values(value).flatMap((item) => cleanText(item).split(/\n|•|\|/)));
  }

  return unique(cleanText(value).split(/\n|•|\|/));
}

function isValidUrl(value: any): boolean {
  const url = cleanText(value);
  return url.startsWith("http://") || url.startsWith("https://");
}

function findUrlInText(value: any): string {
  const text = cleanText(value);
  const match = text.match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0].replace(/[),.;]+$/, "") : "";
}

function normalizeLabel(value: any, fallback = "Entertainment Watch"): string {
  const raw = cleanText(value);
  const key = raw.toLowerCase().replace(/\s+/g, "_");

  if (!raw || key === "undefined" || key === "null") return fallback;
  return CATEGORY_LABELS[key] || raw;
}

function extractBestUrl(story: AnyObj): string {
  const directCandidates = [
    story.url,
    story.link,
    story.source_url,
    story.sourceUrl,
    story.href,
    story.web_url,
    story.webUrl,
  ];

  for (const candidate of directCandidates) {
    if (isValidUrl(candidate)) return cleanText(candidate);
  }

  if (Array.isArray(story.links)) {
    for (const link of story.links) {
      if (typeof link === "string" && isValidUrl(link)) return cleanText(link);
      if (link && typeof link === "object") {
        const candidates = [link.url, link.href, link.link, link.source_url];
        for (const candidate of candidates) {
          if (isValidUrl(candidate)) return cleanText(candidate);
        }
      }
    }
  }

  return (
    findUrlInText(
      story.content ||
        story.summary ||
        story.snapshot ||
        story.description ||
        story.key_storylines ||
        story.watch_list
    ) || DEFAULT_URL
  );
}

function extractSectionLines(content: string, heading: string): string[] {
  if (!content) return [];

  const lines = content.split("\n");
  const startIndex = lines.findIndex(
    (line) => line.trim().toUpperCase() === heading.toUpperCase()
  );

  if (startIndex === -1) return [];

  const output: string[] = [];

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const isNextHeading =
      /^[A-Z0-9\s&/()-]{4,}$/.test(line) &&
      !line.includes(".") &&
      !line.includes(":");

    if (isNextHeading) break;
    output.push(line.replace(/^- /, "").trim());
  }

  return unique(output);
}

function normalizeStory(story: AnyObj, index: number, sectionTitle = ""): AnyObj {
  const label = normalizeLabel(
    story.league || story.category || story.name || story.label || sectionTitle || story.title
  );

  const title =
    cleanText(story.headline) ||
    cleanText(story.title) ||
    cleanText(story.name) ||
    `${label} Storyline ${index + 1}`;

  const summary =
    cleanText(story.summary) ||
    cleanText(story.snapshot) ||
    cleanText(story.description) ||
    cleanText(story.body) ||
    "Entertainment development flagged for newsroom monitoring.";

  return {
    ...story,
    id: cleanText(story.id || story.key || `${label}-${index}`),
    key: cleanText(story.key || story.id || `${label}-${index}`),
    league: label,
    label,
    title,
    headline: title,
    summary,
    snapshot: summary,
    url: extractBestUrl(story),
    key_data: asList(story.key_data || story.keyData || story.data || story.metrics).slice(0, 8),
    why_it_matters: asList(story.why_it_matters || story.whyItMatters || story.why).slice(0, 6),
    what_to_watch: asList(story.what_to_watch || story.whatToWatch || story.watch).slice(0, 8),
    story_angles: asList(story.story_angles || story.storyAngles || story.angles).slice(0, 6),
  };
}

function sectionToStories(key: string, section: AnyObj, index: number): AnyObj[] {
  const sectionTitle = normalizeLabel(section.name || section.title || key);
  const cards = section.homepage_cards || section.cards || section.items || section.stories;

  if (Array.isArray(cards) && cards.length) {
    const objectCards = cards.filter((card: any) => card && typeof card === "object");
    const stringCards = cards.filter((card: any) => typeof card === "string");

    if (objectCards.length) {
      return objectCards.map((card: AnyObj, cardIndex: number) =>
        normalizeStory(card, cardIndex, sectionTitle)
      );
    }

    if (stringCards.length) {
      return stringCards.map((card: string, cardIndex: number) =>
        normalizeStory(
          {
            category: sectionTitle,
            headline: card,
            snapshot: section.snapshot || "Entertainment signal generated for newsroom review.",
            key_data: [card],
            why_it_matters: [
              "This item can affect audience attention, talent leverage, studio strategy or media business coverage.",
            ],
            what_to_watch: [
              "Monitor confirmed reporting, platform response, studio movement, audience behavior and follow-up coverage.",
            ],
            story_angles: [
              "Look for the strongest business, audience, talent or platform angle behind the story.",
            ],
            url: extractBestUrl(section),
          },
          cardIndex,
          sectionTitle
        )
      );
    }
  }

  const content = cleanText(section.content);
  const keyData = unique([
    ...extractSectionLines(content, "KEY STORYLINES"),
    ...extractSectionLines(content, "KEY DATA POINTS"),
    ...asList(section.key_storylines),
    ...asList(section.watch_list),
    ...asList(section.key_data),
  ]);

  return [
    normalizeStory(
      {
        category: sectionTitle,
        headline:
          cleanText(section.headline) ||
          cleanText(extractSectionLines(content, "HEADLINE")[0]) ||
          sectionTitle,
        snapshot:
          cleanText(section.summary) ||
          cleanText(section.snapshot) ||
          cleanText(extractSectionLines(content, "SNAPSHOT")[0]) ||
          cleanText(content).slice(0, 260),
        key_data: keyData,
        why_it_matters: asList(section.why_it_matters || section.whyItMatters || section.why),
        what_to_watch: asList(section.what_to_watch || section.whatToWatch || section.watch),
        story_angles: asList(section.story_angles || section.storyAngles || section.angles),
        url: extractBestUrl(section),
      },
      index,
      sectionTitle
    ),
  ];
}

function normalizeCollection(candidates: unknown, sourceName: string): AnyObj[] {
  if (Array.isArray(candidates) && candidates.length) {
    return candidates
      .filter((story: any) => story && typeof story === "object")
      .map((story: AnyObj, index: number) =>
        normalizeStory({ ...story, source_collection: sourceName }, index)
      );
  }

  if (candidates && typeof candidates === "object") {
    return Object.entries(candidates).flatMap(([key, value]: [string, any], index) => {
      if (Array.isArray(value)) {
        return value
          .filter((story: any) => story && typeof story === "object")
          .map((story: AnyObj, itemIndex: number) =>
            normalizeStory(
              {
                id: `${key}-${itemIndex}`,
                key,
                category: key,
                source_collection: sourceName,
                ...story,
              },
              itemIndex
            )
          );
      }

      if (value && typeof value === "object") {
        return [
          normalizeStory(
            {
              id: key,
              key,
              category: key,
              source_collection: sourceName,
              ...value,
            },
            index
          ),
        ];
      }

      return [];
    });
  }

  return [];
}

function getStories(report: AnyObj): AnyObj[] {
  const publicCollections: [string, unknown][] = [
    ["homepage_cards", report.homepage_cards],
    ["live_newsroom", report.live_newsroom],
    ["stories", report.stories],
    ["cards", report.cards],
    ["news", report.news],
    ["headlines", report.headlines],
    ["items", report.items],
    ["articles", report.articles],
  ];

  for (const [sourceName, candidates] of publicCollections) {
    const normalized = normalizeCollection(candidates, sourceName).filter(isPublishableStory);
    if (normalized.length) return normalized;
  }

  if (Array.isArray(report.sections) && report.sections.length) {
    return report.sections.flatMap((section: AnyObj, index: number) =>
      sectionToStories(
        cleanText(section.key || section.id || section.name || `section-${index}`),
        section || {},
        index
      )
    );
  }

  if (report.sections && typeof report.sections === "object") {
    return Object.entries(report.sections).flatMap(([key, value]: [string, any], index) =>
      sectionToStories(key, value || {}, index)
    );
  }

  return [];
}

function getSpotlightStories(report: AnyObj, key: "live_newsroom" | "editor_signals"): AnyObj[] {
  const raw = report[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item, index) => normalizeStory(item, index))
    .filter(isPublishableStory);
}

function storyTitle(story: AnyObj, index: number): string {
  return (
    cleanText(story.headline) ||
    cleanText(story.title) ||
    cleanText(story.name) ||
    `Entertainment Storyline ${index + 1}`
  );
}

function storyUrl(story: AnyObj): string {
  return extractBestUrl(story);
}

function storySummary(story: AnyObj): string {
  return (
    cleanText(story.summary) ||
    cleanText(story.snapshot) ||
    cleanText(story.description) ||
    cleanText(story.body) ||
    "Entertainment development flagged for newsroom monitoring."
  );
}

function storyLabel(story: AnyObj): string {
  return normalizeLabel(
    story.league || story.category || story.label || story.source || story.title,
    "Entertainment Watch"
  );
}

function storySignal(story: AnyObj, index: number): string {
  return cleanText(`${storyLabel(story)}: ${storyTitle(story, index)}`);
}

function isPublishableStory(story: AnyObj): boolean {
  if (!story || typeof story !== "object") return false;

  const title = storyTitle(story, 0);
  const summary = storySummary(story);
  const text = `${title} ${summary}`;

  if (!title) return false;
  if (isBadContent(text)) return false;

  return true;
}

function cleanSignals(items: string[]): string[] {
  return unique(items)
    .filter((item) => !isBadContent(item))
    .slice(0, 6);
}

function spotlightItemsFromStories(stories: AnyObj[]): string[] {
  return cleanSignals(stories.map((story, index) => storySignal(story, index)));
}

function buildBriefingItems(stories: AnyObj[], rawSignals: string[]): string[] {
  return cleanSignals([...stories.map((story, index) => storySignal(story, index)), ...rawSignals]);
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-purple-800/70 bg-neutral-950 p-5 shadow-xl shadow-purple-950/30">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-fuchsia-300">
        {cleanText(title)}
      </h2>
      {children}
    </section>
  );
}

function EditorsBookshelf() {
  const books = [
    ["The Big Picture", "Ben Fritz"],
    ["Adventures in the Screen Trade", "William Goldman"],
    ["The Creative Act", "Rick Rubin"],
  ];

  return (
    <Block title="Editor's Bookshelf">
      <div className="space-y-2">
        {books.map(([title, author]) => (
          // TODO: Replace this Amazon search URL with the final Amazon Associates URL.
          <a
            key={title}
            href={`https://www.amazon.com/s?k=${encodeURIComponent(`${title} ${author}`)}&tag=gsrentertainment-20`}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="block rounded-xl border border-neutral-800 bg-black px-4 py-3 hover:border-fuchsia-300"
          >
            <span className="block text-sm font-bold text-fuchsia-300">{title}</span>
            <span className="mt-1 block text-xs text-neutral-400">{author}</span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500">
        As an Amazon Associate, GSR Network earns from qualifying purchases.
      </p>
    </Block>
  );
}

function LineList({ items }: { items: string[] }) {
  const safe = unique(items).slice(0, 8);

  if (!safe.length) {
    return (
      <p className="text-sm leading-6 text-neutral-400">
        Monitoring verified entertainment developments for the next clean newsroom update.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {safe.map((item, i) => (
        <p key={i} className="border-b border-neutral-800 pb-2 text-sm leading-6 text-neutral-300">
          {item}
        </p>
      ))}
    </div>
  );
}

function NewsroomBriefing({ items }: { items: string[] }) {
  const safe = unique(items).slice(0, 6);

  return (
    <div className="rounded-2xl border border-purple-800/70 bg-neutral-950 p-5 shadow-xl shadow-purple-950/30">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-fuchsia-300">
        Live Newsroom Briefing
      </p>

      {safe.length ? (
        <div className="space-y-2">
          {safe.map((item, i) => (
            <p
              key={i}
              className="border-b border-neutral-800 pb-2 text-sm leading-6 text-neutral-300"
            >
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-neutral-400">
          Monitoring major developments across film, television, streaming, music, talent, studios and media business.
        </p>
      )}
    </div>
  );
}

function StoryCard({ story, index }: { story: AnyObj; index: number }) {
  const title = storyTitle(story, index);
  const url = storyUrl(story);
  const summary = storySummary(story);

  const keyData = asList(story.key_data || story.keyData || story.data || story.metrics);
  const why = asList(story.why_it_matters || story.whyItMatters || story.why);
  const watch = asList(story.what_to_watch || story.whatToWatch || story.watch);
  const angles = asList(story.story_angles || story.storyAngles || story.angles);

  return (
    <article className="rounded-2xl border border-purple-800/70 bg-neutral-950 p-5 shadow-xl shadow-purple-950/30">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-fuchsia-300">
        {storyLabel(story)}
      </p>

      <h3 className="text-xl font-black leading-tight text-white">
        {url !== "#" ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-fuchsia-300">
            {title}
          </a>
        ) : (
          title
        )}
      </h3>

      <p className="mt-3 text-sm leading-6 text-neutral-400">{summary}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-black p-3">
          <p className="mb-2 text-xs font-black uppercase text-fuchsia-300">Key Data</p>
          <LineList items={keyData.length ? keyData : ["Latest verified entertainment signal attached for newsroom review."]} />
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-3">
          <p className="mb-2 text-xs font-black uppercase text-fuchsia-300">Why It Matters</p>
          <LineList items={why.length ? why : ["This affects entertainment coverage priorities, audience attention, talent leverage or media business strategy."]} />
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-3">
          <p className="mb-2 text-xs font-black uppercase text-fuchsia-300">What To Watch</p>
          <LineList items={watch.length ? watch : ["Monitor the next studio, platform, talent, box office or audience response."]} />
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-3">
          <p className="mb-2 text-xs font-black uppercase text-fuchsia-300">Story Angles</p>
          <LineList items={angles.length ? angles : ["Look for the strongest business, audience, talent or platform angle behind the story."]} />
        </div>
      </div>
    </article>
  );
}


function SponsorPlacementBlock() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-3">
      <div className="rounded-2xl border border-black/10 bg-white/90 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">
          Partner Spotlight
        </p>
        <h2 className="mt-2 text-xl font-black text-neutral-950">
          Partnership opportunities are available across the GSR Network.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
          Reach readers through clean, clearly labeled placements across Sports, Betting, AI, Politics and Entertainment — built around journalistic integrity.
        </p>
      </div>
    </section>
  );
}

function AdvertiseWithGsrBlock() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-6">
      <div className="rounded-2xl border border-black/10 bg-white/90 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">
          Advertise With GSR Network
        </p>
        <h2 className="mt-2 text-xl font-black text-neutral-950">
          Sponsorship, partnership, affiliate and custom campaign opportunities are open.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
          GSR Network offers clearly labeled placements for brands, events, data companies, media partners and vertical-specific advertisers across all five platforms.
        </p>
      </div>
    </section>
  );
}

export default async function Page() {
  const report = await loadReport();

  let stories = getStories(report).filter(isPublishableStory);

  const liveNewsroomStories = getSpotlightStories(report, "live_newsroom").filter(isPublishableStory);
  const editorSignalStories = getSpotlightStories(report, "editor_signals").filter(isPublishableStory);

  const rawSignals = asList(
    report.key_storylines ||
      report.keyStorylines ||
      report.signals ||
      report.toplines ||
      report.takeaways
  );

  const headline =
    cleanText(report.headline) && !isBadContent(report.headline)
      ? cleanText(report.headline)
      : "Entertainment Newsroom Watch: Major Developments Under Review";

  const snapshot =
    cleanText(report.snapshot) && !isBadContent(report.snapshot)
      ? cleanText(report.snapshot)
      : "A live entertainment briefing built for journalists tracking studios, streaming, film, television, music, talent, audience behavior and media business.";

  const updated =
    cleanText(report.updated_at) ||
    cleanText(report.generated_at) ||
    cleanText(report.published_at) ||
    "Update time unavailable";

  if (!stories.length) {
    stories = [
      {
        league: "Entertainment Watch",
        headline,
        summary: snapshot,
        url: DEFAULT_URL,
        key_data: ["Latest entertainment report generated from live feeds."],
        why_it_matters: ["Editors need fast clarity on audience, talent, studios, platforms and media business."],
        what_to_watch: ["Next studio move, platform decision, box office signal, talent development or audience response."],
        story_angles: ["Follow the strongest business, audience, talent or platform thread."],
      },
    ];
  }

  const leadStories = stories.slice(0, 10);

  const liveItems = liveNewsroomStories.length
    ? spotlightItemsFromStories(liveNewsroomStories)
    : buildBriefingItems(stories, rawSignals);

  const editorItems = editorSignalStories.length
    ? spotlightItemsFromStories(editorSignalStories)
    : cleanSignals(rawSignals.length ? rawSignals : buildBriefingItems(stories.slice(3), []));

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-purple-900 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-2 text-xs font-bold uppercase tracking-wide">
          <span className="text-fuchsia-300">GSR Network:</span>
          {GSR_NETWORK.map(([name, url], index) => (
            <span key={name} className="flex items-center gap-3">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  name === "Entertainment"
                    ? "text-fuchsia-300 hover:text-white"
                    : "text-white hover:text-fuchsia-300"
                }
              >
                {name}
              </a>
              {index < GSR_NETWORK.length - 1 ? <span className="text-neutral-600">•</span> : null}
            </span>
          ))}
        </div>
      </div>

      <div className="border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-2 text-xs font-bold uppercase tracking-wide">
          <span className="text-neutral-400">Follow GSR:</span>
          <SocialIconLinks hoverClassName="hover:border-purple-300" />
        </div>
      </div>

      <header className="border-b border-purple-900 bg-gradient-to-br from-black via-neutral-950 to-purple-950">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-fuchsia-300">
              {SITE.name}
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">
              {headline}
            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-400">
              {snapshot}
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
              <span className="rounded-full bg-fuchsia-300 px-4 py-2 text-black">
                {SITE.tagline}
              </span>
              <span className="rounded-full border border-purple-700 bg-black px-4 py-2 text-neutral-300">
                Updated: {updated}
              </span>
            </div>
          </div>

          <NewsroomBriefing items={liveItems} />
        </div>
      </header>
      <SponsorPlacementBlock />


      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[0.75fr_1.25fr]">
        <aside className="space-y-6">
          <Block title="Editor Signals">
            <LineList items={editorItems} />
          </Block>

          <Block title="Journalist Toolkit">
            <div className="space-y-2">
              {TOOLKIT.map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-neutral-800 bg-black px-4 py-3 text-sm font-bold text-neutral-200 hover:border-fuchsia-300 hover:text-fuchsia-300"
                >
                  {name}
                </a>
              ))}
            </div>
          </Block>

          <EditorsBookshelf />

          <Block title="Coverage Lens">
            <LineList
              items={[
                "Business: What changes for studios, platforms or distributors?",
                "Audience: What does this say about demand, attention or culture?",
                "Talent: Who gains leverage, visibility or negotiating power?",
                "Money: What is the box office, streaming, rights or deal impact?",
                "Newsroom: What should journalists verify next?",
              ]}
            />
          </Block>
        </aside>

        <section className="space-y-6">
          {leadStories.map((story, index) => (
            <StoryCard key={cleanText(story.id) || index} story={story} index={index} />
          ))}
        </section>
      </section>
      <AdvertiseWithGsrBlock />


      <footer className="border-t border-purple-900 bg-neutral-950">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <p className="text-sm font-medium text-neutral-300">
            Â© {new Date().getFullYear()} {SITE.name}. {SITE.tagline}
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-500">
            {SITE.descriptor}
          </p>
        </div>
        <EditorialStandard />
      </footer>
    </main>
  );
}

