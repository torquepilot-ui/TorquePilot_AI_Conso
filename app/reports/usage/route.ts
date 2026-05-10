import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DB_PATH, USAGE_REPORTS_DIR, saveUsageReportFile, type UsageReportFormat } from "../../../lib/db";
import { readSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jar = await cookies();
  const userId = readSession(jar.get("tp_session")?.value);
  if (!userId) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("project") || 0);
  const format: UsageReportFormat = url.searchParams.get("format") === "json" ? "json" : "csv";
  if (!projectId) return NextResponse.json({ error: "Projet requis" }, { status: 400 });

  try {
    const report = saveUsageReportFile(DB_PATH, userId, { projectId, format, outputDir: USAGE_REPORTS_DIR });
    return new NextResponse(report.content, {
      headers: {
        "content-type": report.mimeType,
        "content-disposition": `attachment; filename="${report.fileName}"`,
        "x-saved-report-path": report.filePath,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Rapport refusé" }, { status: 403 });
  }
}
