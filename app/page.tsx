import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DB_PATH, USAGE_TIME_RANGES, getUserById, listDashboardData, normalizeUsageTimeRange, seedDefaultProviders } from "../lib/db";
import VisualDashboard from "../components/VisualDashboard";
import DashboardShell from "../components/DashboardShell";
import AutoRefresh from "./AutoRefresh";
import { currentUserId, googleSignInAction, logoutAction, createProjectAction, createAiAccountAction, assignAiSetupAction, importFallbackUsageAction, getOpenAiStatusAction } from "./actions";
import { auth } from "../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function AuthScreen() {
  return <main className="shell">
    <section className="hero"><div><p className="eyebrow">Dashboard local sécurisé</p><h1>TorquePilot AI Conso</h1><p className="subtitle">Connecte-toi avec ton compte Gmail pour accéder au dashboard.</p></div><div className="badge">Google Auth</div></section>
    <section className="authGrid">
      <form action={googleSignInAction} className="panel form">
        <h2>Connexion</h2>
        <p className="muted">Seuls les comptes Gmail autorisés peuvent accéder au dashboard.</p>
        <button type="submit">Se connecter avec Gmail</button>
      </form>
    </section>
  </main>;
}

function euro(value: number) { return `${value.toFixed(4)} €`; }
function price(value: number | null) { return value == null ? "à préciser" : `${value} €/M tok`; }
function categoryLabel(value: string) {
  const labels: Record<string, string> = { text: "Texte", image: "Image", search: "Recherche", tts: "TTS", stt: "STT", local: "Local" };
  return labels[value] || value;
}
function connectionLabel(value: string) { return value === "api" ? "API" : value === "local" ? "Local" : "Abonnement"; }
function shortDate(value: string) { return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); }
function percent(value: number) { return `${Math.max(3, Math.round(value * 100))}%`; }
function dashboardHref(projectId: number | undefined | null, range: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", String(projectId));
  if (range !== "all") params.set("range", range);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

type HermesFallbackState = {
  status: string;
  fallbackActive: boolean;
  activeProvider: string;
  activeModel: string;
  generatedAt?: string;
  lastEventType?: string;
  lastEventAt?: string;
  lastEventSource?: string;
  eventCount?: number;
  fallbackEventCount?: number;
  recentFallbackEventCount?: number;
  recentWindowHours?: number;
  containsSecrets?: boolean;
  safety?: { containsSecrets?: boolean; containsMessageContent?: boolean; redacted?: boolean };
};

function readHermesFallbackState(): HermesFallbackState {
  const fallbackPath = join(process.cwd(), "public", "hermes-fallback-state.json");
  if (!existsSync(fallbackPath)) return { status: "missing", fallbackActive: false, activeProvider: "non disponible", activeModel: "non disponible" };
  try {
    const parsed = JSON.parse(readFileSync(fallbackPath, "utf8")) as Partial<HermesFallbackState>;
    return {
      status: typeof parsed.status === "string" ? parsed.status : "unknown",
      fallbackActive: Boolean(parsed.fallbackActive),
      activeProvider: typeof parsed.activeProvider === "string" ? parsed.activeProvider : "non disponible",
      activeModel: typeof parsed.activeModel === "string" ? parsed.activeModel : "non disponible",
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      lastEventType: typeof parsed.lastEventType === "string" ? parsed.lastEventType : undefined,
      lastEventAt: typeof parsed.lastEventAt === "string" ? parsed.lastEventAt : undefined,
      lastEventSource: typeof parsed.lastEventSource === "string" ? parsed.lastEventSource : undefined,
      eventCount: typeof parsed.eventCount === "number" ? parsed.eventCount : undefined,
      fallbackEventCount: typeof parsed.fallbackEventCount === "number" ? parsed.fallbackEventCount : undefined,
      recentFallbackEventCount: typeof parsed.recentFallbackEventCount === "number" ? parsed.recentFallbackEventCount : undefined,
      recentWindowHours: typeof parsed.recentWindowHours === "number" ? parsed.recentWindowHours : undefined,
      containsSecrets: Boolean(parsed.containsSecrets || parsed.safety?.containsSecrets),
    };
  } catch {
    return { status: "error", fallbackActive: false, activeProvider: "lecture impossible", activeModel: "lecture impossible" };
  }
}

function fallbackStatusLabel(state: HermesFallbackState) {
  if (state.status !== "ok") return "Source indisponible";
  return state.fallbackActive ? "Fallback actif" : "Principal actif";
}

function freshnessLabel(value?: string) {
  if (!value) return { label: "fraîcheur inconnue", stale: true };
  const generatedMs = new Date(value).getTime();
  if (!Number.isFinite(generatedMs)) return { label: "date invalide", stale: true };
  const ageSeconds = Math.max(0, Math.round((Date.now() - generatedMs) / 1000));
  const label = ageSeconds < 60 ? `mis à jour il y a ${ageSeconds} s` : ageSeconds < 3600 ? `mis à jour il y a ${Math.round(ageSeconds / 60)} min` : `mis à jour il y a ${Math.round(ageSeconds / 3600)} h`;
  return { label, stale: ageSeconds > 90 };
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ error?: string; project?: string; range?: string }> }) {
  seedDefaultProviders(DB_PATH);
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  const session = await auth();
  const googleUser = session?.user;
  if (!user) return <AuthScreen />;

  const selectedProjectId = params?.project ? Number(params.project) : undefined;
  const timeRange = normalizeUsageTimeRange(params?.range);
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId, 1, timeRange);
  const selectedProject = data.selectedProject;
  const openAiStatus = await getOpenAiStatusAction();
  const fallbackLiveState = readHermesFallbackState();
  const fallbackFreshness = freshnessLabel(fallbackLiveState.generatedAt);
  const stats = [
    ["Projets", String(data.projects.length), "isolés par utilisateur"],
    ["Comptes IA", String(data.aiAccounts.length), "abonnements/API/local"],
    ["Tokens estimés", data.usage.tokens.toLocaleString("fr-FR"), "texte ou logs collés"],
    ["Coût API estimé", euro(data.usage.cost), "hors abonnements"],
  ];

  return <DashboardShell userEmail={user.email}>
    <main className="shell dashboardContent">
      <AutoRefresh intervalMs={10000} />
      <section className="hero"><div><p className="eyebrow">Connecté : {googleUser?.name ?? user.email}{googleUser?.email ? ` · ${googleUser.email}` : ""}</p><h1>TorquePilot AI Conso</h1><p className="subtitle">HOME allégée : KPIs, fallback live, projet, comptes et affectations essentielles. Les imports, rapports et catalogue IA sont dans la section COLLECTE.</p></div><div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>{googleUser?.image && <img src={googleUser.image} alt="avatar" style={{width:36,height:36,borderRadius:"50%"}} />}<form action={logoutAction}><button className="ghost">Déconnexion</button></form></div></section>
      {params?.error && <p className="alert">{params.error}</p>}
      <section className="grid stats">{stats.map(([label, value, hint]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</section>

      <section className={`panel fallbackLivePanel ${fallbackLiveState.fallbackActive ? "fallbackLiveActive" : ""}`}>
        <div className="sectionHeader">
          <div><p className="eyebrow">Fallback live redacted</p><h2>{fallbackStatusLabel(fallbackLiveState)}</h2><p className="muted">Source locale <code>public/hermes-fallback-state.json</code>, générée depuis logs techniques redacted. Aucun secret ni message brut affiché.</p></div>
          <span className={`pill ${fallbackFreshness.stale ? "fallbackFreshnessStale" : "fallbackFreshnessFresh"}`}>{fallbackFreshness.label}</span>
        </div>
        <div className="fallbackLiveGrid">
          <article><span>Provider actif</span><strong>{fallbackLiveState.activeProvider}</strong></article>
          <article><span>Modèle actif</span><strong>{fallbackLiveState.activeModel}</strong></article>
          <article><span>Fraîcheur</span><strong>{fallbackFreshness.stale ? "À surveiller" : "Live OK"}</strong><small>{fallbackLiveState.generatedAt ? shortDate(fallbackLiveState.generatedAt) : "génération inconnue"}</small></article>
          <article><span>Dernier événement</span><strong>{fallbackLiveState.lastEventType || "non disponible"}</strong><small>{fallbackLiveState.lastEventSource || "source inconnue"}{fallbackLiveState.lastEventAt ? ` · ${shortDate(fallbackLiveState.lastEventAt)}` : ""}</small></article>
          <article className={(fallbackLiveState.recentFallbackEventCount ?? 0) > 0 ? "fallbackEventAlert" : ""}><span>Bascules fallback</span><strong>{fallbackLiveState.recentFallbackEventCount ?? 0} / {fallbackLiveState.recentWindowHours ?? 24}h</strong><small>{fallbackLiveState.fallbackEventCount ?? 0} événements fallback connus · {fallbackLiveState.eventCount ?? 0} événements techniques</small></article>
          <article><span>Sécurité</span><strong>{fallbackLiveState.containsSecrets ? "À vérifier" : "Redacted OK"}</strong><small>{fallbackLiveState.containsSecrets ? "marqueur sensible détecté" : "aucun marqueur sensible déclaré"}</small></article>
        </div>
      </section>

      <section className="panel timeRangePanel"><div><p className="eyebrow">Période active</p><h2>Filtre données SQLite</h2><p className="muted">Radar, donut, tendances et liste d’usage reflètent la période sélectionnée.</p></div><div className="rangeTabs">{USAGE_TIME_RANGES.map((range) => <a key={range.id} className={`rangeTab ${timeRange === range.id ? "active" : ""}`} href={dashboardHref(selectedProject?.id ?? selectedProjectId, range.id)} title={range.hint}>{range.label}</a>)}</div></section>
      <VisualDashboard agents={data.visualDashboard.agents} timeRange={data.visualDashboard.timeRange} />

      <section className="layout">
        <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Espace projet</p><h2>{selectedProject ? selectedProject.name : "Aucun projet"}</h2></div>{selectedProject && <span className="pill">API {euro(data.projectUsage.cost)} · Abos {euro(data.projectUsage.subscriptionMonthly)}/mois</span>}</div>
          <form action={createProjectAction} className="inlineForm"><input name="name" placeholder="Nom projet ex: TorquePilot RAG" required /><input name="description" placeholder="Description" /><button>Ajouter projet</button></form>
          <div className="projectTabs">{data.projects.length ? data.projects.map((p) => <a className={`tab ${p.id === selectedProject?.id ? "active" : ""}`} href={dashboardHref(p.id, timeRange)} key={p.id}><strong>{p.name}</strong><small>{p.description || "Sans description"}</small></a>) : <p className="muted">Dashboard vierge : ajoute ton premier projet.</p>}</div>
        </article>
        <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Bloc déplacé</p><h2>Collecte dédiée</h2></div><a className="buttonLink" href={selectedProject ? `/collecte?project=${selectedProject.id}` : "/collecte"}>Ouvrir COLLECTE</a></div><p className="muted">Rapports historiques, collecteur local Phase 4I, collecte automatique Phase 4C et catalogue IA sont maintenant isolés dans cette section.</p></aside>
      </section>

      <section className="layout usageLayout">
        <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Comptes IA</p><h2>Créer un compte IA</h2></div></div>
          <form action={createAiAccountAction} className="usageForm">
            <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />
            <label>Nom du compte<input name="name" placeholder="Ex: ChatGPT Rudy / OpenAI API TorquePilot" required /></label>
            <label>Entreprise<select name="providerId" required>{data.providers.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
            <label>Type de connexion<select name="connectionType" defaultValue="subscription"><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label>
            <label>Nom abonnement<input name="subscriptionName" placeholder="Ex: ChatGPT Plus, Claude Pro" /></label>
            <label>Coût mensuel €<input name="monthlyCostEur" type="number" min="0" step="0.01" defaultValue="0" /></label>
            <label>Notes<input name="notes" placeholder="Limites, usage prévu, propriétaire" /></label>
            <button>Enregistrer le compte IA</button>
          </form>
        </article>
        <aside className="panel"><h2>Comptes enregistrés</h2><p className="muted">Aucune clé API n’est affichée ni stockée ici.</p><div className="apiStatus"><span>OpenAI API</span><span className={openAiStatus.ok ? "pill apiStatusOk" : openAiStatus.status === "missing_api_key" ? "apiStatusMissing" : "apiStatusError"}>{openAiStatus.ok ? "Connecté" : openAiStatus.status === "missing_api_key" ? "Non configuré" : "Erreur connexion"}</span></div><div className="list">{data.aiAccounts.length ? data.aiAccounts.map((a) => <div className="row compact" key={a.id}><div><h3>{a.name}</h3><p>{a.providerName || "Fournisseur"} · {connectionLabel(a.connectionType)}{a.subscriptionName ? ` · ${a.subscriptionName}` : ""}</p></div><span className="pill">{euro(a.monthlyCostEur)}/mois</span></div>) : <p className="muted">Aucun compte IA enregistré.</p>}</div></aside>
      </section>

      <section className="layout usageLayout">
        <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Affectation projet</p><h2>Associer compte + modèle</h2></div></div>
          {selectedProject && data.aiAccounts.length ? <form action={assignAiSetupAction} className="usageForm">
            <input type="hidden" name="projectId" value={selectedProject.id} />
            <label>Compte IA<select name="accountId" required>{data.aiAccounts.map((a) => <option value={a.id} key={a.id}>{a.name} — {connectionLabel(a.connectionType)}</option>)}</select></label>
            <label>Modèle<select name="modelId" required>{data.models.map((m) => <option value={m.id} key={m.id}>{m.providerName} — {m.name} · {categoryLabel(m.category)}</option>)}</select></label>
            <label>Type pour ce projet<select name="connectionType" defaultValue="subscription"><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label>
            <label>Libellé<input name="label" placeholder="Ex: Compte principal TorquePilot" /></label>
            <p className="muted">Les prix viennent automatiquement du catalogue local selon le modèle choisi.</p>
            <button>Affecter au projet</button>
          </form> : <p className="muted">Ajoute d’abord un projet et un compte IA.</p>}
        </article>
        <aside className="panel"><h2>IA affectées au projet</h2><p className="muted">Vue synthétique. Les opérations avancées restent disponibles via AGENTS.</p><div className="list">{data.projectAiSetups.length ? data.projectAiSetups.map((s) => <div className="row compact" key={s.id}><div><h3>{s.label}</h3><p>{s.accountName} · {s.providerName || "IA"} · {s.modelName || "Modèle"}</p><p>{connectionLabel(s.connectionType)} · Input {price(s.inputPricePerMillion)} · Output {price(s.outputPricePerMillion)}</p></div><span className="pill">{s.connectionType === "subscription" ? `${euro(s.monthlyCostEur)}/mois` : "estimable"}</span></div>) : <p className="muted">Aucune IA affectée à ce projet.</p>}</div></aside>
      </section>

      <section className="layout usageLayout">
        <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Phase 4H</p><h2>Tendance consommation</h2></div>{data.usageCharts && <span className="pill">{data.usageCharts.totals.totalTokens.toLocaleString("fr-FR")} tok</span>}</div>
          {data.usageCharts && data.usageCharts.totals.entries ? <div className="chartStack"><div className="chartSummary"><div><span>Entrées</span><strong>{data.usageCharts.totals.entries}</strong></div><div><span>Input</span><strong>{data.usageCharts.totals.inputTokens.toLocaleString("fr-FR")}</strong></div><div><span>Output</span><strong>{data.usageCharts.totals.outputTokens.toLocaleString("fr-FR")}</strong></div><div><span>Cache</span><strong>{data.usageCharts.totals.cacheTokens.toLocaleString("fr-FR")}</strong></div><div><span>Reasoning</span><strong>{data.usageCharts.totals.reasoningTokens.toLocaleString("fr-FR")}</strong></div><div><span>Coût estimé</span><strong>{euro(data.usageCharts.totals.costEur)}</strong></div></div><div className="barChart">{data.usageCharts.daily.map((day) => <div className="barRow" key={day.date}><span>{day.date}</span><div className="barTrack"><i style={{ width: percent(day.maxRatio) }}></i></div><strong>{day.totalTokens.toLocaleString("fr-FR")} tok</strong></div>)}</div></div> : <p className="muted">Aucune donnée locale à afficher pour ce projet.</p>}
        </article>
        <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Répartition</p><h2>Top IA/modèles</h2></div></div>{data.usageCharts && data.usageCharts.totals.entries ? <div className="chartStack"><div>{data.usageCharts.topProviders.map((item) => <div className="miniBar" key={item.name}><div><strong>{item.name}</strong><span>{item.totalTokens.toLocaleString("fr-FR")} tok · cache {item.cacheTokens.toLocaleString("fr-FR")} · rais. {item.reasoningTokens.toLocaleString("fr-FR")} · {euro(item.costEur)}</span></div><div className="barTrack"><i style={{ width: percent(item.maxRatio) }}></i></div></div>)}</div><div>{data.usageCharts.topModels.map((item) => <div className="miniBar" key={item.name}><div><strong>{item.name}</strong><span>{item.totalTokens.toLocaleString("fr-FR")} tok</span></div><div className="barTrack"><i style={{ width: percent(item.maxRatio) }}></i></div></div>)}</div></div> : <p className="muted">Les agrégats se remplissent après import/estimation locale.</p>}</aside>
      </section>

      <section className="layout usageLayout">
        <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Fallback connecté</p><h2>Import secours universel</h2></div><span className="pill">sans clé API</span></div>
          {selectedProject && data.projectAiSetups.length ? <form action={importFallbackUsageAction} className="usageForm">
            <input type="hidden" name="projectId" value={selectedProject.id} />
            <label>Configuration IA<select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label} — {connectionLabel(s.connectionType)}</option>)}</select></label>
            <label>Libellé/source<input name="label" placeholder="Ex: session debug, génération contenu, log inconnu" defaultValue="Fallback conversation isolée" /></label>
            <label>Conversation / JSON / log brut<textarea name="rawExport" placeholder={'Fallback texte :\nUser: prompt ou log entrée\nAssistant: réponse ou log sortie\n\nOu JSON générique : {"input_tokens":1200,"output_tokens":350,"cache_tokens":80,"reasoning_tokens":20,"used_at":"2026-05-22"}'} rows={8} required></textarea></label>
            <label>Date par défaut<input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <button>Importer via fallback</button>
            <p className="muted">Le fallback tente d’abord JSON/JSONL générique, puis bascule sur l’estimation texte <code>User:</code>/<code>Assistant:</code>. Coût calculé depuis la configuration sélectionnée ; aucun secret n’est lu ni stocké.</p>
          </form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
        </aside>
        <aside className="panel"><h2>Formats connecteurs</h2><ul className="tasks"><li><span>OpenAI</span><strong>Responses / ChatCompletions</strong><small>usage.input_tokens/output_tokens, prompt_tokens/completion_tokens, created_at epoch</small></li><li><span>Anthropic</span><strong>Claude Messages</strong><small>usage.input_tokens, usage.output_tokens, id msg_*</small></li><li><span>Google</span><strong>Gemini usageMetadata</strong><small>promptTokenCount, candidatesTokenCount, responseId/createTime</small></li><li><span>Ollama/local</span><strong>Logs locaux coût 0 €</strong><small>prompt_eval_count, eval_count, model, JSONL ligne par ligne</small></li></ul></aside>
      </section>
    </main>
  </DashboardShell>;
}
