import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { DB_PATH, createAgent, getAgentsByUser, type AgentProvider } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userEmail = (session?.user?.email ?? "").toLowerCase();
  if (!userEmail) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const agents = getAgentsByUser(DB_PATH, userEmail);
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userEmail = (session?.user?.email ?? "").toLowerCase();
  if (!userEmail) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { name?: string; provider?: string; model?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const provider = body.provider as AgentProvider | undefined;
  const model = body.model?.trim() ?? "";
  const apiKey = body.apiKey?.trim() ?? "";

  if (!name) return NextResponse.json({ error: "Nom de l'agent obligatoire" }, { status: 400 });
  if (provider !== "deepseek" && provider !== "openrouter") {
    return NextResponse.json({ error: "Provider invalide (deepseek ou openrouter)" }, { status: 400 });
  }
  if (!model) return NextResponse.json({ error: "Modèle obligatoire" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "Clé API obligatoire" }, { status: 400 });

  try {
    const agent = createAgent(DB_PATH, userEmail, name, provider, model, apiKey);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur création agent" }, { status: 500 });
  }
}
