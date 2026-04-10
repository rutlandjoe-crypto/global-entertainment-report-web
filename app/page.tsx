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
  full_report?: string;
  updated_at?: string;
  disclaimer?: string;
};

function readReportData(): ReportData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "latest_report.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to read latest_report.json:", error);
    return null;
  }
}

function formatContent(content: string) {
  return content.split("\n").map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-4" />;
    }

    const isSubhead = [
      "SNAPSHOT",
      "FINAL SCORES",
      "LIVE",
      "LIVE GAMES",
      "UPCOMING",
      "KEY STORYLINES",
      "HEADLINE",
    ].includes(trimmed);

    if (isSubhead) {
      return (
        <h4 key={index} className="mt-4 mb-2 text-base font-bold tracking-wide">
          {trimmed}
        </h4>
      );
    }

    return (
      <p key={index} className="mb-2 leading-7">
        {trimmed}
      </p>
    );
  });
}

export default function Home() {
  const report = readReportData();

  if (!report) {
    return (
      <main className="min-h-screen bg-white text-black p-8">
        <h1 className="text-3xl font-bold mb-4">Global Sports Report</h1>
        <p>Latest report data is unavailable.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-3">
          {report.title || "Global Sports Report"}
        </h1>

        {report.updated_at && (
          <p className="text-sm mb-6 text-gray-600">
            Updated: {report.updated_at}
          </p>
        )}

        {report.headline && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-3">Headline</h2>
            <p className="text-lg leading-8">{report.headline}</p>
          </section>
        )}

        {report.key_storylines && report.key_storylines.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-3">Key Storylines</h2>
            <ul className="space-y-2">
              {report.key_storylines.map((item, idx) => (
                <li key={idx} className="leading-7">
                  • {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.sections && report.sections.length > 0 ? (
          <div className="space-y-10">
            {report.sections.map((section, idx) => (
              <section key={idx} className="border-t pt-6">
                <h2 className="text-2xl font-bold mb-4">{section.name}</h2>
                <div>{formatContent(section.content)}</div>
              </section>
            ))}
          </div>
        ) : (
          report.full_report && (
            <section className="border-t pt-6">
              <div>{formatContent(report.full_report)}</div>
            </section>
          )
        )}

        {report.disclaimer && (
          <footer className="border-t mt-10 pt-6 text-sm text-gray-600">
            {report.disclaimer}
          </footer>
        )}
      </div>
    </main>
  );
}