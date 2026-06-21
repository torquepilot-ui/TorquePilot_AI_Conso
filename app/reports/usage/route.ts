import { NextResponse } from "next/server";
import { DB_PATH, USAGE_REPORTS_DIR, saveUsageReportFile, type UsageReportFormat } from "../../../lib/db";
import { auth } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const userId = (session as Record<string, unknown> | null)?.dbUserId;
  if (typeof userId !== "number") return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

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
