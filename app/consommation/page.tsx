import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId } from "../actions";
import { DB_PATH, USAGE_TIME_RANGES, getUserById, listDashboardData, normalizeUsageTimeRange } from "../../lib/db";
import { buildDashboardSectionSummary, euro, integer, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safePositiveInteger(value: string | undefined, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function consommationHref(projectId: number | undefined | null, range: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", String(projectId));
  if (range !== "all") params.set("range", range);
  const query = params.toString();
  return query ? `/consommation?${query}` : "/consommation";
}

function costBadge(costEur: number, estimatedCostEur: number) {
  if (costEur > 0) return `facturé ${euro(costEur)}`;
  if (estimatedCostEur > 0) return `estimé ${euro(estimatedCostEur)}`;
  return "0,0000 €";
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function barWidth(ratio: number | undefined) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(100, Number(ratio))) : 0;
  return { width: `${safeRatio}%` };
}

function fallbackLabel(active: boolean) {
  return active ? "Fallback actif" : "Provider principal";
}

export default async function ConsommationPage({ searchParams }: { searchParams?: Promise<{ project?: string; range?: string }> }) {
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");

  const selectedProjectId = params?.project ? safePositiveInteger(params.project, 0) : undefined;
  const timeRange = normalizeUsageTimeRange(params?.range);
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId, 1, timeRange);
  const fallback = readHermesFallbackState();
  const summary = buildDashboardSectionSummary(data, fallback);
  const visibleEstimatedCost = data.usageEntries.reduce((sum, entry) => sum + entry.estimatedCostEur, 0);
  const visibleRecordedCost = data.usageEntries.reduce((sum, entry) => sum + entry.costEur, 0);
  const visibleInputTokens = data.usageEntries.reduce((sum, entry) => sum + entry.inputTokens, 0);
  const visibleOutputTokens = data.usageEntries.reduce((sum, entry) => sum + entry.outputTokens, 0);
  const visibleCacheTokens = data.usageEntries.reduce((sum, entry) => sum + entry.cacheTokens, 0);
  const visibleReasoningTokens = data.usageEntries.reduce((sum, entry) => sum + entry.reasoningTokens, 0);
  const chartTotals = data.usageCharts?.totals;
  const selectedTotalTokens = chartTotals?.totalTokens ?? summary.consumption.selectedProjectTokens;
  const activeRange = USAGE_TIME_RANGES.find((range) => range.id === timeRange) ?? USAGE_TIME_RANGES[USAGE_TIME_RANGES.length - 1];
  const activeProjectHref = consommationHref(data.selectedProject?.id, timeRange);
  const projectOptions = data.projects.map((project) => ({ project, href: consommationHref(project.id, timeRange), active: project.id === data.selectedProject?.id }));
  const providerRows = data.usageCharts?.topProviders.slice(0, 4) ?? [];
  const modelRows = data.usageCharts?.topModels.slice(0, 5) ?? [];
  const dailyRows = data.usageCharts?.daily.slice(-10) ?? [];

  return <DashboardSectionPage userEmail={user.email} eyebrow="FinOps IA" title="Consommation" description="Pilotage clair des tokens, coûts enregistrés, estimations et bascules provider par projet." cards={[
    { title: integer(selectedTotalTokens), body: `tokens projet · ${activeRange.hint}`, status: "Projet" },
    { title: euro(summary.consumption.selectedProjectCost), body: "coût API réellement enregistré", status: "Réel" },
    { title: euro(visibleEstimatedCost), body: "estimation sur les lignes visibles", status: "Estimé" },
  ]}>
    <section className="consumptionCommand panel">
      <div className="sectionHeader"><div><p className="eyebrow">Commande</p><h2>Sélection projet / période</h2></div><span className="pill">{data.projects.length} projets</span></div>
      <form action="/consommation" className="usageForm consumptionForm" method="get">
        <label>Projet<select name="project" defaultValue={data.selectedProject?.id ?? ""}>
          {data.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select></label>
        <label>Période<select name="range" defaultValue={timeRange}>
          {USAGE_TIME_RANGES.map((range) => <option value={range.id} key={range.id}>{range.label} — {range.hint}</option>)}
        </select></label>
        <button>Afficher ce projet</button>
      </form>
      <div className="rangeTabs consumptionRangeTabs">
        {USAGE_TIME_RANGES.map((range) => <Link className={`rangeTab ${range.id === timeRange ? "active" : ""}`} href={consommationHref(data.selectedProject?.id, range.id)} key={range.id}>{range.label}</Link>)}
      </div>
      <div className="projectTabs consumptionProjectTabs">
        {projectOptions.map(({ project, href, active }) => <Link className={`tab ${active ? "active" : ""}`} href={href} key={project.id}><strong>{project.name}</strong><small>{active ? "Projet affiché" : "Basculer"}</small></Link>)}
      </div>
      <p className="muted">Lien actif : <code>{activeProjectHref}</code>. Aucun secret ni clé API n’est exposé : la page affiche uniquement des métriques locales agrégées.</p>
    </section>

    <section className="consumptionHeroGrid">
      <article className="panel consumptionHeroCard">
        <div className="sectionHeader"><div><p className="eyebrow">Projet sélectionné</p><h2>{summary.projects.selected}</h2></div><span className="pill">{activeRange.label}</span></div>
        <div className="consumptionBigMetric"><strong>{integer(selectedTotalTokens)}</strong><span>tokens suivis sur la période</span></div>
        <div className="tokenSplitGrid">
          <article><span>Input</span><strong>{integer(chartTotals?.inputTokens ?? visibleInputTokens)}</strong></article>
          <article><span>Output</span><strong>{integer(chartTotals?.outputTokens ?? visibleOutputTokens)}</strong></article>
          <article><span>Cache</span><strong>{integer(chartTotals?.cacheTokens ?? visibleCacheTokens)}</strong></article>
          <article><span>Reasoning</span><strong>{integer(chartTotals?.reasoningTokens ?? visibleReasoningTokens)}</strong></article>
        </div>
      </article>

      <aside className={`panel providerLiveCard ${fallback.fallbackActive ? "providerLiveCardActive" : ""}`}>
        <div className="sectionHeader"><div><p className="eyebrow">Provider live</p><h2>{fallback.activeProvider}</h2></div><span className="pill">{fallbackLabel(fallback.fallbackActive)}</span></div>
        <div className="providerSignal"><span></span><strong>{fallback.activeModel}</strong></div>
        <div className="providerMetaGrid">
          <article><span>Statut</span><strong>{fallback.status}</strong></article>
          <article><span>Dernier event</span><strong>{fallback.lastEventType}</strong></article>
          <article><span>Fallback total</span><strong>{integer(fallback.fallbackEventCount ?? 0)}</strong></article>
          <article><span>Fallback récent</span><strong>{integer(fallback.recentFallbackEventCount ?? 0)}</strong></article>
        </div>
        <p className="muted">Confirmé : événement fallback ≠ coût facturable. Le coût apparaît seulement quand une ligne d’usage avec tokens est importée.</p>
      </aside>
    </section>

    <section className="visualSummaryGrid consumptionKpiGrid">
      <article><span>Coût réel enregistré</span><strong>{euro(summary.consumption.selectedProjectCost)}</strong><small>Somme `cost_eur` SQLite du projet.</small></article>
      <article><span>Estimation visible</span><strong>{euro(visibleEstimatedCost)}</strong><small>Calculée depuis les tokens/prix modèle sur les lignes affichées.</small></article>
      <article><span>Abonnement mensuel</span><strong>{euro(summary.projects.subscriptionMonthly)}</strong><small>Coûts fixes affectés au projet.</small></article>
      <article><span>Lignes visibles</span><strong>{integer(data.usageEntries.length)}</strong><small>{integer(data.totalUsageEntries)} lignes disponibles sur cette sélection.</small></article>
    </section>

    <section className="consumptionAnalyticsGrid">
      <article className="panel visualPanel consumptionChartPanel">
        <div className="visualHeader"><div><p className="eyebrow">Tendance</p><h2>Tokens par jour</h2><p>Vue rapide de la pression d’usage sur les derniers points de la période.</p></div><span className="pill">{dailyRows.length} points</span></div>
        <div className="barChart consumptionBars">
          {dailyRows.map((point) => <div className="barRow consumptionBarRow" key={point.date}><span>{point.date}</span><div className="barTrack"><i style={barWidth(point.maxRatio)} /></div><strong>{integer(point.totalTokens)} tok</strong></div>)}
          {!dailyRows.length && <p className="muted">Aucun point temporel pour cette période.</p>}
        </div>
      </article>

      <article className="panel visualPanel consumptionChartPanel">
        <div className="visualHeader"><div><p className="eyebrow">Répartition</p><h2>Providers / modèles</h2><p>Lecture immédiate des sources qui consomment le plus.</p></div></div>
        <div className="consumptionBreakdowns">
          <div>
            <h3>Providers</h3>
            {providerRows.map((row) => <div className="miniBar" key={row.name}><div><span>{row.name}</span><strong>{percent(row.totalTokens, selectedTotalTokens)} · {integer(row.totalTokens)} tok</strong></div><div className="barTrack"><i style={barWidth(row.maxRatio)} /></div></div>)}
            {!providerRows.length && <p className="muted">Aucun provider détecté.</p>}
          </div>
          <div>
            <h3>Modèles</h3>
            {modelRows.map((row) => <div className="miniBar" key={row.name}><div><span>{row.name}</span><strong>{integer(row.totalTokens)} tok · {euro(row.costEur)}</strong></div><div className="barTrack"><i style={barWidth(row.maxRatio)} /></div></div>)}
            {!modelRows.length && <p className="muted">Aucun modèle détecté.</p>}
          </div>
        </div>
      </article>
    </section>

    <section className="panel usageLayout consumptionHistoryPanel">
      <div className="sectionHeader"><div><p className="eyebrow">Dernières consommations</p><h2>Historique récent</h2></div><span className="pill">{data.usageEntries.length}</span></div>
      <div className="historyTotals">
        <span>Réel visible : <strong>{euro(visibleRecordedCost)}</strong></span>
        <span>Estimé visible : <strong>{euro(visibleEstimatedCost)}</strong></span>
        <span>Total tokens : <strong>{integer(data.usageEntries.reduce((sum, entry) => sum + entry.totalTokens, 0))}</strong></span>
      </div>
      <div className="list consumptionHistoryList">{data.usageEntries.slice(0, 10).map((entry) => <div className="row compact consumptionHistoryRow" key={entry.id}><div><h3>{entry.label}</h3><p>{entry.projectName} · {entry.providerName || "IA"} · {entry.modelName || "modèle"}</p><small>{entry.usedAt}</small></div><span className="pill">{integer(entry.totalTokens)} tok · {costBadge(entry.costEur, entry.estimatedCostEur)}</span></div>)}{!data.usageEntries.length && <p className="muted">Aucune consommation enregistrée pour ce projet et cette période.</p>}</div>
    </section>
  </DashboardSectionPage>;
}
