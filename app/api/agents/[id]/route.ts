import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { DB_PATH, deleteAgent } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userEmail = (session?.user?.email ?? "").toLowerCase();
  if (!userEmail) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID agent manquant" }, { status: 400 });

  const deleted = deleteAgent(DB_PATH, id, userEmail);
  if (!deleted) return NextResponse.json({ error: "Agent introuvable ou accès refusé" }, { status: 404 });

  return NextResponse.json({ success: true });
}
