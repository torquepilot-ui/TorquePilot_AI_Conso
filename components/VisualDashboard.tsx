"use client";

import { useEffect, useMemo, useState } from "react";
import type { UsageTimeRange, VisualDashboardAgent } from "../lib/db";

type Props = { agents: VisualDashboardAgent[]; timeRange: UsageTimeRange };
type Page = "radar" | "donut" | "models";

const STORAGE_PAGE_KEY = "torquepilot.visualDashboard.page";
const STORAGE_ACTIVE_AGENTS_KEY = "torquepilot.visualDashboard.activeAgents";

const RADAR_AXES: { key: keyof VisualDashboardAgent["radar"]; label: string; hint: string }[] = [
  { key: "input", label: "Input", hint: "Tokens entrants" },
  { key: "output", label: "Output", hint: "Tokens sortants" },
  { key: "cache", label: "Cache", hint: "Cache provider" },
  { key: "reasoning", label: "Reasoning", hint: "Raisonnement" },
  { key: "cost", label: "Coût", hint: "Score coût" },
  { key: "sessions", label: "Sessions", hint: "Activité" },
];
const NAV: { id: Page; label: string; hint: string; icon: string }[] = [
  { id: "radar", label: "Radar agents", hint: "scores 0-100", icon: "◇" },
  { id: "donut", label: "Répartition", hint: "tokens absolus", icon: "◔" },
  { id: "models", label: "Modèles", hint: "top usage", icon: "▤" },
];

