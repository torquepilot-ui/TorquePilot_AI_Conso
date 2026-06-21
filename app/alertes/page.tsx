import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId } from "../actions";
import { DB_PATH, getUserById, listDashboardData } from "../../lib/db";
import { buildDashboardSectionSummary, euro, integer, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AlertSeverity = "ok" | "watch" | "critical";
type AlertRule = { label: string; active: boolean; detail: string; severity: AlertSeverity; action: string };

function severityLabel(severity: AlertSeverity) {
  if (severity === "critical") return "Critique";
  if (severity === "watch") return "À surveiller";
  return "OK";
}

function severityScore(severity: AlertSeverity) {
  if (severity === "critical") return 3;
  if (severity === "watch") return 2;
  return 1;
}

function activeSeverityClass(severity: AlertSeverity) {
  return severity === "ok" ? "" : severity === "critical" ? "alertRowCritical" : "alertRowActive";
}

export default async function AlertesPage() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");

  const data = listDashboardData(DB_PATH, user.id);
  const fallback = readHermesFallbackState();
  const summary = buildDashboardSectionSummary(data, fallback);
  const chartTotals = data.usageCharts?.totals;
  const selectedTokens = chartTotals?.totalTokens ?? summary.consumption.selectedProjectTokens;
  const selectedCost = chartTotals?.costEur ?? summary.consumption.selectedProjectCost;
  const subscriptionMonthly = summary.projects.subscriptionMonthly;
  const dailyPeak = data.usageCharts?.daily.reduce((max, point) => Math.max(max, point.totalTokens), 0) ?? 0;
  const topProvider = data.usageCharts?.topProviders[0];
  const estimatedVisibleCost = data.usageEntries.reduce((sum, entry) => sum + entry.estimatedCostEur, 0);
  const recordedVisibleCost = data.usageEntries.reduce((sum, entry) => sum + entry.costEur, 0);
  const unpricedVisibleRows = data.usageEntries.filter((entry) => entry.costEur === 0 && entry.estimatedCostEur === 0 && entry.totalTokens > 0).length;
  const activeAlertCount = [summary.alerts.fallbackFrequent, summary.alerts.staleFallbackJson, summary.alerts.containsSecrets, unpricedVisibleRows > 0].filter(Boolean).length;

  const alerts = ([
    {
      label: "Fallback fréquent",
      active: summary.alerts.fallbackFrequent,
      detail: `${summary.alerts.recentFallback} événements sur ${summary.alerts.fallbackWindowHours}h`,
      severity: summary.alerts.fallbackFrequent ? "watch" : "ok",
      action: summary.alerts.fallbackFrequent ? "Contrôler le provider principal et garder le fallback prêt." : "Rien à faire : fréquence normale.",
    },
    {
      label: "Fraîcheur JSON fallback",
      active: summary.alerts.staleFallbackJson,
      detail: `Dernière génération : ${summary.alerts.freshnessLabel}`,
      severity: summary.alerts.staleFallbackJson ? "watch" : "ok",
      action: summary.alerts.staleFallbackJson ? "Relancer le collecteur d’état si le dashboard doit être live." : "État provider récent.",
    },
    {
      label: "Secrets dans état public",
      active: summary.alerts.containsSecrets,
      detail: "Scan logique du JSON fallback public",
      severity: summary.alerts.containsSecrets ? "critical" : "ok",
      action: summary.alerts.containsSecrets ? "Bloquer la publication et régénérer un JSON redacted." : "Aucun secret détecté dans l’état exposé.",
    },
    {
      label: "Lignes non valorisées",
      active: unpricedVisibleRows > 0,
      detail: `${integer(unpricedVisibleRows)} lignes visibles avec tokens mais sans coût réel/estimé`,
      severity: unpricedVisibleRows > 0 ? "watch" : "ok",
      action: unpricedVisibleRows > 0 ? "Affecter un modèle/pricing ou marquer explicitement en local gratuit." : "Valorisation cohérente sur les lignes visibles.",
    },
  ] satisfies AlertRule[]).sort((a, b) => severityScore(b.severity) - severityScore(a.severity));

  const healthItems = [
    { label: "Provider actif", value: fallback.activeProvider, hint: fallback.fallbackActive ? "Fallback en cours" : "Principal actif" },
    { label: "Modèle actif", value: fallback.activeModel, hint: fallback.lastEventType ?? "event inconnu" },
    { label: "Projet surveillé", value: summary.projects.selected, hint: `${integer(selectedTokens)} tokens suivis` },
    { label: "Top provider", value: topProvider?.name ?? "non détecté", hint: topProvider ? `${integer(topProvider.totalTokens)} tokens` : "aucune donnée" },
  ];

  return <DashboardSectionPage userEmail={user.email} eyebrow="Surveillance" title="Alertes" description="Détection premium des anomalies : fallback fréquent, coût élevé, JSON trop vieux, provider KO ou lignes non valorisées." cards={[
    { title: String(activeAlertCount), body: "alertes actives calculées", status: "Actives" },
    { title: String(summary.alerts.recentFallback), body: `événements fallback / ${summary.alerts.fallbackWindowHours}h`, status: "Fallback" },
    { title: summary.alerts.freshnessLabel, body: "fraîcheur du JSON fallback", status: "Live" },
  ]}>
    <section className="alertHeroGrid">
      <article className={`panel alertStatusCard ${activeAlertCount ? "alertStatusCardWarn" : ""}`}>
        <div className="sectionHeader"><div><p className="eyebrow">Niveau de risque</p><h2>{activeAlertCount ? "Surveillance active" : "Système stable"}</h2></div><span className="pill">{activeAlertCount} actif(s)</span></div>
        <div className="alertScore"><strong>{activeAlertCount}</strong><span>signaux à traiter maintenant</span></div>
        <p className="muted">Cette page ne manipule aucune clé API : elle agrège uniquement les métriques locales, le JSON fallback redacted et les coûts/tokens déjà enregistrés.</p>
      </article>
      <aside className="panel alertCostCard">
        <div className="sectionHeader"><div><p className="eyebrow">Budget IA</p><h2>Coûts & exposition</h2></div><span className="pill">{summary.projects.selected}</span></div>
        <div className="alertCostGrid">
          <article><span>Coût période</span><strong>{euro(selectedCost)}</strong></article>
          <article><span>Estimé visible</span><strong>{euro(estimatedVisibleCost)}</strong></article>
          <article><span>Réel visible</span><strong>{euro(recordedVisibleCost)}</strong></article>
          <article><span>Abonnements</span><strong>{euro(subscriptionMonthly)}/mois</strong></article>
        </div>
      </aside>
    </section>

    <section className="alertHealthGrid">
      {healthItems.map((item) => <article className="panel alertHealthCard" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></article>)}
    </section>

    <section className="panel alertRulesPanel">
      <div className="sectionHeader"><div><p className="eyebrow">Règles actives</p><h2>Surveillance opérationnelle</h2></div><span className="pill">redacted</span></div>
      <div className="list alertRulesList">{alerts.map((alert) => <div className={`row compact alertRuleRow ${activeSeverityClass(alert.severity)}`} key={alert.label}>
        <div><h3>{alert.label}</h3><p>{alert.detail}</p><small>{alert.action}</small></div><span className="pill">{severityLabel(alert.severity)}</span>
      </div>)}</div>
    </section>

    <section className="visualSummaryGrid alertOpsGrid">
      <article><span>Pic journalier</span><strong>{integer(dailyPeak)}</strong><small>tokens sur le plus gros jour de la période.</small></article>
      <article><span>Historique visible</span><strong>{integer(data.usageEntries.length)}</strong><small>{integer(data.totalUsageEntries)} lignes disponibles.</small></article>
      <article><span>Fallback total</span><strong>{integer(fallback.fallbackEventCount ?? 0)}</strong><small>événements cumulés côté état local.</small></article>
      <article><span>Dernier event</span><strong>{fallback.lastEventType ?? "n/a"}</strong><small>{fallback.lastEventAt ?? "date inconnue"}</small></article>
    </section>
  </DashboardSectionPage>;
}
