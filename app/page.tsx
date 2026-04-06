import fs from "fs";
import path from "path";

function getReportText() {
  const possiblePaths = [
    path.join(process.cwd(), "public", "global_sports_report.txt"),
    path.join(process.cwd(), "..", "sports_bot-ai", "global_sports_report.txt"),
    path.join(process.cwd(), "global_sports_report.txt"),
  ];

  for (const reportPath of possiblePaths) {
    try {
      if (fs.existsSync(reportPath)) {
        return fs.readFileSync(reportPath, "utf8");
      }
    } catch {}
  }

  return `GLOBAL SPORTS REPORT | DEMO

This report is an automated summary intended to support, not replace, human sports journalism.

MLB
• Dodgers outlast Nationals, 8-6, with late offense.
• Marlins edge Yankees, 7-6, in a tight finish.

NBA
• League coverage updates daily.

NHL
• Daily NHL reporting structure in place.

SOCCER
• Global matches tracked daily.`;
}

export default function HomePage() {
  let report = getReportText();

report = report.replace(
  "This report is an automated summary intended to support, not replace, human sports journalism.",
  ""
);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const colors = {
    background: "#ffffff",
    text: "#000000",
    subtext: "#333333",
    border: "#d0d0d0",
    headline: "#b30000",
    link: "#0000cc",
  };

  return (
    <main
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        minHeight: "100vh",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "24px 16px 40px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <img
            src="/logo.png"
            alt="GSR Logo"
            style={{ width: "56px", height: "56px" }}
          />

          <div>
            <h1 style={{ margin: 0, fontSize: "2.6rem", fontWeight: 900 }}>
              Global Sports Report
            </h1>

            <p style={{ margin: "6px 0 0 0", fontSize: "1.05rem", color: colors.subtext }}>
              A daily, structured sports wire built for fast scanning across leagues, results, and storylines.
            </p>
          </div>
        </header>

        {/* TOP STORY */}
        <section
          style={{
            border: `1px solid ${colors.border}`,
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <div style={{ color: colors.headline, fontWeight: 900, marginBottom: "8px" }}>
            TOP STORY
          </div>

          <div style={{ color: colors.headline, fontSize: "1.9rem", fontWeight: 900 }}>
            Today’s sports landscape is organized for speed, structure, and clarity.
          </div>

          <div style={{ marginTop: "8px", color: colors.subtext }}>{today}</div>
        </section>

        {/* LEAGUES */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {[
            {
              title: "MLB",
              items: [
                "Dodgers outlast Nationals, 8-6",
                "Marlins edge Yankees, 7-6",
                "Reds hold off Rangers, 2-1",
              ],
            },
            {
              title: "NBA",
              items: [
                "League-wide coverage updated daily",
                "Structured for fast scan",
                "Built for journalist workflow",
              ],
            },
            {
              title: "NHL",
              items: [
                "Daily results and trends",
                "Clear league structure",
                "Fast access to outcomes",
              ],
            },
            {
              title: "SOCCER",
              items: [
                "Global matches tracked",
                "Competition-wide visibility",
                "Signal over noise",
              ],
            },
          ].map((section) => (
            <div
              key={section.title}
              style={{
                border: `1px solid ${colors.border}`,
                padding: "16px",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: "10px" }}>{section.title}</div>

              {section.items.map((item, i) => (
                <div key={i} style={{ marginBottom: "8px" }}>
                  <span style={{ color: colors.link }}>• </span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* FULL REPORT */}
        <section
          style={{
            border: `1px solid ${colors.border}`,
            padding: "20px",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: "10px" }}>
            Daily Report
          </div>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "Courier New, monospace",
              lineHeight: 1.6,
            }}
          >
            {report}
          </pre>
        </section>

        {/* FOOTER */}
        <footer style={{ marginTop: "20px", color: colors.subtext }}>
          This report is an automated summary intended to support, not replace, human sports journalism.
        </footer>
      </div>
    </main>
  );
}