function fmt(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}
function compact(value: number) {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
function euro(value: number) {
  return `${value.toFixed(4)} €`;
}
function polar(cx: number, cy: number, radius: number, index: number, total: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}
function radarPath(agent: VisualDashboardAgent, radius: number, cx: number, cy: number) {
  return RADAR_AXES.map((axis, index) => {
    const value = Math.max(0, Math.min(100, agent.radar[axis.key])) / 100;
    const point = polar(cx, cy, radius * value, index, RADAR_AXES.length);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ") + " Z";
}
function donutStroke(agent: VisualDashboardAgent) {
  const total = agent.donut.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return agent.donut.map((item) => {
    const length = total > 0 ? (item.value / total) * 100 : 0;
    const dash = `${length} ${100 - length}`;
    const segment = { ...item, dash, offset: -offset };
    offset += length;
    return segment;
  });
}
function agentTokenTotal(agent: VisualDashboardAgent) {
  return agent.donut.reduce((sum, item) => sum + item.value, 0);
}
function agentCostTotal(agent: VisualDashboardAgent) {
  return agent.models.reduce((sum, model) => sum + model.cost, 0);
}
function agentSessionTotal(agent: VisualDashboardAgent) {
  return agent.models.reduce((sum, model) => sum + model.sessions, 0);
}

function EmptyState() {
  return <section className="visualDashboard visualDashboardEmptyShell">
    <div className="visualEmpty">
      <p className="eyebrow">Cockpit visuel</p>
      <h2>Aucune donnée réelle à afficher</h2>
      <p>Importe un log fournisseur ou ajoute une estimation locale : le radar, le donut et la table modèles se rempliront depuis SQLite.</p>
    </div>
  </section>;
}

function Sidebar({ page, setPage, agents, activeIds, toggleAgent, showAll, hideAll }: { page: Page; setPage: (page: Page) => void; agents: VisualDashboardAgent[]; activeIds: string[]; toggleAgent: (id: string) => void; showAll: () => void; hideAll: () => void }) {
  const totalTokens = agents.reduce((sum, agent) => sum + agentTokenTotal(agent), 0);
  return <aside className="visualSidebar" aria-label="Cockpit navigation">
    <div className="visualBrandBlock">
      <span className="visualLogo">TP</span>
      <div>
        <p className="visualKicker">TorquePilot</p>
        <h2>AI Cockpit</h2>
        <small>{agents.length} agent(s) · {compact(totalTokens)} tokens mesurés</small>
      </div>
    </div>
    <nav aria-label="Navigation cockpit" className="visualNav">{NAV.map((item) => <button key={item.id} type="button" className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
      <b>{item.icon}</b><span>{item.label}</span><small>{item.hint}</small>
    </button>)}</nav>
    <div className="visualAgentToggles">
      <div className="visualToggleHead"><p className="visualKicker">Agents affichés</p><span>{activeIds.length}/{agents.length}</span></div>
      <div className="visualToggleActions"><button type="button" onClick={showAll}>Tout afficher</button><button type="button" onClick={hideAll}>Masquer</button></div>
      {agents.map((agent) => {
        const checked = activeIds.includes(agent.id);
        return <button key={agent.id} type="button" className={checked ? "enabled" : "disabled"} onClick={() => toggleAgent(agent.id)} aria-pressed={checked}>
          <i style={{ background: checked ? agent.color : "transparent", borderColor: agent.color }} />
          <span>{agent.name}</span>
          <small>{compact(agentTokenTotal(agent))} tok</small>
        </button>;
      })}
    </div>
  </aside>;
}

function SummaryCards({ agents, activeAgents }: { agents: VisualDashboardAgent[]; activeAgents: VisualDashboardAgent[] }) {
  const source = activeAgents.length ? activeAgents : agents;
  const tokens = source.reduce((sum, agent) => sum + agentTokenTotal(agent), 0);
  const sessions = source.reduce((sum, agent) => sum + agentSessionTotal(agent), 0);
  const cost = source.reduce((sum, agent) => sum + agentCostTotal(agent), 0);
  const models = new Set(source.flatMap((agent) => agent.models.map((model) => model.name))).size;
  return <div className="visualSummaryGrid" aria-label="Résumé cockpit">
    <article><span>Agents actifs</span><strong>{activeAgents.length || agents.length}</strong><small>sur {agents.length} disponible(s)</small></article>
    <article><span>Tokens mesurés</span><strong>{compact(tokens)}</strong><small>{fmt(tokens)} total</small></article>
    <article><span>Sessions</span><strong>{fmt(sessions)}</strong><small>usage SQLite réel</small></article>
    <article><span>Coût estimé</span><strong>{euro(cost)}</strong><small>{models} modèle(s) observé(s)</small></article>
  </div>;
}

function RadarPage({ agents, allAgents }: { agents: VisualDashboardAgent[]; allAgents: VisualDashboardAgent[] }) {
  const cx = 180; const cy = 180; const radius = 126;
  const rings = [0.25, 0.5, 0.75, 1];
  return <section className="visualPanel visualRadarPage">
    <div className="visualHeader"><div><p className="visualKicker">Radar normalisé</p><h2>Comparatif agents</h2><p>Score 0-100 par maximum observé. Affiche/masque les agents depuis la sidebar.</p></div><span>{agents.length}/{allAgents.length} affiché(s)</span></div>
    <div className="visualRadarGrid">
      <svg viewBox="0 0 360 360" role="img" aria-label="Radar des agents IA">
        {rings.map((ring) => <polygon key={ring} points={RADAR_AXES.map((_, index) => { const p = polar(cx, cy, radius * ring, index, RADAR_AXES.length); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="rgba(255,255,255,.08)" />)}
        {RADAR_AXES.map((axis, index) => { const end = polar(cx, cy, radius, index, RADAR_AXES.length); const label = polar(cx, cy, radius + 30, index, RADAR_AXES.length); return <g key={axis.key}><line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(255,255,255,.1)" /><text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fill="rgba(237,245,255,.78)" fontSize="12"><title>{axis.hint}</title>{axis.label}</text></g>; })}
        {agents.map((agent) => <path key={agent.id} d={radarPath(agent, radius, cx, cy)} fill={agent.color} fillOpacity=".13" stroke={agent.color} strokeWidth="2.4" style={{ filter: `drop-shadow(0 0 14px ${agent.glow})` }} />)}
      </svg>
      <div className="visualLegend">{allAgents.map((agent) => {
        const visible = agents.some((item) => item.id === agent.id);
        return <article key={agent.id} className={visible ? "" : "mutedAgent"}><span style={{ background: visible ? agent.color : "transparent", border: `1px solid ${agent.color}` }} /><div><strong>{agent.name}</strong><small>{visible ? `Input ${agent.radar.input} · Output ${agent.radar.output} · Cache ${agent.radar.cache} · Coût ${agent.radar.cost}` : "masqué du radar"}</small></div></article>;
      })}</div>
    </div>
  </section>;
}

function DonutPage({ agents }: { agents: VisualDashboardAgent[] }) {
  const [selectedId, setSelectedId] = useState(agents[0]?.id ?? "");
  useEffect(() => {
    if (!agents.length) return;
    if (!agents.some((item) => item.id === selectedId)) setSelectedId(agents[0].id);
  }, [agents, selectedId]);
  const agent = agents.find((item) => item.id === selectedId) ?? agents[0];
  const segments = agent ? donutStroke(agent) : [];
  const total = agent?.donut.reduce((sum, item) => sum + item.value, 0) ?? 0;
  return <section className="visualPanel">
    <div className="visualHeader"><div><p className="visualKicker">Répartition tokens</p><h2>{agent?.name ?? "Agent"}</h2><p>Lecture rapide input/output/cache/reasoning sur les données importées.</p></div><select value={agent?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <div className="visualDonutGrid">
      <svg viewBox="0 0 220 220" role="img" aria-label="Donut répartition tokens">
        <circle cx="110" cy="110" r="74" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="28" />
        {segments.map((segment) => <circle key={segment.label} cx="110" cy="110" r="74" fill="none" stroke={segment.color} strokeWidth="28" strokeDasharray={segment.dash} strokeDashoffset={segment.offset} pathLength="100" transform="rotate(-90 110 110)" />)}
        <text x="110" y="104" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{compact(total)}</text>
        <text x="110" y="126" textAnchor="middle" fill="rgba(237,245,255,.65)" fontSize="12">tokens</text>
      </svg>
      <div className="visualLegend">{agent?.donut.map((item) => <article key={item.label}><span style={{ background: item.color }} /><div><strong>{item.label} · {fmt(item.pct)}%</strong><small>{fmt(item.value)} tokens</small></div></article>)}</div>
    </div>
  </section>;
}

function ModelsPage({ agents }: { agents: VisualDashboardAgent[] }) {
  const rows = useMemo(() => agents.flatMap((agent) => agent.models.map((model) => ({ agent: agent.name, color: agent.color, ...model }))).sort((a, b) => b.tokens - a.tokens).slice(0, 16), [agents]);
  return <section className="visualPanel">
    <div className="visualHeader"><div><p className="visualKicker">Modèles réels</p><h2>Top modèles SQLite</h2><p>Classement basé sur les agents actuellement affichés.</p></div><span>{rows.length} lignes</span></div>
    <div className="visualTable visualTableHead"><p>Modèle</p><p>Tokens</p><p>Coût</p><p>Sessions</p><p>Dernier usage</p></div>
    <div className="visualTable">{rows.map((row) => <article key={`${row.agent}-${row.name}`}>
      <div><span style={{ background: row.color }} /><strong>{row.name}</strong><small>{row.agent}</small></div>
      <p>{fmt(row.tokens)} tok</p><p>{euro(row.cost)}</p><p>{row.sessions} session(s)</p><p>{row.lastUsed || "—"}</p>
    </article>)}</div>
  </section>;
}

const RANGE_LABELS: Record<UsageTimeRange, string> = { "24h": "24h", "7d": "7j", "30d": "30j", all: "All-time" };

export default function VisualDashboard({ agents, timeRange }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [page, setPageState] = useState<Page>("radar");
  const [activeIds, setActiveIds] = useState<string[]>(() => agents.map((agent) => agent.id));

  useEffect(() => {
    const storedPage = window.localStorage.getItem(STORAGE_PAGE_KEY) as Page | null;
    if (storedPage && NAV.some((item) => item.id === storedPage)) setPageState(storedPage);
    const storedIds = window.localStorage.getItem(STORAGE_ACTIVE_AGENTS_KEY);
    if (storedIds) {
      try {
        const parsed = JSON.parse(storedIds) as string[];
        const valid = parsed.filter((id) => agents.some((agent) => agent.id === id));
        setActiveIds(valid.length ? valid : agents.map((agent) => agent.id));
      } catch {
        setActiveIds(agents.map((agent) => agent.id));
      }
    }
    setHydrated(true);
  }, [agents]);

  useEffect(() => {
    setActiveIds((current) => {
      const valid = current.filter((id) => agents.some((agent) => agent.id === id));
      return valid.length ? valid : agents.map((agent) => agent.id);
    });
  }, [agents]);

  const setPage = (nextPage: Page) => {
    setPageState(nextPage);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_PAGE_KEY, nextPage);
  };
  const persistActiveIds = (nextIds: string[]) => {
    setActiveIds(nextIds);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_ACTIVE_AGENTS_KEY, JSON.stringify(nextIds));
  };
  const toggleAgent = (id: string) => persistActiveIds(activeIds.includes(id) ? activeIds.filter((item) => item !== id) : [...activeIds, id]);
  const showAll = () => persistActiveIds(agents.map((agent) => agent.id));
  const hideAll = () => persistActiveIds([]);
  const activeAgents = useMemo(() => agents.filter((agent) => activeIds.includes(agent.id)), [agents, activeIds]);
  const displayedAgents = activeAgents.length ? activeAgents : agents;

  if (!agents.length) return <EmptyState />;
  return <section className="visualDashboard visualDashboardWithMenu" data-hydrated={hydrated ? "true" : "false"}>
    <Sidebar page={page} setPage={setPage} agents={agents} activeIds={activeIds} toggleAgent={toggleAgent} showAll={showAll} hideAll={hideAll} />
    <div className="visualContent">
      <div className="visualTopbar">
        <div><p className="visualKicker">Cockpit / Visualisation</p><h2>Vue exécutive consommation IA</h2><small>Données réelles SQLite · période {RANGE_LABELS[timeRange]} · auto-refresh actif · accès VPN prêt</small></div>
        <div className="visualStatus"><span />{RANGE_LABELS[timeRange]}</div>
      </div>
      <SummaryCards agents={agents} activeAgents={activeAgents} />
      {page === "radar" && <RadarPage agents={activeAgents} allAgents={agents} />}
      {page === "donut" && <DonutPage agents={displayedAgents} />}
      {page === "models" && <ModelsPage agents={displayedAgents} />}
    </div>
  </section>;
}
