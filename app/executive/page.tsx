import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId } from "../actions";
import { DB_PATH, USAGE_TIME_RANGES, getUserById, listDashboardData, normalizeUsageTimeRange, seedDefaultProviders } from "../../lib/db";
import { buildDashboardSectionSummary, euro, integer, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function compactEuro(value: number) {
  if (value >= 1000) return `${Math.round(value).toLocaleString("fr-FR")} €`;
  if (value >= 10) return `${value.toFixed(2)} €`;
  return euro(value);
}

function executiveHref(projectId: number | undefined | null, range: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", String(projectId));
  if (range !== "all") params.set("range", range);
  const query = params.toString();
  return query ? `/executive?${query}` : "/executive";
}

function riskLabel(score: number) {
  if (score >= 70) return "Risque élevé";
  if (score >= 35) return "À surveiller";
  return "Sous contrôle";
}

export default async function ExecutivePage({ searchParams }: { searchParams?: Promise<{ project?: string; range?: string }> }) {
  seedDefaultProviders(DB_PATH);
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");

  const selectedProjectId = params?.project ? Number(params.project) : undefined;
  const timeRange = normalizeUsageTimeRange(params?.range);
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId, 1, timeRange);
  const fallback = readHermesFallbackState();
  const summary = buildDashboardSectionSummary(data, fallback);
  const chartTotals = data.usageCharts?.totals;
  const totalTokens = chartTotals?.totalTokens ?? summary.consumption.selectedProjectTokens;
  const apiCost = chartTotals?.costEur ?? summary.consumption.selectedProjectCost;
  const monthlySubscriptions = data.aiAccounts.reduce((sum, account) => sum + (account.connectionType === "subscription" ? account.monthlyCostEur : 0), 0);
  const visibleAgentCost = data.visualDashboard.agents.reduce((sum, agent) => sum + agent.models.reduce((modelSum, model) => modelSum + model.cost, 0), 0);
  const visibleSessions = data.visualDashboard.agents.reduce((sum, agent) => sum + agent.models.reduce((modelSum, model) => modelSum + model.sessions, 0), 0);
  const topProvider = data.usageCharts?.topProviders[0];
  const topModel = data.usageCharts?.topModels[0];
  const unpricedRows = data.usageEntries.filter((entry) => entry.costEur === 0 && entry.estimatedCostEur === 0 && entry.totalTokens > 0).length;
  const recentFallback = fallback.recentFallbackEventCount ?? 0;
  const activeRiskFlags = [recentFallback > 10, summary.alerts.staleFallbackJson, summary.alerts.containsSecrets, unpricedRows > 0].filter(Boolean).length;
  const riskScore = Math.min(100, activeRiskFlags * 25 + Math.min(25, recentFallback * 2) + (apiCost > 20 ? 15 : 0));
  const coverage = data.aiAccounts.length ? Math.round((data.projectAiSetups.length / data.aiAccounts.length) * 100) : 0;
  const estimatedWasteRate = Math.min(0.35, 0.08 + activeRiskFlags * 0.05 + (coverage < 50 ? 0.07 : 0));
  const monthlyRunRate = apiCost + monthlySubscriptions;
  const potentialSavings = monthlyRunRate * estimatedWasteRate;
  const roiSignal = monthlyRunRate > 0 ? Math.round((potentialSavings / monthlyRunRate) * 100) : 0;
  const projectName = data.selectedProject?.name ?? "Aucun projet";
  const commercialSentence = monthlyRunRate > 0
    ? `TorquePilot rend visible ${compactEuro(monthlyRunRate)}/mois d’exposition IA et cible ${compactEuro(potentialSavings)}/mois d’optimisation potentielle.`
    : "TorquePilot pose le socle de pilotage IA avant explosion des usages, même quand le coût réel démarre à zéro.";

  const valueCards = [
    { label: "Budget IA mensuel", value: compactEuro(monthlyRunRate), hint: `API ${compactEuro(apiCost)} + abonnements ${compactEuro(monthlySubscriptions)}` },
    { label: "Optimisation cible", value: compactEuro(potentialSavings), hint: `${roiSignal}% du run-rate visible à challenger` },
    { label: "Agents suivis", value: String(data.projectAiSetups.length), hint: `${data.aiAccounts.length} comptes IA déclarés · coverage ${pct(coverage)}` },
    { label: "Risque décideur", value: riskLabel(riskScore), hint: `${activeRiskFlags} signaux actifs · score ${riskScore}/100` },
  ];

  const recommendations = [
    {
      title: "Faire valider le budget IA mensuel",
      detail: monthlyRunRate > 0 ? `Point de départ : ${compactEuro(monthlyRunRate)}/mois visible sur ${projectName}.` : "Créer une base budgétaire avant de multiplier les agents.",
      priority: "Décision",
    },
    {
      title: coverage < 80 ? "Compléter les affectations agents" : "Maintenir la cartographie agents",
      detail: coverage < 80 ? `Coverage actuel ${pct(coverage)} : certains comptes ne sont pas encore reliés à un projet.` : "Les comptes IA sont bien rattachés : on peut mesurer la valeur métier par agent.",
      priority: coverage < 80 ? "Action" : "OK",
    },
    {
      title: activeRiskFlags ? "Traiter les alertes avant démonstration client" : "Prêt pour démonstration pilote",
      detail: activeRiskFlags ? `${activeRiskFlags} signaux remontent côté fallback/coûts/valorisation.` : "Aucun signal critique actif dans la synthèse executive.",
      priority: activeRiskFlags ? "Risque" : "Go",
    },
    {
      title: "Transformer cette vue en offre T.E.D",
      detail: "Message commercial : maîtriser ses coûts IA et ses agents sans équipe technique interne.",
      priority: "Business",
    },
  ];

  return <DashboardSectionPage userEmail={user.email} eyebrow="Executive cockpit" title="Executive" description="Vue dirigeant : valeur business, budget IA, risques, ROI potentiel et recommandations actionnables en 30 secondes." cards={[
    { title: compactEuro(monthlyRunRate), body: "exposition mensuelle IA visible", status: "Budget" },
    { title: compactEuro(potentialSavings), body: "optimisation potentielle estimée", status: "ROI" },
    { title: riskLabel(riskScore), body: `score ${riskScore}/100`, status: "Risque" },
  ]}>
    <section className="executiveHeroGrid">
      <article className="panel executiveValueCard">
        <div className="sectionHeader"><div><p className="eyebrow">Décision en 30 secondes</p><h2>{projectName}</h2></div><span className="pill">{timeRange}</span></div>
        <div className="executiveBigMetric"><strong>{compactEuro(potentialSavings)}</strong><span>optimisation mensuelle potentielle à discuter</span></div>
        <p className="muted">{commercialSentence}</p>
        <div className="executiveFilters">
          <form className="inlineForm" action="/executive">
            <select name="project" defaultValue={data.selectedProject?.id ?? ""} aria-label="Projet executive">
              {data.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
            <select name="range" defaultValue={timeRange} aria-label="Période executive">
              {USAGE_TIME_RANGES.map((range) => <option value={range.id} key={range.id}>{range.label}</option>)}
            </select>
            <button>Actualiser</button>
          </form>
        </div>
      </article>
      <aside className={`panel executiveRiskCard ${riskScore >= 35 ? "executiveRiskWarn" : ""}`}>
        <div className="sectionHeader"><div><p className="eyebrow">Niveau comité</p><h2>{riskLabel(riskScore)}</h2></div><span className="pill">{riskScore}/100</span></div>
        <div className="executiveGauge"><i style={{ width: pct(riskScore) }}></i></div>
        <div className="executiveRiskList">
          <span>Fallback récent : <strong>{integer(recentFallback)}</strong></span>
          <span>Lignes non valorisées : <strong>{integer(unpricedRows)}</strong></span>
          <span>JSON fallback : <strong>{summary.alerts.staleFallbackJson ? "à rafraîchir" : "OK"}</strong></span>
          <span>Sécurité : <strong>{summary.alerts.containsSecrets ? "à bloquer" : "redacted OK"}</strong></span>
        </div>
      </aside>
    </section>

    <section className="executiveValueGrid">
      {valueCards.map((card) => <article className="panel executiveKpiCard" key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.hint}</small></article>)}
    </section>

    <section className="executiveNarrativeGrid">
      <article className="panel executiveStoryCard">
        <div className="sectionHeader"><div><p className="eyebrow">Pitch client pilote</p><h2>Ce que TorquePilot fait gagner</h2></div><span className="pill">T.E.D ready</span></div>
        <ul className="executiveBullets">
          <li><strong>Voir</strong><span>les coûts IA, tokens, providers, modèles et abonnements au même endroit.</span></li>
          <li><strong>Décider</strong><span>où garder API, abonnement ou local selon coût, risque et valeur métier.</span></li>
          <li><strong>Alerter</strong><span>sur fallback fréquent, données obsolètes, lignes non valorisées ou exposition sensible.</span></li>
          <li><strong>Vendre</strong><span>une gouvernance IA simple pour PME, garages, artisans et pilotes Tahiti.</span></li>
        </ul>
      </article>
      <aside className="panel executiveProofCard">
        <div className="sectionHeader"><div><p className="eyebrow">Preuves dashboard</p><h2>Données exploitées</h2></div><span className="pill">SQLite local</span></div>
        <div className="executiveProofGrid">
          <article><span>Tokens</span><strong>{integer(totalTokens)}</strong></article>
          <article><span>Sessions</span><strong>{integer(visibleSessions)}</strong></article>
          <article><span>Top provider</span><strong>{topProvider?.name ?? "n/a"}</strong></article>
          <article><span>Top modèle</span><strong>{topModel?.name ?? "n/a"}</strong></article>
          <article><span>Coût agents</span><strong>{compactEuro(visibleAgentCost)}</strong></article>
          <article><span>Entrées</span><strong>{integer(data.totalUsageEntries)}</strong></article>
        </div>
      </aside>
    </section>

    <section className="panel executiveRecommendations">
      <div className="sectionHeader"><div><p className="eyebrow">Plan d’action</p><h2>Recommandations executive</h2></div><span className="pill">priorisées</span></div>
      <div className="list executiveActionList">{recommendations.map((item) => <div className="row compact executiveActionRow" key={item.title}>
        <div><h3>{item.title}</h3><p>{item.detail}</p></div><span className="pill">{item.priority}</span>
      </div>)}</div>
    </section>

    <section className="executiveCtaPanel panel">
      <div><p className="eyebrow">Prochaine brique commerciale</p><h2>Transformer cette vue en rapport partageable</h2><p className="muted">Étape suivante possible : bouton export PDF/CSV executive, résumé client pilote T.E.D, et page offre publique “maîtrise des coûts IA”.</p></div>
      <div className="executiveCtaLinks">
        <a className="buttonLink" href={executiveHref(data.selectedProject?.id, timeRange)}>Vue executive</a>
        <a className="buttonLink ghost" href={data.selectedProject ? `/consommation?project=${data.selectedProject.id}&range=${timeRange}` : "/consommation"}>Voir consommation</a>
        <a className="buttonLink ghost" href="/alertes">Voir alertes</a>
      </div>
    </section>
  </DashboardSectionPage>;
}
