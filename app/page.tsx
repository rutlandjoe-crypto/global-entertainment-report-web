import Image from "next/image";

export default function Home() {
  const report = `GLOBAL SPORTS REPORT | 2026-04-05

This report is an automated summary intended to support, not replace, human sports journalism.

TOP LINES
• MLB, NBA, NHL, and soccer coverage can live here each day.
• This homepage can become the central hub for your daily reports.
• Future versions can add league tabs, archives, and distribution links.

MLB
Across Major League Baseball, today’s slate features completed games, live action, and upcoming first pitches.

NBA
Daily NBA coverage and key developments will appear here.

NHL
Daily NHL coverage and game snapshots will appear here.

SOCCER
Global soccer coverage and major competition updates will appear here.`;

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Global Sports Report"
            width={64}
            height={64}
            className="rounded"
          />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Global Sports Report
            </h1>
            <p className="mt-2 text-gray-600">
              Automated reporting built to support, not replace, human sports journalism.
            </p>
          </div>
        </header>

        <section className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <h2 className="mb-3 text-2xl font-semibold">Daily Report</h2>
          <p className="text-gray-600">
            This is the live front page for your sports media product.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-gray-100 p-6 shadow-sm">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-900">
            {report}
          </pre>
        </section>
      </div>
    </main>
  );
}