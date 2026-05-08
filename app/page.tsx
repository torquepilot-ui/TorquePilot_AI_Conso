import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DB_PATH, createProject, createUser, getUserById, listDashboardData, seedDefaultProviders, verifyUser } from "../lib/db";
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
  const user = createUser(DB_PATH, email, password);
  await setSession(user.id);
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
  if (name) createProject(DB_PATH, userId, name, description);
  revalidatePath("/");
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

export default async function Home({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  seedDefaultProviders(DB_PATH);
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) return <AuthScreen error={params?.error} />;
  const data = listDashboardData(DB_PATH, user.id);
  const stats = [
    ["Projets", String(data.projects.length), "isolés par utilisateur"],
    ["Fournisseurs IA", String(data.providers.length), "manuel MVP"],
    ["Tokens saisis", data.usage.tokens.toLocaleString("fr-FR"), "à connecter plus tard"],
    ["Coût estimé", `${data.usage.cost.toFixed(2)} €`, "manuel"],
  ];
  return <main className="shell">
    <section className="hero"><div><p className="eyebrow">Connecté : {user.email}</p><h1>TorquePilot AI Conso</h1><p className="subtitle">MVP local : projets privés, fournisseurs IA et consommation manuelle.</p></div><form action={logoutAction}><button className="ghost">Déconnexion</button></form></section>
    <section className="grid stats">{stats.map(([label, value, hint]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</section>
    <section className="layout">
      <article className="panel"><h2>Projets</h2><form action={createProjectAction} className="inlineForm"><input name="name" placeholder="Nom projet ex: BEES Lab" required /><input name="description" placeholder="Description" /><button>Ajouter</button></form><div className="list">{data.projects.length ? data.projects.map((p) => <div className="row" key={p.id}><div><h3>{p.name}</h3><p>{p.description || "Sans description"}</p></div><span className="pill">privé</span></div>) : <p className="muted">Dashboard vierge : ajoute ton premier projet.</p>}</div></article>
      <aside className="panel"><h2>Fournisseurs IA</h2><ul className="tasks">{data.providers.map((p) => <li key={p.id}>{p.name}</li>)}</ul></aside>
    </section>
  </main>;
}
