import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DB_PATH, createProject, createUser, getUserById, listDashboardData, recordUsageEntry, seedDefaultProviders, verifyUser } from "../lib/db";
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
  try {
    const user = createUser(DB_PATH, email, password);
    await setSession(user.id);
  } catch {
    redirect("/?error=Compte déjà existant ou saisie invalide");
  }
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
  if (name) {
    const project = createProject(DB_PATH, userId, name, description);
    revalidatePath("/");
    redirect(`/?project=${project.id}`);
  }
  redirect("/");
}

async function recordUsageAction(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  const modelId = Number(formData.get("modelId") || 0) || null;
  try {
    recordUsageEntry(DB_PATH, userId, {
      projectId,
      modelId,
      label: String(formData.get("label") || "Saisie manuelle"),
      inputTokens: Number(formData.get("inputTokens") || 0),
      outputTokens: Number(formData.get("outputTokens") || 0),
      costEur: Number(formData.get("costEur") || 0),
      usedAt: String(formData.get("usedAt") || ""),
    });
    revalidatePath("/");
  } catch {
    redirect(`/?project=${projectId || ""}&error=Saisie consommation refusée`);
  }
  redirect(`/?project=${projectId}`);
}

function AuthScreen({ error }: { error?: string }) {
  return <main className="shell">
    <section className="hero"><div><p className="eyebrow">Dashboard local sécurisé</p><h1>TorquePilot AI Conso</h1><p className="subtitle">Crée ton compte local puis pilote projets, fournisseurs IA et consommation manuelle.</p></div><div className="badge">MVP auth</div></section>
    {error && <p className="alert">{error}</p>}
    <section className="authGrid">
      <form action={registerAction} className="panel form"><h2>Inscription</h2><input name="email" type="email" placeholder="torquepilot34@gmail.com" required /><input name="password" type="password" placeholder="Mot de passe local" minLength={8} required /><button>Créer le compte</button></form>
      <form action={loginAction} className="panel form"><h2>Connexion</h2><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Mot de passe" required /><button>Entrer</button></form>
    </section>
  </main>;
}

function euro(value: number) {
  return `${value.toFixed(4)} €`;
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ error?: string; project?: string }> }) {
  seedDefaultProviders(DB_PATH);
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) return <AuthScreen error={params?.error} />;

  const selectedProjectId = params?.project ? Number(params.project) : undefined;
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId);
  const selectedProject = data.selectedProject;
  const stats = [
    ["Projets", String(data.projects.length), "isolés par utilisateur"],
    ["Modèles IA", String(data.models.length), "catalogue manuel"],
    ["Tokens total", data.usage.tokens.toLocaleString("fr-FR"), "tous projets"],
    ["Coût total", euro(data.usage.cost), "saisie manuelle"],
  ];

  return <main className="shell">
    <section className="hero"><div><p className="eyebrow">Connecté : {user.email}</p><h1>TorquePilot AI Conso</h1><p className="subtitle">Phase 2 : projets sélectionnables, modèles IA et suivi manuel de consommation.</p></div><form action={logoutAction}><button className="ghost">Déconnexion</button></form></section>
    {params?.error && <p className="alert">{params.error}</p>}
    <section className="grid stats">{stats.map(([label, value, hint]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</section>

    <section className="layout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Espace projet</p><h2>{selectedProject ? selectedProject.name : "Aucun projet"}</h2></div>{selectedProject && <span className="pill">{data.projectUsage.tokens.toLocaleString("fr-FR")} tokens · {euro(data.projectUsage.cost)}</span>}</div>
        <form action={createProjectAction} className="inlineForm"><input name="name" placeholder="Nom projet ex: TorquePilot RAG" required /><input name="description" placeholder="Description" /><button>Ajouter projet</button></form>
        <div className="projectTabs">{data.projects.length ? data.projects.map((p) => <a className={selectedProject?.id === p.id ? "tab active" : "tab"} href={`/?project=${p.id}`} key={p.id}><strong>{p.name}</strong><small>{p.description || "Sans description"}</small></a>) : <p className="muted">Dashboard vierge : ajoute ton premier projet.</p>}</div>
      </article>

      <aside className="panel"><h2>Modèles IA</h2><ul className="tasks">{data.models.slice(0, 12).map((m) => <li key={m.id}><span>{m.providerName}</span><strong>{m.name}</strong></li>)}</ul></aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Consommation</p><h2>Saisie manuelle</h2></div></div>
        {selectedProject ? <form action={recordUsageAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <label>Libellé<input name="label" placeholder="Ex: Session debug Dashboard" required /></label>
          <label>Modèle<select name="modelId" required>{data.models.map((m) => <option value={m.id} key={m.id}>{m.providerName} — {m.name}</option>)}</select></label>
          <label>Tokens entrée<input name="inputTokens" type="number" min="0" step="1" defaultValue="0" /></label>
          <label>Tokens sortie<input name="outputTokens" type="number" min="0" step="1" defaultValue="0" /></label>
          <label>Coût €<input name="costEur" type="number" min="0" step="0.000001" defaultValue="0" /></label>
          <label>Date<input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <button>Enregistrer la conso</button>
        </form> : <p className="muted">Ajoute d’abord un projet pour saisir une consommation IA.</p>}
      </article>

      <aside className="panel"><h2>Historique projet</h2><div className="list">{data.usageEntries.length ? data.usageEntries.map((e) => <div className="row compact" key={e.id}><div><h3>{e.label}</h3><p>{e.providerName || "IA"} · {e.modelName || "Modèle manuel"} · {e.usedAt}</p></div><span className="pill">{e.totalTokens.toLocaleString("fr-FR")} tok · {euro(e.costEur)}</span></div>) : <p className="muted">Aucune consommation saisie pour ce projet.</p>}</div></aside>
    </section>
  </main>;
}
