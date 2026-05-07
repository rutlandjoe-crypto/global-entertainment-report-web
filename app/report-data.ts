import fs from "fs";
import path from "path";
import { list } from "@vercel/blob";

export type ReportData = Record<string, unknown>;

function readPublicReport(): ReportData {
  try {
    const file = path.join(process.cwd(), "public", "latest_report.json");
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function readBlobReport(): Promise<ReportData> {
  const { blobs } = await list({
    prefix: "reports/latest_report.json",
    limit: 100,
  });

  const latest = blobs
    .filter((blob) => blob.pathname === "reports/latest_report.json")
    .sort((a, b) => {
      const aTime = new Date(a.uploadedAt ?? 0).getTime();
      const bTime = new Date(b.uploadedAt ?? 0).getTime();
      return bTime - aTime;
    })[0];

  if (!latest) return {};

  const response = await fetch(latest.url, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) return {};

  const parsed = await response.json();
  return parsed && typeof parsed === "object" ? parsed : {};
}

export async function loadReport(): Promise<ReportData> {
  try {
    const blobReport = await readBlobReport();
    if (Object.keys(blobReport).length) return blobReport;
  } catch (error) {
    console.warn("Falling back to public latest_report.json:", error);
  }

  return readPublicReport();
}
