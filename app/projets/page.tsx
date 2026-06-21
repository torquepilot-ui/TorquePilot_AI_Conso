import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { createProjectAction, currentUserId, deleteProjectAction, updateProjectAction } from "../actions";
import { DB_PATH, getUserById, listDashboardData } from "../../lib/db";
import { buildDashboardSectionSummary, euro, integer, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjetsPage() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");
  const data = listDashboardData(DB_PATH, user.id);
  const summary = buildDashboardSectionSummary(data, readHermesFallbackState());

  return <DashboardSectionPage userEmail={user.email} eyebrow="Pilotage" title="Projets" description="Espace dédié à la création, sélection et gouvernance des projets suivis par TorquePilot AI Conso." cards={[
    { title: String(summary.projects.total), body: "projets accessibles", status: "Portefeuille" },
    { title: summary.projects.selected, body: "projet actif par défaut", status: "Sélection" },
    { title: euro(summary.projects.usageCost), body: `${integer(summary.projects.usageTokens)} tokens projet`, status: "Coût projet" },
  ]}>
    <section className="layout usageLayout">
      <article className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Liste projets</p><h2>Portefeuille local</h2></div><span className="pill">{data.projects.length}</span></div>
        <div className="list">{data.projects.map((project) => <div className="row compact" key={project.id}><div><h3>{project.name}</h3><p>{project.description || "Sans description"}</p></div><a className="buttonLink ghostLink" href={`/?project=${project.id}`}>Ouvrir dans HOME</a></div>)}{!data.projects.length && <p className="muted">Aucun projet créé.</p>}</div>
      </article>
      <aside className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Nouveau projet</p><h2>Créer</h2></div><span className="pill">Action locale</span></div>
        <form action={createProjectAction} className="usageForm">
          <label>Nom<input name="name" placeholder="Ex: TorquePilot RAG" required /></label>
          <label>Description<textarea name="description" rows={4} placeholder="Objectif, périmètre, notes…"></textarea></label>
          <button>Créer le projet</button>
        </form>
      </aside>
    </section>

    <section className="panel">
      <div className="sectionHeader"><div><p className="eyebrow">Gestion avancée</p><h2>Modifier ou supprimer</h2></div><span className="pill">Projet</span></div>
      <p className="muted">Les actions d’administration restent disponibles ici, hors HOME, pour garder l’accueil lisible.</p>
      <div className="list">{data.projects.map((project) => <div className="row compact reportRow" key={`edit-${project.id}`}>
        <form action={updateProjectAction} className="inlineForm">
          <input type="hidden" name="projectId" value={project.id} />
          <input name="name" defaultValue={project.name} required />
          <input name="description" defaultValue={project.description || ""} placeholder="Description" />
          <button>Modifier</button>
        </form>
        <form action={deleteProjectAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <button className="danger">Supprimer</button>
        </form>
      </div>)}{!data.projects.length && <p className="muted">Aucun projet à modifier.</p>}</div>
    </section>
  </DashboardSectionPage>;
}
