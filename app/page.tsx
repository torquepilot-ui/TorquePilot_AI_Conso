import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DB_PATH, assignAiAccountToProject, createAiAccount, createProject, createUser, estimateProjectUsage, getUserById, listDashboardData, seedDefaultProviders, verifyUser } from "../lib/db";
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
  try { const user = createUser(DB_PATH, email, password); await setSession(user.id); } catch { redirect("/?error=Compte déjà existant ou saisie invalide"); }
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
  } catch { redirect(`/?project=${projectId || ""}&error=Compte IA refusé`); }
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
  } catch { redirect(`/?project=${projectId || ""}&error=Affectation IA refusée`); }
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
  } catch { redirect(`/?project=${projectId || ""}&error=Estimation refusée`); }
  redirect(`/?project=${projectId}`);
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

export default async function Home({ searchParams }: { searchParams?: Promise<{ error?: string; project?: string }> }) {
  seedDefaultProviders(DB_PATH);
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) return <AuthScreen error={params?.error} />;

  const selectedProjectId = params?.project ? Number(params.project) : undefined;
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId);
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
    <section className="hero"><div><p className="eyebrow">Connecté : {user.email}</p><h1>TorquePilot AI Conso</h1><p className="subtitle">Phase 4A : catalogue KIRO intégré, tarifs modèles automatiques et estimation sans saisie manuelle de tokens/coûts.</p></div><form action={logoutAction}><button className="ghost">Déconnexion</button></form></section>
    {params?.error && <p className="alert">{params.error}</p>}
    <section className="grid stats">{stats.map(([label, value, hint]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</section>

    <section className="layout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Espace projet</p><h2>{selectedProject ? selectedProject.name : "Aucun projet"}</h2></div>{selectedProject && <span className="pill">API {euro(data.projectUsage.cost)} · Abos {euro(data.projectUsage.subscriptionMonthly)}/mois</span>}</div>
        <form action={createProjectAction} className="inlineForm"><input name="name" placeholder="Nom projet ex: TorquePilot RAG" required /><input name="description" placeholder="Description" /><button>Ajouter projet</button></form>
        <div className="projectTabs">{data.projects.length ? data.projects.map((p) => <a className={selectedProject?.id === p.id ? "tab active" : "tab"} href={`/?project=${p.id}`} key={p.id}><strong>{p.name}</strong><small>{p.description || "Sans description"}</small></a>) : <p className="muted">Dashboard vierge : ajoute ton premier projet.</p>}</div>
      </article>
      <aside className="panel"><h2>Catalogue IA automatique</h2><p className="muted">KIRO v3.0 : {data.models.length} modèles · {Object.entries(categoryCounts).map(([cat, count]) => `${categoryLabel(cat)} ${count}`).join(" · ")}</p><ul className="tasks">{data.models.slice(0, 14).map((m) => <li key={m.id}><span>{m.providerName} · {categoryLabel(m.category)}</span><strong>{m.name}</strong><small>{modelPriceDetail(m)}</small></li>)}</ul></aside>
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

      <aside className="panel"><h2>Comptes enregistrés</h2><div className="list">{data.aiAccounts.length ? data.aiAccounts.map((a) => <div className="row compact" key={a.id}><div><h3>{a.name}</h3><p>{a.providerName || "Fournisseur"} · {connectionLabel(a.connectionType)}{a.subscriptionName ? ` · ${a.subscriptionName}` : ""}</p></div><span className="pill">{euro(a.monthlyCostEur)}/mois</span></div>) : <p className="muted">Aucun compte IA : ajoute ton abonnement ou ta connexion API.</p>}</div></aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Affectation projet</p><h2>Associer compte + modèle</h2></div></div>
        {selectedProject && data.aiAccounts.length ? <form action={assignAiSetupAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <label>Compte IA<select name="accountId" required>{data.aiAccounts.map((a) => <option value={a.id} key={a.id}>{a.name} — {connectionLabel(a.connectionType)}</option>)}</select></label>
          <label>Modèle<select name="modelId" required>{data.models.map((m) => <option value={m.id} key={m.id}>{m.providerName} — {m.name} · {categoryLabel(m.category)}</option>)}</select></label>
          <label>Type pour ce projet<select name="connectionType" defaultValue="subscription"><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label>
          <label>Libellé<input name="label" placeholder="Ex: Compte principal TorquePilot" /></label>
          <p className="muted">Les prix ne sont plus saisis manuellement : ils viennent automatiquement du catalogue KIRO/SQLite selon le modèle choisi.</p>
          <button>Affecter au projet</button>
        </form> : <p className="muted">Ajoute d’abord un projet et un compte IA.</p>}
      </article>
      <aside className="panel"><h2>IA affectées au projet</h2><div className="list">{data.projectAiSetups.length ? data.projectAiSetups.map((s) => <div className="row compact" key={s.id}><div><h3>{s.label}</h3><p>{s.accountName} · {s.providerName || "IA"} · {s.modelName || "Modèle"}</p><p>{connectionLabel(s.connectionType)} · Input {price(s.inputPricePerMillion)} · Output {price(s.outputPricePerMillion)}</p></div><span className="pill">{s.connectionType === "subscription" ? `${euro(s.monthlyCostEur)}/mois` : "estimable"}</span></div>) : <p className="muted">Aucune IA affectée à ce projet.</p>}</div></aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Estimation</p><h2>Texte → tokens/coût</h2></div></div>
        {selectedProject && data.projectAiSetups.length ? <form action={estimateUsageAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <label>Configuration IA<select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label} — {connectionLabel(s.connectionType)}</option>)}</select></label>
          <label>Libellé<input name="label" placeholder="Ex: session debug, génération contenu" required /></label>
          <label>Texte entrée<textarea name="inputText" placeholder="Colle le prompt/log entrée : tokens et coût seront calculés automatiquement" rows={5}></textarea></label>
          <label>Texte sortie<textarea name="outputText" placeholder="Colle la réponse/log sortie : aucune saisie manuelle de tokens/coût" rows={5}></textarea></label>
          <label>Date<input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <button>Estimer tokens et coût</button>
          {!apiSetups.length && <p className="muted">Pour un abonnement, les tokens seront estimés mais le coût par requête reste à 0 €. Le coût mensuel est suivi côté abonnement.</p>}
        </form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
      </article>
      <aside className="panel"><h2>Historique estimations</h2><div className="list">{data.usageEntries.length ? data.usageEntries.map((e) => <div className="row compact" key={e.id}><div><h3>{e.label}</h3><p>{e.providerName || "IA"} · {e.modelName || "Modèle"} · {e.usedAt}</p></div><span className="pill">{e.totalTokens.toLocaleString("fr-FR")} tok · {euro(e.costEur)}</span></div>) : <p className="muted">Aucune estimation saisie pour ce projet.</p>}</div></aside>
    </section>
  </main>;
}
