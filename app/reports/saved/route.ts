import { NextRequest, NextResponse } from "next/server";
import { readSavedUsageReport, USAGE_REPORTS_DIR } from "../../../lib/db";
import { auth } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = (session as Record<string, unknown> | null)?.dbUserId;
  if (typeof userId !== "number") return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const fileName = request.nextUrl.searchParams.get("file") || "";
  try {
    const report = readSavedUsageReport(USAGE_REPORTS_DIR, fileName);
    return new NextResponse(report.content, {
      status: 200,
      headers: {
        "content-type": report.mimeType,
        "content-disposition": `attachment; filename="${report.fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Rapport introuvable ou refusé" }, { status: 404 });
  }
}
