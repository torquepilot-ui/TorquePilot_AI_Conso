import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId } from "../actions";
import { DB_PATH, getUserById, listDashboardData } from "../../lib/db";
import { buildDashboardSectionSummary, integer, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LogsPage() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");
  const data = listDashboardData(DB_PATH, user.id);
  const fallback = readHermesFallbackState();
  const summary = buildDashboardSectionSummary(data, fallback);

  return <DashboardSectionPage userEmail={user.email} eyebrow="Observabilité" title="Logs" description="Journal technique redacted : fallback, provider, imports et diagnostics exploitables." cards={[
    { title: String(summary.logs.fallbackEvents), body: "événements fallback total", status: "Fallback" },
    { title: String(summary.logs.recentFallbackEvents), body: "événements fallback récents", status: "24h" },
    { title: String(summary.logs.totalUsageEntries), body: "entrées d’usage disponibles", status: "Usage" },
  ]}>
    <section className="layout usageLayout">
      <article className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Dernier événement provider</p><h2>{summary.logs.lastEventType}</h2></div><span className="pill">{fallback.status}</span></div>
        <p className="muted">Provider actif : <strong>{fallback.activeProvider}</strong> · modèle : <strong>{fallback.activeModel}</strong>. Source : {fallback.lastEventSource || "non disponible"}.</p>
      </article>
      <aside className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Sécurité logs</p><h2>Redaction</h2></div><span className="pill">{fallback.safety?.redacted === false ? "à vérifier" : "OK"}</span></div>
        <p className="muted">Cette page affiche uniquement des métadonnées. Aucun payload de message ni secret n’est exposé.</p>
      </aside>
    </section>
    <section className="panel usageLayout">
      <div className="sectionHeader"><div><p className="eyebrow">Usage récent</p><h2>Derniers imports</h2></div><span className="pill">{data.usageEntries.length}</span></div>
      <div className="list">{data.usageEntries.slice(0, 10).map((entry) => <div className="row compact" key={entry.id}><div><h3>{entry.label}</h3><p>{entry.projectName} · {entry.usedAt}</p></div><span className="pill">{integer(entry.totalTokens)} tok</span></div>)}{!data.usageEntries.length && <p className="muted">Aucun log usage enregistré.</p>}</div>
    </section>
  </DashboardSectionPage>;
}
