import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { testProviderConnection } from "../../../../lib/provider-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userEmail = (session?.user?.email ?? "").toLowerCase();
  if (!userEmail) return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });

  let body: { provider?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Corps de requête invalide" }, { status: 400 });
  }

  const provider = body.provider;
  const apiKey = body.apiKey?.trim() ?? "";

  if (provider !== "deepseek" && provider !== "openrouter") {
    return NextResponse.json({ success: false, error: "Provider non supporté (deepseek ou openrouter)" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "Clé API manquante" }, { status: 400 });
  }

  const result = await testProviderConnection(provider, apiKey);
  return NextResponse.json(result);
}
