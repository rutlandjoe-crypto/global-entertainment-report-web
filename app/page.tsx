import fs from "fs/promises";
import path from "path";
import Link from "next/link";

type AdvancedReport = {
  title?: string;
  updated_at?: string;
  published_at?: string;
  summary?: string;
  content?: string;
};

type ReportSection = {
  league?: string;
  title?: string;
  updated_at?: string;
  published_at?: string;
  summary?: string;
  content?: string;
  advanced?: AdvancedReport;
};

type LatestReportData = {
  title?: string;
  generated_date?: string;
  updated_at?: string;
  published_at?: string;
  summary?: string;
  content?: string;
  sections?: ReportSection[];
};

const SITE_TITLE = "Global Sports Report";
const SUBSTACK_URL = "https://globalsportsreport.substack.com/";
const X_URL = "https://x.com/GlobalSportsRep";
const FULL_REPORT_URL = "/latest_report.txt";

async function getLatestReport(): Promise<LatestReportData> {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      title: parsed?.title ?? "GLOBAL SPORTS REPORT",
      generated_date: parsed?.generated_date ?? "",
      updated_at: parsed?.updated_at ?? "",
      published_at: parsed?.published_at ?? "",
      summary: parsed?.summary ?? "",
      content: parsed?.content ?? "",
      sections: Array.isArray(parsed?.sections) ? parsed.sections : [],
    };
  } catch (error) {
    console.error("Error reading latest_report.json:", error);
    return {
      title: "GLOBAL SPORTS REPORT",
      generated_date: "",
      updated_at: "",
      published_at: "",
      summary:
        "Today’s report is being prepared. Please check back shortly for the latest automated newsroom summary.",
      content: "",
      sections: [],
    };
  }
}

function formatTextBlock(text?: string) {
  if (!text) return null;

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={index} className="mb-4 leading-7 text-neutral-800">
        {paragraph}
      </p>
    ));
}

function getSectionLabel(section: ReportSection, index: number) {
  return (
    section.league?.trim() ||
    section.title?.replace(/\s+(PRO|ADVANCED|REPORT|SIGNALS).*$/i, "").trim() ||
    `Section ${index + 1}`
  );
}

