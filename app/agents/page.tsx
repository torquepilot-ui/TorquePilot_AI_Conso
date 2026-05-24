import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { assignAiSetupAction, createAiAccountAction, currentUserId, deleteAiAccountAction, deleteAiSetupAction, updateAiAccountAction, updateAiSetupAction } from "../actions";
import { DB_PATH, getUserById, listDashboardData } from "../../lib/db";
import { buildDashboardSectionSummary, euro, integer, readHermesFallbackState } from "../../lib/dashboard-section-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function connectionLabel(value: string) { return value === "api" ? "API" : value === "local" ? "Local" : "Abonnement"; }
function connectionClass(value: string) { return value === "api" ? "agentTypeApi" : value === "local" ? "agentTypeLocal" : "agentTypeSubscription"; }
function pct(value: number) { return `${Math.max(0, Math.min(100, Math.round(value)))}%`; }

export default async function AgentsPage() {
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");

  const fallback = readHermesFallbackState();
  const data = listDashboardData(DB_PATH, user.id);
  const summary = buildDashboardSectionSummary(data, fallback);
  const selectedProjectId = data.selectedProject?.id ?? "";
  const visualAgents = data.visualDashboard.agents;
  const topAgent = visualAgents[0];
  const visualAgentCount = visualAgents.length;
  const visibleAgentTokens = visualAgents.reduce((sum, agent) => sum + agent.models.reduce((modelSum, model) => modelSum + model.tokens, 0), 0);
  const visibleAgentCost = visualAgents.reduce((sum, agent) => sum + agent.models.reduce((modelSum, model) => modelSum + model.cost, 0), 0);
  const monthlySubscriptions = data.aiAccounts.reduce((sum, account) => sum + (account.connectionType === "subscription" ? account.monthlyCostEur : 0), 0);
  const setupCoverage = data.aiAccounts.length > 0 ? Math.round((data.projectAiSetups.length / data.aiAccounts.length) * 100) : 0;
  const providerCount = new Set(data.aiAccounts.map((account) => account.providerName).filter(Boolean)).size;

  return <DashboardSectionPage userEmail={user.email} eyebrow="Agents IA" title="Agents" description="Cockpit premium des agents : comptes, affectations projet, coûts, modèles réellement utilisés et valeur opérationnelle." cards={[
    { title: String(summary.agents.totalAccounts), body: "comptes IA déclarés", status: "Comptes" },
    { title: String(summary.agents.totalSetups), body: "agents affectés au projet actif", status: "Affectations" },
    { title: `${summary.agents.apiSetups}/${summary.agents.subscriptionSetups}/${summary.agents.localSetups}`, body: "API / abonnement / local", status: "Mix" },
  ]}>
    <section className="agentsHeroGrid">
      <article className="panel agentsHeroCard">
        <div className="sectionHeader"><div><p className="eyebrow">Portefeuille agents</p><h2>{summary.projects.selected}</h2></div><span className="pill">{visualAgentCount} actif(s)</span></div>
        <div className="agentsBigMetric"><strong>{integer(visibleAgentTokens)}</strong><span>tokens attribués aux agents sur la période {data.visualDashboard.timeRange}</span></div>
        <div className="agentsHeroStats">
          <article><span>Coût agents</span><strong>{euro(visibleAgentCost)}</strong></article>
          <article><span>Abonnements</span><strong>{euro(monthlySubscriptions)}/mois</strong></article>
          <article><span>Coverage</span><strong>{pct(setupCoverage)}</strong></article>
          <article><span>Providers</span><strong>{integer(providerCount)}</strong></article>
        </div>
      </article>
      <aside className="panel agentsCommandCard">
        <div className="sectionHeader"><div><p className="eyebrow">Leader opérationnel</p><h2>{topAgent?.name ?? "Aucun usage"}</h2></div><span className="pill">ROI</span></div>
        {topAgent ? <>
          <p className="muted">Agent le plus consommateur sur le projet actif. À surveiller pour piloter coût, modèle et valeur métier.</p>
          <div className="agentPulse" style={{ "--agent-color": topAgent.color, "--agent-glow": topAgent.glow } as CSSProperties}><span></span><strong>{topAgent.models[0]?.name ?? "modèle non détecté"}</strong><small>{integer(topAgent.models[0]?.tokens ?? 0)} tokens · {euro(topAgent.models[0]?.cost ?? 0)}</small></div>
        </> : <p className="muted">Aucun usage agent encore détecté. Les cartes s’activeront dès que les logs seront importés.</p>}
      </aside>
    </section>

    <section className="agentsOpsGrid">
      <article className="panel agentsInventoryPanel">
        <div className="sectionHeader"><div><p className="eyebrow">Affectations projet</p><h2>Agents branchés</h2></div><span className="pill">{data.projectAiSetups.length}</span></div>
        <div className="agentsCardGrid">{data.projectAiSetups.map((setup) => <article className={`agentSetupCard ${connectionClass(setup.connectionType)}`} key={setup.id}>
          <div className="agentCardTop"><span>{connectionLabel(setup.connectionType)}</span><strong>{setup.label}</strong></div>
          <p>{setup.providerName || "Provider"} · {setup.modelName || "modèle auto / non fixé"}</p>
          <div className="agentCardFooter"><small>{setup.accountName}</small><b>{setup.connectionType === "subscription" ? `${euro(setup.monthlyCostEur)}/mois` : connectionLabel(setup.connectionType)}</b></div>
        </article>)}{!data.projectAiSetups.length && <p className="muted">Aucun agent affecté au projet actif.</p>}</div>
      </article>
      <aside className="panel agentsInventoryPanel">
        <div className="sectionHeader"><div><p className="eyebrow">Comptes IA</p><h2>Inventaire</h2></div><span className="pill">{data.aiAccounts.length}</span></div>
        <div className="list">{data.aiAccounts.slice(0, 8).map((account) => <div className={`row compact agentAccountRow ${connectionClass(account.connectionType)}`} key={account.id}><div><h3>{account.name}</h3><p>{account.providerName || "Provider"} · {connectionLabel(account.connectionType)}{account.subscriptionName ? ` · ${account.subscriptionName}` : ""}</p></div><span className="pill">{account.connectionType === "subscription" ? euro(account.monthlyCostEur) : connectionLabel(account.connectionType)}</span></div>)}{!data.aiAccounts.length && <p className="muted">Aucun compte IA déclaré.</p>}</div>
      </aside>
    </section>

    <section className="panel agentsPerformancePanel">
      <div className="sectionHeader"><div><p className="eyebrow">Usage réel</p><h2>Performance par agent</h2></div><span className="pill">SQLite live</span></div>
      <div className="agentsPerformanceGrid">{visualAgents.slice(0, 6).map((agent) => {
        const agentTokens = agent.models.reduce((sum, model) => sum + model.tokens, 0);
        const agentCost = agent.models.reduce((sum, model) => sum + model.cost, 0);
        const topModel = agent.models[0];
        return <article className="agentPerformanceCard" key={agent.id} style={{ "--agent-color": agent.color, "--agent-glow": agent.glow } as CSSProperties}>
          <div className="agentPerfHead"><span></span><div><h3>{agent.name}</h3><p>{topModel?.name ?? "modèle non détecté"}</p></div><b>{euro(agentCost)}</b></div>
          <div className="agentBars">
            <label>Sessions<i><em style={{ width: pct(agent.radar.sessions) }}></em></i></label>
            <label>Coût<i><em style={{ width: pct(agent.radar.cost) }}></em></i></label>
            <label>Output<i><em style={{ width: pct(agent.radar.output) }}></em></i></label>
          </div>
          <div className="agentModelList">{agent.models.slice(0, 3).map((model) => <div key={model.name}><strong>{model.name}</strong><span>{integer(model.tokens)} tokens · {integer(model.sessions)} sessions · {model.lastUsed || "n/a"}</span></div>)}</div>
          <div className="agentCardFooter"><small>{integer(agentTokens)} tokens</small><b>{integer(agent.models.reduce((sum, model) => sum + model.sessions, 0))} sessions</b></div>
        </article>;
      })}{!visualAgents.length && <p className="muted">Aucun usage agent disponible pour la période.</p>}</div>
    </section>

    <section className="layout usageLayout agentsFormsGrid">
      <article className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Nouveau compte</p><h2>Compte IA</h2></div><span className="pill">Action locale</span></div>
        <form action={createAiAccountAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProjectId} />
          <label>Provider<select name="providerId"><option value="">Non précisé</option>{data.providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}</select></label>
          <label>Nom<input name="name" placeholder="Ex: OpenAI perso, Ollama local" required /></label>
          <label>Connexion<select name="connectionType" defaultValue="subscription"><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label>
          <label>Abonnement<input name="subscriptionName" placeholder="Ex: ChatGPT Plus" /></label>
          <label>Coût mensuel €<input name="monthlyCostEur" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <label>Notes<textarea name="notes" rows={3}></textarea></label>
          <button>Créer le compte</button>
        </form>
      </article>
      <aside className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Nouvelle affectation</p><h2>Projet actif</h2></div><span className="pill">{data.selectedProject?.name || "Aucun"}</span></div>
        {data.selectedProject && data.aiAccounts.length ? <form action={assignAiSetupAction} className="usageForm">
          <input type="hidden" name="projectId" value={data.selectedProject.id} />
          <label>Compte<select name="accountId" required>{data.aiAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
          <label>Modèle<select name="modelId"><option value="">Auto / non fixé</option>{data.models.slice(0, 80).map((model) => <option value={model.id} key={model.id}>{model.providerName} · {model.name}</option>)}</select></label>
          <label>Connexion<select name="connectionType" defaultValue="subscription"><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select></label>
          <label>Libellé<input name="label" placeholder="Ex: Limule fallback" required /></label>
          <button>Affecter au projet</button>
        </form> : <p className="muted">Crée d’abord un projet et un compte IA.</p>}
      </aside>
    </section>

    <section className="layout usageLayout agentsFormsGrid">
      <article className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Gestion comptes</p><h2>Modifier / supprimer</h2></div><span className="pill">{data.aiAccounts.length}</span></div>
        <div className="list">{data.aiAccounts.map((account) => <div className="row compact reportRow" key={`account-${account.id}`}>
          <form action={updateAiAccountAction} className="inlineForm">
            <input type="hidden" name="projectId" value={selectedProjectId} />
            <input type="hidden" name="accountId" value={account.id} />
            <select name="providerId" defaultValue={account.providerId ?? ""}><option value="">Non précisé</option>{data.providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}</select>
            <input name="name" defaultValue={account.name} required />
            <select name="connectionType" defaultValue={account.connectionType}><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select>
            <input name="subscriptionName" defaultValue={account.subscriptionName || ""} placeholder="Abonnement" />
            <input name="monthlyCostEur" type="number" min="0" step="0.01" defaultValue={account.monthlyCostEur} />
            <input name="notes" defaultValue={account.notes || ""} placeholder="Notes" />
            <button>Modifier</button>
          </form>
          <form action={deleteAiAccountAction}><input type="hidden" name="projectId" value={selectedProjectId} /><input type="hidden" name="accountId" value={account.id} /><button className="danger">Supprimer</button></form>
        </div>)}{!data.aiAccounts.length && <p className="muted">Aucun compte IA à modifier.</p>}</div>
      </article>
      <aside className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Gestion affectations</p><h2>Modifier / supprimer</h2></div><span className="pill">{data.projectAiSetups.length}</span></div>
        <div className="list">{data.projectAiSetups.map((setup) => <div className="row compact reportRow" key={`setup-${setup.id}`}>
          <form action={updateAiSetupAction} className="inlineForm">
            <input type="hidden" name="projectId" value={setup.projectId} />
            <input type="hidden" name="setupId" value={setup.id} />
            <select name="accountId" defaultValue={setup.accountId} required>{data.aiAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select>
            <select name="modelId" defaultValue={setup.modelId ?? ""}><option value="">Auto / non fixé</option>{data.models.slice(0, 80).map((model) => <option value={model.id} key={model.id}>{model.providerName} · {model.name}</option>)}</select>
            <select name="connectionType" defaultValue={setup.connectionType}><option value="subscription">Abonnement</option><option value="api">API</option><option value="local">Local</option></select>
            <input name="label" defaultValue={setup.label} required />
            <button>Modifier</button>
          </form>
          <form action={deleteAiSetupAction}><input type="hidden" name="projectId" value={setup.projectId} /><input type="hidden" name="setupId" value={setup.id} /><button className="danger">Supprimer</button></form>
        </div>)}{!data.projectAiSetups.length && <p className="muted">Aucune affectation à modifier.</p>}</div>
      </aside>
    </section>
  </DashboardSectionPage>;
}
