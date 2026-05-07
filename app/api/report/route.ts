import { NextResponse } from "next/server";
import { loadReport } from "@/app/report-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const json = await loadReport();

    if (!Object.keys(json).length) {
      return NextResponse.json(
        { error: "Live report not found" },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
    }

    return NextResponse.json(json, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("report route error:", error);
    return NextResponse.json(
      { error: "Failed to load live report" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}
