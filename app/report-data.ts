import { list } from "@vercel/blob";
import publicReportJson from "@/public/latest_report.json";

export type ReportData = Record<string, unknown>;

const REPORT_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export function readPublicReport(): ReportData {
  if (
    publicReportJson &&
    typeof publicReportJson === "object" &&
    !Array.isArray(publicReportJson)
  ) {
    return publicReportJson as ReportData;
  }

  return {};
}

async function readBlobReport(): Promise<ReportData> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return {};

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
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as ReportData)
    : {};
}

export async function loadReport(): Promise<ReportData> {
  const publicReport = readPublicReport();
  if (Object.keys(publicReport).length) return publicReport;

  try {
    const blobReport = await readBlobReport();
    if (Object.keys(blobReport).length) return blobReport;
  } catch (error) {
    console.warn("Falling back to public latest_report.json:", error);
  }

  return {};
}

export { REPORT_CACHE_HEADERS };
