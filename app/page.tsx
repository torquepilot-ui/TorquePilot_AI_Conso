import { redirect } from "next/navigation";
import { DB_PATH, getUserById, getMonthlyKpi } from "../lib/db";
import { auth } from "../lib/auth";
import { currentUserId } from "./actions";
import DashboardShell from "../components/DashboardShell";
import LandingPage from "../components/LandingPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function eur(n: number) {
  if (n === 0) return "0,00 €";
  if (n < 0.01) return `${n.toFixed(4)} €`;
  return `${n.toFixed(2)} €`;
}

function monthLabel() {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default async function Home() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) {
    return <LandingPage />;
  }

  const session = await auth();
  const googleUser = session?.user;

  const budget = Math.max(1, Number(process.env.BUDGET_MENSUEL_EUR ?? 150));
  const kpi = getMonthlyKpi(DB_PATH, user.id);
  const { currentMonthCost, prevMonthCost, currentMonthTokens } = kpi;

  const hasPrev = prevMonthCost > 0;
  const deltaRaw = hasPrev ? ((currentMonthCost - prevMonthCost) / prevMonthCost) * 100 : null;
  const deltaUp = deltaRaw !== null && deltaRaw > 0;
  const deltaDown = deltaRaw !== null && deltaRaw < 0;

  const budgetPct = Math.min(100, (currentMonthCost / budget) * 100);
  const remaining = Math.max(0, budget - currentMonthCost);

  const statusClass = budgetPct >= 100 ? "statusCritical" : budgetPct >= 80 ? "statusWarn" : "statusOk";
  const statusDot = budgetPct >= 100 ? "🔴" : budgetPct >= 80 ? "🟠" : "🟢";
  const statusLabel = budgetPct >= 100 ? "Dépassé" : budgetPct >= 80 ? "Attention" : "OK";

  const hasData = currentMonthCost > 0 || currentMonthTokens > 0;
  const displayName = googleUser?.name ?? user.email.split("@")[0];

  return <DashboardShell
    userEmail={user.email}
    googleImage={googleUser?.image ?? undefined}
    googleName={googleUser?.name ?? undefined}
  >
    <main className="shell dashboardContent">

      <section className="homeHero">
        <div>
          <p className="eyebrow">Bonjour {displayName}</p>
          <h1>TorquePilot AI</h1>
          <p className="subtitle">Pilotage coûts IA — {monthLabel()}</p>
        </div>
        <span className={`statusBadge ${statusClass}`}>{statusDot} {statusLabel}</span>
      </section>

      <section className="kpiGrid">
        <article className="kpiCard">
          <span className="kpiLabel">Coût IA du mois</span>
          <strong className="kpiValue">{eur(currentMonthCost)}</strong>
          <span className="kpiSub">
            {currentMonthTokens.toLocaleString("fr-FR")} tokens · {monthLabel()}
          </span>
          {!hasData && <p className="kpiHint">Importe tes logs dans COLLECTE pour démarrer</p>}
        </article>

        <article className={`kpiCard${deltaUp ? " kpiCardDanger" : deltaDown ? " kpiCardSuccess" : ""}`}>
          <span className="kpiLabel">Écart vs mois dernier</span>
          <strong className={`kpiValue${deltaUp ? " kpiDanger" : deltaDown ? " kpiSuccess" : " kpiNeutral"}`}>
            {deltaRaw === null
              ? "—"
              : `${deltaUp ? "↑" : "↓"} ${Math.abs(deltaRaw).toFixed(1)} %`}
          </strong>
          <span className="kpiSub">
            {hasPrev ? `${eur(prevMonthCost)} mois précédent` : "Aucun historique disponible"}
          </span>
        </article>

        <article className="kpiCard">
          <span className="kpiLabel">Budget restant</span>
          <strong className={`kpiValue${budgetPct >= 100 ? " kpiDanger" : budgetPct >= 80 ? " kpiWarn" : " kpiSuccess"}`}>
            {eur(remaining)}
          </strong>
          <span className="kpiSub">{eur(currentMonthCost)} / {eur(budget)} budgété</span>
          <div className="budgetGaugeTrack" aria-label={`${budgetPct.toFixed(0)}% du budget consommé`}>
            <div
              className={`budgetGaugeFill${budgetPct >= 100 ? " gaugeCritical" : budgetPct >= 80 ? " gaugeWarn" : " gaugeOk"}`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
          <span className="kpiSub">{budgetPct.toFixed(0)} % consommé</span>
        </article>
      </section>

      {!hasData && (
        <section className="panel emptyHomeState">
          <p className="eyebrow">Démarrage</p>
          <h2>En attente de données</h2>
          <p className="muted">
            Tes KPIs se rempliront dès que tu auras importé des logs dans{" "}
            <a href="/collecte" className="accentLink">COLLECTE</a>.
            Les 3 cartes ci-dessus se mettent à jour automatiquement.
          </p>
        </section>
      )}

      <section className="quickNavGrid">
        <a href="/consommation" className="quickNavCard">
          <span>📊</span>
          <strong>Consommation</strong>
          <small>Tokens &amp; coûts détaillés</small>
        </a>
        <a href="/collecte" className="quickNavCard">
          <span>📥</span>
          <strong>Collecte</strong>
          <small>Importer des logs</small>
        </a>
        <a href="/alertes" className="quickNavCard">
          <span>🔔</span>
          <strong>Alertes</strong>
          <small>Surveillance budget</small>
        </a>
        <a href="/projets" className="quickNavCard">
          <span>📁</span>
          <strong>Projets</strong>
          <small>Gérer vos projets</small>
        </a>
      </section>

    </main>
  </DashboardShell>;
}
