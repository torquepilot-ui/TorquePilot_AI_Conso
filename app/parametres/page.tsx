import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId } from "../actions";
import { DB_PATH, getUserById, getMonthlyKpi } from "../../lib/db";
import { auth } from "../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function eur(n: number) {
  return n === 0 ? "0,00 €" : n < 0.01 ? `${n.toFixed(4)} €` : `${n.toFixed(2)} €`;
}

export default async function ParametresPage() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");

  const session = await auth();
  const googleUser = session?.user;

  const budget = Math.max(1, Number(process.env.BUDGET_MENSUEL_EUR ?? 150));
  const kpi = getMonthlyKpi(DB_PATH, user.id);
  const budgetPct = Math.min(100, (kpi.currentMonthCost / budget) * 100);
  const remaining = Math.max(0, budget - kpi.currentMonthCost);

  return <DashboardSectionPage
    userEmail={user.email}
    eyebrow="Configuration"
    title="Paramètres"
    description="Profil Google, seuil budget mensuel et préférences du dashboard."
    cards={[
      { title: eur(budget), body: "budget mensuel IA configuré", status: "Budget" },
      { title: `${budgetPct.toFixed(0)} %`, body: "du budget consommé ce mois", status: "Avancement" },
      { title: eur(remaining), body: "budget restant estimé", status: "Restant" },
    ]}
  >

    <section className="layout usageLayout">
      <article className="panel">
        <p className="eyebrow">Compte connecté</p>
        <h2>Profil Google</h2>
        <div className="profileCard">
          {googleUser?.image && (
            <img src={googleUser.image} alt="avatar" className="profileAvatar" referrerPolicy="no-referrer" />
          )}
          <div className="profileInfo">
            <strong>{googleUser?.name ?? user.email}</strong>
            <span>{user.email}</span>
            <span className="pill" style={{ marginTop: "8px", display: "inline-block" }}>Auth Gmail ✓</span>
          </div>
        </div>
        <p className="muted" style={{ marginTop: "16px" }}>
          Authentification OAuth Google. Aucun mot de passe local stocké.
        </p>
      </article>

      <aside className="panel">
        <p className="eyebrow">Budget mensuel IA</p>
        <h2>Seuil d&apos;alerte</h2>
        <div className="budgetSettingDisplay">
          <div className="budgetSettingValue">
            <span>Configuré via <code>BUDGET_MENSUEL_EUR</code></span>
            <strong>{eur(budget)}</strong>
            <small>défini dans .env.local</small>
          </div>
          <div className="budgetGaugeTrack" style={{ marginTop: "12px" }}>
            <div
              className={`budgetGaugeFill${budgetPct >= 100 ? " gaugeCritical" : budgetPct >= 80 ? " gaugeWarn" : " gaugeOk"}`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
            <small className="muted">{eur(kpi.currentMonthCost)} consommé</small>
            <small className="muted">{budgetPct.toFixed(0)} %</small>
          </div>
        </div>
        <p className="muted" style={{ marginTop: "12px" }}>
          Pour modifier le seuil, change <code>BUDGET_MENSUEL_EUR</code> dans <code>.env.local</code> et redémarre le serveur.
        </p>
      </aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel">
        <p className="eyebrow">Règles sécurité</p>
        <h2>Données sensibles</h2>
        <ul className="tasks">
          <li><span>Clés API</span><strong>Non stockées</strong><small>Aucune clé API n'est affichée ni persistée dans ce dashboard.</small></li>
          <li><span>Session</span><strong>JWT NextAuth</strong><small>Session gérée par NextAuth v5 avec JWT signé côté serveur.</small></li>
          <li><span>Fallback JSON</span><strong>Redacted</strong><small>Le fichier d'état public ne contient aucun secret ni payload brut.</small></li>
        </ul>
      </article>

      <aside className="panel">
        <p className="eyebrow">Informations techniques</p>
        <h2>Environnement</h2>
        <ul className="tasks">
          <li><span>Framework</span><strong>Next.js 16 App Router</strong><small>Rendu serveur, Server Actions, middleware Edge.</small></li>
          <li><span>Base de données</span><strong>SQLite local</strong><small>Stockage dans <code>data/torquepilot.sqlite</code>.</small></li>
          <li><span>Auth</span><strong>NextAuth v5 — Google OAuth</strong><small>Provider Google, stratégie JWT, pas d'adapter DB.</small></li>
        </ul>
      </aside>
    </section>

  </DashboardSectionPage>;
}
