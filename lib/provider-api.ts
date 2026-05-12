export type ProviderConnectionStatus = {
  ok: boolean;
  provider: string;
  status: "connected" | "missing_api_key" | "auth_error" | "network_error" | "error";
  message: string;
};

export async function checkOpenAiConnection(
  fetchImpl: typeof fetch = fetch
): Promise<ProviderConnectionStatus> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { ok: false, provider: "OpenAI", status: "missing_api_key", message: "OPENAI_API_KEY non configurée" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const res = await fetchImpl("https://api.openai.com/v1/models", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (res.ok) {
      return { ok: true, provider: "OpenAI", status: "connected", message: "Connexion OpenAI active" };
    }
    if (res.status === 401) {
      return { ok: false, provider: "OpenAI", status: "auth_error", message: "Clé API invalide ou expirée" };
    }
    return { ok: false, provider: "OpenAI", status: "error", message: `Erreur HTTP ${res.status}` };
  } catch {
    return { ok: false, provider: "OpenAI", status: "network_error", message: "Erreur réseau ou hôte inaccessible" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkProviderConnection(
  providerName: string,
  fetchImpl: typeof fetch = fetch
): Promise<ProviderConnectionStatus> {
  if (providerName === "OpenAI") {
    return checkOpenAiConnection(fetchImpl);
  }
  return { ok: false, provider: providerName, status: "error", message: `Fournisseur ${providerName} non supporté` };
}