export default async function HomePage() {
  const report = await getLatestReport();

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <header className="mb-8 border-b-4 border-black pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-neutral-600">
                Automated sports journalism support for the modern newsroom
              </p>
              <h1 className="text-4xl font-black uppercase tracking-tight md:text-6xl">
                {SITE_TITLE}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700 md:text-base">
                This report is an automated summary intended to support, not replace,
                human sports journalism.
              </p>
            </div>

            <div className="w-full max-w-sm border border-black bg-white p-4 text-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="mb-2 font-bold uppercase">Daily Edition</div>
              <div className="space-y-1 text-neutral-800">
                {report.generated_date ? (
                  <p>
                    <span className="font-semibold">Date:</span> {report.generated_date}
                  </p>
                ) : null}
                {report.updated_at ? (
                  <p>
                    <span className="font-semibold">Updated:</span> {report.updated_at}
                  </p>
                ) : null}
                {report.published_at ? (
                  <p>
                    <span className="font-semibold">Published:</span> {report.published_at}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="mb-10 grid gap-4 md:grid-cols-3">
          <Link
            href={SUBSTACK_URL}
            target="_blank"
            className="border border-black bg-white px-5 py-4 text-center text-sm font-bold uppercase tracking-wide transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            Read on Substack
          </Link>

          <Link
            href={X_URL}
            target="_blank"
            className="border border-black bg-white px-5 py-4 text-center text-sm font-bold uppercase tracking-wide transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            Follow on X
          </Link>

          <Link
            href={FULL_REPORT_URL}
            target="_blank"
            className="border border-black bg-black px-5 py-4 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            Open Full Report Feed
          </Link>
        </section>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="mb-4 border-b-2 border-black pb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
                Lead Report
              </p>
              <h2 className="text-2xl font-black uppercase leading-tight md:text-3xl">
                {report.title || "GLOBAL SPORTS REPORT"}
              </h2>
            </div>

            {report.summary ? (
              <div className="mb-6 border-l-4 border-black bg-neutral-50 p-4">
                <p className="text-base font-medium leading-7 text-neutral-900">
                  {report.summary}
                </p>
              </div>
            ) : null}

            <div className="text-[15px]">
              {report.content ? (
                formatTextBlock(report.content)
              ) : (
                <p className="leading-7 text-neutral-800">
                  The latest consolidated report will appear here when the new edition
                  is written to <code>public/latest_report.json</code>.
                </p>
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="mb-3 text-lg font-black uppercase">Newsroom Snapshot</h3>
              <div className="space-y-3 text-sm leading-6 text-neutral-800">
                <p>
                  <span className="font-semibold">Edition:</span>{" "}
                  {report.generated_date || "Current"}
                </p>
                <p>
                  <span className="font-semibold">Coverage:</span>{" "}
                  {report.sections?.length
                    ? `${report.sections.length} active report sections`
                    : "Main report loaded"}
                </p>
                <p>
                  <span className="font-semibold">Workflow:</span> Built for journalists,
                  editors, broadcasters, podcasters, and analysts.
                </p>
              </div>
            </div>

            <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="mb-3 text-lg font-black uppercase">About GSR</h3>
              <p className="text-sm leading-6 text-neutral-800">
                Global Sports Report is designed to support newsroom workflows with
                timely, multi-platform sports summaries that keep the voice
                professional and journalist-friendly.
              </p>
            </div>
          </aside>
        </section>

        {report.sections && report.sections.length > 0 ? (
          <section className="mb-12">
            <div className="mb-5 border-b-4 border-black pb-3">
              <h2 className="text-2xl font-black uppercase tracking-tight">
                League Coverage
              </h2>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {report.sections.map((section, index) => (
                <article
                  key={`${section.title || "section"}-${index}`}
                  className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="mb-4 border-b border-neutral-300 pb-3">
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
                      {getSectionLabel(section, index)}
                    </p>
                    <h3 className="text-xl font-black uppercase leading-tight">
                      {section.title || `${getSectionLabel(section, index)} Report`}
                    </h3>
                    {section.updated_at ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        Updated: {section.updated_at}
                      </p>
                    ) : null}
                  </div>

                  {section.summary ? (
                    <div className="mb-4 border-l-4 border-black bg-neutral-50 p-3">
                      <p className="text-sm font-medium leading-6 text-neutral-900">
                        {section.summary}
                      </p>
                    </div>
                  ) : null}

                  {section.content ? (
                    <div className="mb-4 text-sm">
                      {formatTextBlock(section.content)}
                    </div>
                  ) : null}

                  {section.advanced ? (
                    <div className="mt-5 border-t-2 border-dashed border-neutral-300 pt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
                        Advanced
                      </p>
                      <h4 className="text-base font-black uppercase">
                        {section.advanced.title || "Advanced Report"}
                      </h4>

                      {section.advanced.updated_at ? (
                        <p className="mt-1 text-sm text-neutral-600">
                          Updated: {section.advanced.updated_at}
                        </p>
                      ) : null}

                      {section.advanced.summary ? (
                        <div className="mt-3 border-l-4 border-neutral-700 bg-neutral-50 p-3">
                          <p className="text-sm leading-6 text-neutral-900">
                            {section.advanced.summary}
                          </p>
                        </div>
                      ) : null}

                      {section.advanced.content ? (
                        <div className="mt-3 text-sm">
                          {formatTextBlock(section.advanced.content)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="border-t-4 border-black pt-6">
          <p className="text-sm leading-6 text-neutral-700">
            This report is an automated summary intended to support, not replace,
            human sports journalism.
          </p>
        </footer>
      </div>
    </main>
  );
}