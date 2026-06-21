"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const PROVIDER_MODELS: Record<string, string[]> = {
  deepseek: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
  openrouter: [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3.1-70b-instruct",
    "mistralai/mistral-large",
    "google/gemini-pro-1.5",
  ],
};

type TestStatus = "idle" | "loading" | "ok" | "error";

export default function NewAgentForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"deepseek" | "openrouter">("deepseek");
  const [models, setModels] = useState<string[]>(PROVIDER_MODELS.deepseek);
  const [model, setModel] = useState(PROVIDER_MODELS.deepseek[0]);
  const [apiKey, setApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  function onProviderChange(p: "deepseek" | "openrouter") {
    setProvider(p);
    const defaultModels = PROVIDER_MODELS[p];
    setModels(defaultModels);
    setModel(defaultModels[0]);
    setTestStatus("idle");
    setTestMessage("");
  }

  async function handleTest() {
    if (!apiKey.trim()) {
      setTestStatus("error");
      setTestMessage("Veuillez saisir une clé API avant de tester.");
      return;
    }
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await fetch("/api/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      const data = await res.json() as { success: boolean; models?: string[]; error?: string };
      if (data.success) {
        setTestStatus("ok");
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          setModel(data.models[0]);
          setTestMessage(`Connexion réussie — ${data.models.length} modèle(s) disponible(s)`);
        } else {
          setTestMessage("Connexion réussie");
        }
      } else {
        setTestStatus("error");
        setTestMessage(data.error ?? "Erreur de connexion");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Erreur réseau lors du test");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (testStatus !== "ok") return;
    setSubmitError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), provider, model, apiKey: apiKey.trim() }),
        });
        const data = await res.json() as { agent?: unknown; error?: string };
        if (res.ok && data.agent) {
          router.push("/agents");
          router.refresh();
        } else {
          setSubmitError(data.error ?? "Erreur lors de la création");
        }
      } catch {
        setSubmitError("Erreur réseau lors de la création");
      }
    });
  }

  const testBtnLabel = testStatus === "loading" ? "Test en cours…" : "Tester la connexion";
  const canCreate = testStatus === "ok" && name.trim().length > 0 && model.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8f0", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <a href="/agents" style={{ color: "#38B6FF", textDecoration: "none", fontSize: "0.85rem" }}>← Retour aux agents</a>
        <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1.6rem", fontWeight: 700, color: "#fff" }}>Nouvel agent IA</h1>
        <p style={{ margin: 0, color: "#8888aa", fontSize: "0.9rem" }}>Connecté : {userEmail}</p>
      </header>

      <div style={{ maxWidth: 560, background: "#13131f", border: "1px solid #2a2a3a", borderRadius: 12, padding: "1.75rem" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Nom */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Nom de l&apos;agent</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : DeepSeek code reviewer"
              required
              style={inputStyle}
            />
          </label>

          {/* Provider */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Provider</span>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as "deepseek" | "openrouter")}
              style={inputStyle}
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </label>

          {/* Modèle */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Modèle</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle}>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          {/* Clé API */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Clé API</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); setTestMessage(""); }}
              placeholder="sk-…"
              autoComplete="off"
              style={inputStyle}
            />
          </label>

          {/* Bouton test */}
          <button
            type="button"
            onClick={handleTest}
            disabled={testStatus === "loading"}
            style={{
              ...btnBase,
              background: testStatus === "ok" ? "#00FFB2" : testStatus === "error" ? "#FF6B6B" : "#38B6FF",
              color: testStatus === "ok" || testStatus === "error" ? "#0a0a0f" : "#0a0a0f",
              opacity: testStatus === "loading" ? 0.6 : 1,
              cursor: testStatus === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {testBtnLabel}
          </button>

          {/* Message test */}
          {testMessage && (
            <p style={{
              margin: 0,
              padding: "0.6rem 0.875rem",
              borderRadius: 8,
              fontSize: "0.85rem",
              background: testStatus === "ok" ? "rgba(0,255,178,.1)" : "rgba(255,107,107,.1)",
              color: testStatus === "ok" ? "#00FFB2" : "#FF6B6B",
              border: `1px solid ${testStatus === "ok" ? "rgba(0,255,178,.3)" : "rgba(255,107,107,.3)"}`,
            }}>
              {testStatus === "ok" ? "✓ " : "✗ "}{testMessage}
            </p>
          )}

          {/* Erreur submit */}
          {submitError && (
            <p style={{ margin: 0, color: "#FF6B6B", fontSize: "0.85rem" }}>{submitError}</p>
          )}

          {/* Bouton créer */}
          <button
            type="submit"
            disabled={!canCreate || isPending}
            style={{
              ...btnBase,
              background: canCreate && !isPending ? "#A78BFA" : "#2a2a3a",
              color: canCreate && !isPending ? "#0a0a0f" : "#666",
              cursor: canCreate && !isPending ? "pointer" : "not-allowed",
            }}
          >
            {isPending ? "Création…" : "Créer l'agent"}
          </button>

        </form>

        {testStatus !== "ok" && (
          <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#555570", textAlign: "center" }}>
            Testez d&apos;abord la connexion pour activer la création
          </p>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelTextStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#8888aa",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  background: "#0d0d1a",
  border: "1px solid #2a2a3a",
  borderRadius: 8,
  color: "#e8e8f0",
  padding: "0.6rem 0.875rem",
  fontSize: "0.95rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "0.7rem 1.25rem",
  fontSize: "0.95rem",
  fontWeight: 700,
  transition: "opacity .15s",
};
