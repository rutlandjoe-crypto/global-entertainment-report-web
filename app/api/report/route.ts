import { NextResponse } from "next/server";
import { loadReport, REPORT_CACHE_HEADERS } from "@/app/report-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET() {
  try {
    const json = await loadReport();

    if (!Object.keys(json).length) {
      return NextResponse.json(
        { error: "Live report not found" },
        {
          status: 404,
          headers: REPORT_CACHE_HEADERS,
        }
      );
    }

    return NextResponse.json(json, {
      headers: REPORT_CACHE_HEADERS,
    });
  } catch (error) {
    console.error("report route error:", error);
    return NextResponse.json(
      { error: "Failed to load live report" },
      {
        status: 500,
        headers: REPORT_CACHE_HEADERS,
      }
    );
  }
}
