import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { readSavedUsageReport, USAGE_REPORTS_DIR } from "../../../lib/db";
import { readSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const userId = readSession(jar.get("tp_session")?.value);
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

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
