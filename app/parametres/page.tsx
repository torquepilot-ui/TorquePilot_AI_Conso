import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId } from "../actions";
import { DB_PATH, getUserById, listDashboardData } from "../../lib/db";
import { buildDashboardSectionSummary, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ParametresPage() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");
  const data = listDashboardData(DB_PATH, user.id);
  const fallback = readHermesFallbackState();
  const summary = buildDashboardSectionSummary(data, fallback);

  return <DashboardSectionPage userEmail={user.email} eyebrow="Configuration" title="Paramètres" description="Préférences visibles et non sensibles : seuils, devise, prix modèles et UX dashboard." cards={[
    { title: "24h", body: "fenêtre actuelle fallback récent", status: "Fenêtre" },
    { title: ">10", body: "seuil alerte fallback fréquent", status: "Seuil" },
    { title: "EUR", body: "devise d’affichage dashboard", status: "Devise" },
  ]}>
    <section className="layout usageLayout">
      <article className="panel"><p className="eyebrow">Seuils actifs</p><h2>Alertes dashboard</h2><ul className="tasks"><li><span>Fallback fréquent</span><strong>{summary.alerts.recentFallback} / {summary.alerts.fallbackWindowHours}h</strong><small>Alerte active si strictement supérieur à 10.</small></li><li><span>Fraîcheur JSON</span><strong>{summary.alerts.freshnessLabel}</strong><small>Stale si le JSON fallback dépasse environ 90 secondes.</small></li></ul></article>
      <aside className="panel"><p className="eyebrow">Règles sécurité</p><h2>Secrets interdits</h2><p className="muted">Cette section ne stocke ni n’affiche aucune clé API, token OAuth, refresh token, mot de passe ou credential. Les paramètres sensibles restent hors UI.</p></aside>
    </section>
  </DashboardSectionPage>;
}
