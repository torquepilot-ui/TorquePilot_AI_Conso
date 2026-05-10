import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DB_PATH, USAGE_INBOX_DIR, USAGE_REPORTS_DIR, assignAiAccountToProject, createAiAccount, createProject, createUser, deleteAiAccount, deleteProject, deleteProjectAiSetup, deleteSavedUsageReport, estimateProjectUsage, getUsageCollectorHealth, getUserById, importConnectorUsage, importUsageInbox, listDashboardData, listSavedUsageReports, previewUsageInbox, seedDefaultProviders, updateAiAccount, updateProject, updateProjectAiSetup, verifyUser } from "../lib/db";
import { makeSession, readSession } from "../lib/session";

export const dynamic = "force-dynamic";

async function setSession(userId: number) {
  const jar = await cookies();
  jar.set("tp_session", makeSession(userId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
async function currentUserId() {
  const jar = await cookies();
  return readSession(jar.get("tp_session")?.value);
}
async function registerAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect("/?error=Mot de passe minimum 8 caractères");
  try { const user = createUser(DB_PATH, email, password); await setSession(user.id); } catch (err) { console.error("[registerAction]", err); redirect("/?error=Compte déjà existant ou saisie invalide"); }
  redirect("/");
}
async function loginAction(formData: FormData) {
  "use server";
  const user = verifyUser(DB_PATH, String(formData.get("email") || ""), String(formData.get("password") || ""));
  if (!user) redirect("/?error=Connexion refusée");
  await setSession(user.id);
  redirect("/");
}
async function logoutAction() {
  "use server";
  const jar = await cookies();
  jar.delete("tp_session");
  redirect("/");
}
async function createProjectAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (name) { const project = createProject(DB_PATH, userId, name, description); revalidatePath("/"); redirect(`/?project=${project.id}`); }
  redirect("/");
}
async function deleteProjectAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  try { deleteProject(DB_PATH, userId, Number(formData.get("projectId") || 0)); revalidatePath("/"); }
  catch (err) { console.error("[deleteProjectAction]", err); redirect(`/?project=${formData.get("projectId") || ""}&error=Suppression projet refusée`); }
  redirect("/");
}
async function updateProjectAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    updateProject(DB_PATH, userId, projectId, String(formData.get("name") || ""), String(formData.get("description") || ""));
    revalidatePath("/");
  } catch (err) { console.error("[updateProjectAction]", err); redirect(`/?project=${projectId}&error=Modification projet refusée`); }
  redirect(`/?project=${projectId}`);
}
async function createAiAccountAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    createAiAccount(DB_PATH, userId, {
      providerId: Number(formData.get("providerId") || 0) || null,
      name: String(formData.get("name") || ""),
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      subscriptionName: String(formData.get("subscriptionName") || ""),
      monthlyCostEur: Number(formData.get("monthlyCostEur") || 0),
      notes: String(formData.get("notes") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[createAiAccountAction]", err); redirect(`/?project=${projectId || ""}&error=Compte IA refusé`); }
  redirect(`/?project=${projectId || ""}`);
}
async function updateAiAccountAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    updateAiAccount(DB_PATH, userId, Number(formData.get("accountId") || 0), {
      providerId: Number(formData.get("providerId") || 0) || null,
      name: String(formData.get("name") || ""),
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      subscriptionName: String(formData.get("subscriptionName") || ""),
      monthlyCostEur: Number(formData.get("monthlyCostEur") || 0),
      notes: String(formData.get("notes") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[updateAiAccountAction]", err); redirect(`/?project=${projectId || ""}&error=Modification compte IA refusée`); }
  redirect(`/?project=${projectId || ""}`);
}
async function deleteAiAccountAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try { deleteAiAccount(DB_PATH, userId, Number(formData.get("accountId") || 0)); revalidatePath("/"); }
  catch (err) { console.error("[deleteAiAccountAction]", err); redirect(`/?project=${projectId || ""}&error=Suppression compte IA refusée`); }
  redirect(`/?project=${projectId || ""}`);
}
async function assignAiSetupAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    assignAiAccountToProject(DB_PATH, userId, {
      projectId,
      accountId: Number(formData.get("accountId") || 0),
      modelId: Number(formData.get("modelId") || 0) || null,
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      label: String(formData.get("label") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[assignAiSetupAction]", err); redirect(`/?project=${projectId || ""}&error=Affectation IA refusée`); }
  redirect(`/?project=${projectId}`);
}
async function updateAiSetupAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    updateProjectAiSetup(DB_PATH, userId, Number(formData.get("setupId") || 0), {
      projectId,
      accountId: Number(formData.get("accountId") || 0),
      modelId: Number(formData.get("modelId") || 0) || null,
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      label: String(formData.get("label") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[updateAiSetupAction]", err); redirect(`/?project=${projectId || ""}&error=Modification affectation IA refusée`); }
  redirect(`/?project=${projectId}`);
}
async function deleteAiSetupAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try { deleteProjectAiSetup(DB_PATH, userId, Number(formData.get("setupId") || 0)); revalidatePath("/"); }
  catch (err) { console.error("[deleteAiSetupAction]", err); redirect(`/?project=${projectId || ""}&error=Suppression affectation IA refusée`); }
  redirect(`/?project=${projectId}`);
}
async function estimateUsageAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    estimateProjectUsage(DB_PATH, userId, {
      projectId,
      setupId: Number(formData.get("setupId") || 0),
      label: String(formData.get("label") || ""),
      inputText: String(formData.get("inputText") || ""),
      outputText: String(formData.get("outputText") || ""),
      usedAt: String(formData.get("usedAt") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[estimateUsageAction]", err); redirect(`/?project=${projectId || ""}&error=Estimation refusée`); }
  redirect(`/?project=${projectId}`);
}
async function importUsageAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    importConnectorUsage(DB_PATH, userId, {
      connector: String(formData.get("connector") || "generic") as any,
      projectId,
      setupId: Number(formData.get("setupId") || 0),
      sourceName: String(formData.get("sourceName") || ""),
      rawExport: String(formData.get("rawExport") || ""),
      usedAt: String(formData.get("usedAt") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[importUsageAction]", err); redirect(`/?project=${projectId || ""}&error=Import automatique refusé`); }
  redirect(`/?project=${projectId}`);
}
async function importInboxAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    importUsageInbox(DB_PATH, userId, { rootDir: USAGE_INBOX_DIR, projectId, setupId: Number(formData.get("setupId") || 0), usedAt: String(formData.get("usedAt") || "") });
    revalidatePath("/");
  } catch (err) { console.error("[importInboxAction]", err); redirect(`/?project=${projectId || ""}&error=Import dossier refusé`); }
  redirect(`/?project=${projectId}`);
}
async function deleteSavedReportAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    deleteSavedUsageReport(USAGE_REPORTS_DIR, String(formData.get("fileName") || ""));
    revalidatePath("/");
  } catch (err) { console.error("[deleteSavedReportAction]", err); redirect(`/?project=${projectId || ""}&error=Suppression rapport refusée`); }
  redirect(`/?project=${projectId || ""}`);
}
function AuthScreen({ error }: { error?: string }) {
  return <main className="shell">
    <section className="hero"><div><p className="eyebrow">Dashboard local sécurisé</p><h1>TorquePilot AI Conso</h1><p className="subtitle">Crée ton compte local puis pilote projets, comptes IA, abonnements/API et estimations de coût.</p></div><div className="badge">MVP auth</div></section>
    {error && <p className="alert">{error}</p>}
    <section className="authGrid">
      <form action={registerAction} className="panel form"><h2>Inscription</h2><input name="email" type="email" placeholder="torquepilot34@gmail.com" required /><input name="password" type="password" placeholder="Mot de passe local" minLength={8} required /><button>Créer le compte</button></form>
      <form action={loginAction} className="panel form"><h2>Connexion</h2><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Mot de passe" required /><button>Entrer</button></form>
    </section>
  </main>;
}
function euro(value: number) { return `${value.toFixed(4)} €`; }
function price(value: number | null) { return value == null ? "à préciser" : `${value} €/M tok`; }
function categoryLabel(value: string) {
  const labels: Record<string, string> = { text: "Texte", image: "Image", search: "Recherche", tts: "TTS", stt: "STT", local: "Local" };
  return labels[value] || value;
}
function modelPriceDetail(model: { inputPricePerMillion: number | null; outputPricePerMillion: number | null; imagePrice?: number | null; pricingUnit?: string }) {
  const base = `Input ${price(model.inputPricePerMillion)} · Output ${price(model.outputPricePerMillion)}`;
  if (model.imagePrice != null) return `${base} · Image ${model.imagePrice} €/unité`;
  if (model.pricingUnit === "audio_minute") return `${base} · Audio/min`;
  if (model.pricingUnit === "character") return `${base} · Caractères`;
  if (model.pricingUnit === "local") return "Local · coût API 0 €";
  return base;
}
function connectionLabel(value: string) { return value === "api" ? "API" : value === "local" ? "Local" : "Abonnement"; }
function fileSize(bytes: number) { return bytes < 1024 ? `${bytes} o` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`; }
function shortDate(value: string) { return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); }
function percent(value: number) { return `${Math.max(3, Math.round(value * 100))}%`; }
const connectorOptions = [
  ["generic", "Auto générique JSON/JSONL"],
  ["openai", "OpenAI Responses/ChatCompletions"],
  ["anthropic", "Anthropic Claude Messages"],
  ["google", "Google Gemini usageMetadata"],
  ["ollama", "Ollama local prompt_eval/eval"],
  ["local", "Local JSONL générique coût 0 €"],
];

export default async function Home({ searchParams }: { searchParams?: Promise<{ error?: string; project?: string }> }) {
  seedDefaultProviders(DB_PATH);
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) return <AuthScreen error={params?.error} />;

  const selectedProjectId = params?.project ? Number(params.project) : undefined;
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId);
  const collectorHealth = getUsageCollectorHealth(DB_PATH, user.id, USAGE_INBOX_DIR);
  const collectorPreview = previewUsageInbox(USAGE_INBOX_DIR);
  const savedReports = listSavedUsageReports(USAGE_REPORTS_DIR);
  const selectedProject = data.selectedProject;
  const apiSetups = data.projectAiSetups.filter((s) => s.connectionType === "api");
  const categoryCounts = data.models.reduce<Record<string, number>>((acc, model) => { acc[model.category] = (acc[model.category] || 0) + 1; return acc; }, {});
  const stats = [
    ["Projets", String(data.projects.length), "isolés par utilisateur"],
    ["Comptes IA", String(data.aiAccounts.length), "abonnements/API/local"],
    ["Tokens estimés", data.usage.tokens.toLocaleString("fr-FR"), "texte ou logs collés"],
    ["Coût API estimé", euro(data.usage.cost), "hors abonnements"],
  ];

  return <main className="shell">
    <section className="hero"><div><p className="eyebrow">Connecté : {user.email}</p><h1>TorquePilot AI Conso</h1><p className="subtitle">Tableau de bord simplifié : 1) projet, 2) compte IA ou abonnement, 3) modèle associé, 4) import local sans clé API.</p></div><form action={logoutAction}><button className="ghost">Déconnexion</button></form></section>
    {params?.error && <p className="alert">{params.error}</p>}
    <section className="grid stats">{stats.map(([label, value, hint]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</section>

    <section className="layout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Espace projet</p><h2>{selectedProject ? selectedProject.name : "Aucun projet"}</h2></div>{selectedProject && <span className="pill">API {euro(data.projectUsage.cost)} · Abos {euro(data.projectUsage.subscriptionMonthly)}/mois</span>}</div>
        <form action={createProjectAction} className="inlineForm"><input name="name" placeholder="Nom projet ex: TorquePilot RAG" required /><input name="description" placeholder="Description" /><button>Ajouter projet</button></form>
        <div className="projectTabs">{data.projects.length ? data.projects.map((p) => p.id === selectedProject?.id
          ? <details className="tab active editable" key={p.id}>
              <summary><div><strong>{p.name}</strong><small>{p.description || "Sans description"}</small></div></summary>
              <form action={updateProjectAction} className="usageForm miniForm">
                <input type="hidden" name="projectId" value={p.id} />
                <label>Nom<input name="name" defaultValue={p.name} required /></label>
                <label>Description<input name="description" defaultValue={p.description ?? ""} /></label>
                <button>Enregistrer les modifications</button>
              </form>
              <form action={deleteProjectAction} className="dangerForm">
                <input type="hidden" name="projectId" value={p.id} />
                <button className="danger">Supprimer ce projet</button>
                <small>Supprime les affectations IA et l'historique d'usage.</small>
              </form>
            </details>
          : <a className="tab" href={`/?project=${p.id}`} key={p.id}><strong>{p.name}</strong><small>{p.description || "Sans description"}</small></a>
        ) : <p className="muted">Dashboard vierge : ajoute ton premier projet.</p>}</div>
      </article>
      <aside className="panel"><h2>Catalogue IA automatique</h2><p className="muted">Catalogue local : {data.models.length} modèles · {Object.entries(categoryCounts).map(([cat, count]) => `${categoryLabel(cat)} ${count}`).join(" · ")}</p><ul className="tasks">{data.models.slice(0, 14).map((m) => <li key={m.id}><span>{m.providerName} · {categoryLabel(m.category)}</span><strong>{m.name}</strong><small>{modelPriceDetail(m)}</small></li>)}</ul></aside>
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

      <aside className="panel"><h2>Comptes enregistrés</h2><p className="muted">Chaque carte peut être corrigée ou supprimée. Aucune clé API n’est affichée ni stockée ici.</p><div className="list">{data.aiAccounts.length ? data.aiAccounts.map((a) => <details className="row compact editable" key={a.id}><summary><div><h3>{a.name}</h3><p>{a.providerName || "Fournisseur"} · {connectionLabel(a.connectionType)}{a.subscriptionName ? ` · ${a.subscriptionName}` : ""}</p></div><span className="pill">{euro(a.monthlyCostEur)}/mois</span></summary><form action={updateAiAccountAction} className="usageForm miniForm"><input type="hidden" name="projectId" value={selectedProject?.id ?? ""} /><input type="hidden" name="accountId" value={a.id} /><label>Nom<input name="name" defaultValue={a.name} required /></label><label>Entreprise<select name="providerId" defaultValue={a.providerId ?? ""} required>{data.providers.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Type<select name="connectionType" defaultValue={a.connectionType}><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label><label>Nom abonnement<input name="subscriptionName" defaultValue={a.subscriptionName ?? ""} /></label><label>Coût mensuel €<input name="monthlyCostEur" type="number" min="0" step="0.01" defaultValue={a.monthlyCostEur} /></label><label>Notes<input name="notes" defaultValue={a.notes ?? ""} /></label><button>Modifier</button></form><form action={deleteAiAccountAction} className="dangerForm"><input type="hidden" name="projectId" value={selectedProject?.id ?? ""} /><input type="hidden" name="accountId" value={a.id} /><button className="danger">Supprimer ce compte</button><small>Supprime aussi ses affectations projet.</small></form></details>) : <p className="muted">Aucun compte IA : ajoute ton abonnement ou ta connexion API.</p>}</div></aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Affectation projet</p><h2>Associer compte + modèle</h2></div></div>
        {selectedProject && data.aiAccounts.length ? <form action={assignAiSetupAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <label>Compte IA<select name="accountId" required>{data.aiAccounts.map((a) => <option value={a.id} key={a.id}>{a.name} — {connectionLabel(a.connectionType)}</option>)}</select></label>
          <label>Modèle<select name="modelId" required>{data.models.map((m) => <option value={m.id} key={m.id}>{m.providerName} — {m.name} · {categoryLabel(m.category)}</option>)}</select></label>
          <label>Type pour ce projet<select name="connectionType" defaultValue="subscription"><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label>
          <label>Libellé<input name="label" placeholder="Ex: Compte principal TorquePilot" /></label>
          <p className="muted">Les prix ne sont plus saisis manuellement : ils viennent automatiquement du catalogue local selon le modèle choisi.</p>
          <button>Affecter au projet</button>
        </form> : <p className="muted">Ajoute d’abord un projet et un compte IA.</p>}
      </article>
      <aside className="panel"><h2>IA affectées au projet</h2><p className="muted">Ouvre une carte pour changer le compte, le modèle ou retirer l’association.</p><div className="list">{data.projectAiSetups.length ? data.projectAiSetups.map((s) => <details className="row compact editable" key={s.id}><summary><div><h3>{s.label}</h3><p>{s.accountName} · {s.providerName || "IA"} · {s.modelName || "Modèle"}</p><p>{connectionLabel(s.connectionType)} · Input {price(s.inputPricePerMillion)} · Output {price(s.outputPricePerMillion)}</p></div><span className="pill">{s.connectionType === "subscription" ? `${euro(s.monthlyCostEur)}/mois` : "estimable"}</span></summary>{selectedProject && <form action={updateAiSetupAction} className="usageForm miniForm"><input type="hidden" name="projectId" value={selectedProject.id} /><input type="hidden" name="setupId" value={s.id} /><label>Compte IA<select name="accountId" defaultValue={s.accountId} required>{data.aiAccounts.map((a) => <option value={a.id} key={a.id}>{a.name} — {connectionLabel(a.connectionType)}</option>)}</select></label><label>Modèle<select name="modelId" defaultValue={s.modelId ?? ""} required>{data.models.map((m) => <option value={m.id} key={m.id}>{m.providerName} — {m.name} · {categoryLabel(m.category)}</option>)}</select></label><label>Type<select name="connectionType" defaultValue={s.connectionType}><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label><label>Libellé<input name="label" defaultValue={s.label} /></label><button>Modifier l’affectation</button></form>}<form action={deleteAiSetupAction} className="dangerForm"><input type="hidden" name="projectId" value={selectedProject?.id ?? ""} /><input type="hidden" name="setupId" value={s.id} /><button className="danger">Retirer du projet</button><small>Ne supprime pas le compte IA, seulement son lien avec ce projet.</small></form></details>) : <p className="muted">Aucune IA affectée à ce projet.</p>}</div></aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Collecte automatique Phase 4C</p><h2>Connecteurs fournisseur/local</h2></div></div>
        {selectedProject && data.projectAiSetups.length ? <form action={importUsageAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <label>Configuration IA<select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label} — {connectionLabel(s.connectionType)}</option>)}</select></label>
          <label>Connecteur réel<select name="connector" defaultValue="generic">{connectorOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Source fichier/log<input name="sourceName" placeholder="Ex: usage-openai-2026-05-09.jsonl, ollama.log" defaultValue="Import connecteur" /></label>
          <label>Export JSON / JSONL / log local<textarea name="rawExport" placeholder={'OpenAI: {"id":"resp_...","created_at":1778323200,"usage":{"input_tokens":1200,"output_tokens":350}}\nAnthropic: {"id":"msg_...","usage":{"input_tokens":900,"output_tokens":240}}\nGemini: {"responseId":"...","usageMetadata":{"promptTokenCount":600,"candidatesTokenCount":250}}\nOllama: {"model":"llama3.1","prompt_eval_count":500,"eval_count":125}'} rows={9} required></textarea></label>
          <label>Date par défaut<input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <button>Importer via connecteur</button>
          <p className="muted">Sans clé API : on colle ou charge un export/log existant. Le connecteur normalise les champs fournisseur, calcule le coût API via le modèle affecté et force le coût à 0 € pour Ollama/local.</p>
        </form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
      </article>
      <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Collecteur local Phase 4I</p><h2>Import guidé</h2></div><span className="pill">{collectorPreview.totals.readyFiles ? `${collectorPreview.totals.readyFiles} prêt(s)` : "OK"}</span></div>
        <div className="grid stats"><article className="card"><span>Inbox</span><strong>{collectorHealth.pendingFiles}</strong><small>fichiers en attente</small></article><article className="card"><span>Détectés</span><strong>{collectorPreview.totals.detectedCount}</strong><small>{collectorPreview.totals.totalTokens.toLocaleString("fr-FR")} tokens</small></article><article className="card"><span>Erreurs</span><strong>{collectorPreview.totals.failedFiles}</strong><small>avant import</small></article></div>
        <p className="muted">Dépose tes fichiers dans <code>{collectorHealth.rootDir}</code>, sous <code>openai|anthropic|google|ollama|local|generic/inbox</code>. L’aperçu lit sans déplacer ; l’import archive ensuite vers processed/failed.</p>
        <details className="row compact"><summary><div><h3>Dossiers acceptés</h3><p>{collectorPreview.folders.join(" · ")}</p></div><span className="pill">JSON/JSONL/log/txt</span></summary><p className="muted">Aucune clé API demandée : uniquement fichiers ou logs locaux déjà présents sur le Lenovo.</p></details>
        <div className="list">{collectorPreview.files.length ? collectorPreview.files.map((file) => <div className="row compact" key={file.sourcePath}><div><h3>{file.connector} · {file.fileName}</h3><p>{file.status === "ready" ? `${file.detectedCount} ligne(s) · ${file.totalTokens.toLocaleString("fr-FR")} tok · ${fileSize(file.sizeBytes)}` : file.errorMessage}</p>{file.sampleLabels.length ? <small>{file.sampleLabels.join(" · ")}</small> : null}</div><span className="pill">{file.status === "ready" ? "Prêt" : "À corriger"}</span></div>) : <p className="muted">Aucun fichier dans inbox pour l’instant.</p>}</div>
        {selectedProject && data.projectAiSetups.length ? <form action={importInboxAction} className="inlineForm"><input type="hidden" name="projectId" value={selectedProject.id} /><select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label}</option>)}</select><input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /><button>Importer fichiers prêts</button></form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
        <div className="list">{collectorHealth.recentRuns.length ? collectorHealth.recentRuns.map((run) => <div className="row compact" key={run.id}><div><h3>{run.connector} · {run.status === "success" ? "OK" : "Erreur"}</h3><p>{run.sourcePath}</p>{run.errorMessage && <p className="alert">{run.errorMessage}</p>}</div><span className="pill">{run.importedCount} lignes</span></div>) : <p className="muted">Aucun run d’import dossier pour l’instant.</p>}</div>
      </aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Phase 4H</p><h2>Tendance consommation</h2></div>{data.usageCharts && <span className="pill">{data.usageCharts.totals.totalTokens.toLocaleString("fr-FR")} tok</span>}</div>
        {data.usageCharts && data.usageCharts.totals.entries ? <div className="chartStack">
          <div className="chartSummary"><div><span>Entrées</span><strong>{data.usageCharts.totals.entries}</strong></div><div><span>Input</span><strong>{data.usageCharts.totals.inputTokens.toLocaleString("fr-FR")}</strong></div><div><span>Output</span><strong>{data.usageCharts.totals.outputTokens.toLocaleString("fr-FR")}</strong></div><div><span>Coût</span><strong>{euro(data.usageCharts.totals.costEur)}</strong></div></div>
          <div className="barChart">{data.usageCharts.daily.map((day) => <div className="barRow" key={day.date}><span>{day.date}</span><div className="barTrack"><i style={{ width: percent(day.maxRatio) }}></i></div><strong>{day.totalTokens.toLocaleString("fr-FR")} tok</strong></div>)}</div>
        </div> : <p className="muted">Aucune donnée locale à afficher pour ce projet.</p>}
      </article>
      <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Répartition</p><h2>Top IA/modèles</h2></div></div>
        {data.usageCharts && data.usageCharts.totals.entries ? <div className="chartStack"><div>{data.usageCharts.topProviders.map((item) => <div className="miniBar" key={item.name}><div><strong>{item.name}</strong><span>{item.totalTokens.toLocaleString("fr-FR")} tok · {euro(item.costEur)}</span></div><div className="barTrack"><i style={{ width: percent(item.maxRatio) }}></i></div></div>)}</div><div>{data.usageCharts.topModels.map((item) => <div className="miniBar" key={item.name}><div><strong>{item.name}</strong><span>{item.totalTokens.toLocaleString("fr-FR")} tok</span></div><div className="barTrack"><i style={{ width: percent(item.maxRatio) }}></i></div></div>)}</div></div> : <p className="muted">Les agrégats se remplissent après import/estimation locale.</p>}
      </aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Rapport de consommation</p><h2>Historique automatique</h2></div>{selectedProject && <div className="reportActions"><a className="buttonLink" href={`/reports/usage?project=${selectedProject.id}&format=csv`}>Télécharger CSV</a><a className="buttonLink ghostLink" href={`/reports/usage?project=${selectedProject.id}&format=json`}>Sauvegarder JSON</a></div>}</div><p className="muted">Les boutons génèrent un rapport tokens depuis SQLite, le téléchargent et en conservent une copie serveur dans <code>data/usage-reports</code>.</p><div className="list">{data.usageEntries.length ? data.usageEntries.map((e) => <div className="row compact" key={e.id}><div><h3>{e.label}</h3><p>{e.providerName || "IA"} · {e.modelName || "Modèle"} · {e.usedAt}</p></div><span className="pill">{e.totalTokens.toLocaleString("fr-FR")} tok · {euro(e.costEur)}</span></div>) : <p className="muted">Aucun usage collecté pour ce projet.</p>}</div></article>
      <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Phase 4G</p><h2>Rapports sauvegardés</h2></div><span className="pill">{savedReports.length}</span></div><p className="muted">Retrouve les exports déjà générés, avec téléchargement direct et suppression côté serveur.</p><div className="list">{savedReports.length ? savedReports.map((report) => <div className="row compact reportRow" key={report.fileName}><div><h3>{report.format.toUpperCase()} · {fileSize(report.sizeBytes)}</h3><p>{shortDate(report.createdAt)}</p><small>{report.fileName}</small></div><div className="reportActions reportRowActions"><a className="buttonLink ghostLink" href={`/reports/saved?file=${encodeURIComponent(report.fileName)}`}>Télécharger</a><form action={deleteSavedReportAction}><input type="hidden" name="projectId" value={selectedProject?.id ?? ""} /><input type="hidden" name="fileName" value={report.fileName} /><button className="danger">Supprimer</button></form></div></div>) : <p className="muted">Aucun rapport sauvegardé. Génère d’abord un CSV ou JSON.</p>}</div></aside>
    </section>

    <section className="layout usageLayout">
      <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Fallback temporaire</p><h2>Conversation isolée</h2></div></div>
        {selectedProject && data.projectAiSetups.length ? <form action={estimateUsageAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <label>Configuration IA<select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label} — {connectionLabel(s.connectionType)}</option>)}</select></label>
          <label>Libellé<input name="label" placeholder="Ex: session debug, génération contenu" required /></label>
          <label>Texte entrée<textarea name="inputText" placeholder="Prompt/log entrée : tokens et coût seront calculés automatiquement" rows={4}></textarea></label>
          <label>Texte sortie<textarea name="outputText" placeholder="Réponse/log sortie : aucune saisie manuelle de tokens/coût" rows={4}></textarea></label>
          <label>Date<input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <button>Estimer depuis texte</button>
          {!apiSetups.length && <p className="muted">Pour un abonnement, les tokens seront estimés mais le coût par requête reste à 0 €. Le coût mensuel est suivi côté abonnement.</p>}
        </form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
      </aside>
    </section>

    <section className="layout usageLayout">
      <aside className="panel"><h2>Formats connecteurs</h2><ul className="tasks"><li><span>OpenAI</span><strong>Responses / ChatCompletions</strong><small>usage.input_tokens/output_tokens, prompt_tokens/completion_tokens, created_at epoch</small></li><li><span>Anthropic</span><strong>Claude Messages</strong><small>usage.input_tokens, usage.output_tokens, id msg_*</small></li><li><span>Google</span><strong>Gemini usageMetadata</strong><small>promptTokenCount, candidatesTokenCount, responseId/createTime</small></li><li><span>Ollama/local</span><strong>Logs locaux coût 0 €</strong><small>prompt_eval_count, eval_count, model, JSONL ligne par ligne</small></li></ul></aside>
    </section>
  </main>;
}
