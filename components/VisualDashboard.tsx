"use client";

import { useMemo, useState } from "react";
import type { VisualDashboardAgent } from "../lib/db";

type Props = { agents: VisualDashboardAgent[] };
type Page = "radar" | "donut" | "models";

const RADAR_AXES: { key: keyof VisualDashboardAgent["radar"]; label: string }[] = [
  { key: "input", label: "Input" },
  { key: "output", label: "Output" },
  { key: "cache", label: "Cache" },
  { key: "reasoning", label: "Reasoning" },
  { key: "cost", label: "Coût" },
  { key: "sessions", label: "Sessions" },
];
const NAV: { id: Page; label: string; hint: string }[] = [
  { id: "radar", label: "Radar agents", hint: "scores 0-100" },
  { id: "donut", label: "Répartition", hint: "tokens absolus" },
  { id: "models", label: "Modèles", hint: "top usage" },
];

function fmt(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
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

function EmptyState() {
  return <div className="visualEmpty">
    <p className="eyebrow">Cockpit visuel</p>
    <h2>Aucune donnée réelle à afficher</h2>
    <p>Importe un log fournisseur ou ajoute une estimation locale : le radar, le donut et la table modèles se rempliront depuis SQLite.</p>
  </div>;
}

function Sidebar({ page, setPage, agents, activeIds, toggleAgent }: { page: Page; setPage: (page: Page) => void; agents: VisualDashboardAgent[]; activeIds: string[]; toggleAgent: (id: string) => void }) {
  const totalTokens = agents.reduce((sum, agent) => sum + agent.donut.reduce((s, item) => s + item.value, 0), 0);
  return <aside className="visualSidebar">
    <div>
      <p className="visualKicker">TorquePilot</p>
      <h2>AI Cockpit</h2>
      <small>{agents.length} agent(s) · {fmt(totalTokens)} tokens mesurés</small>
    </div>
    <nav aria-label="Navigation cockpit">{NAV.map((item) => <button key={item.id} type="button" className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
      <span>{item.label}</span><small>{item.hint}</small>
    </button>)}</nav>
    <div className="visualAgentToggles">
      <p className="visualKicker">Agents affichés</p>
      {agents.map((agent) => {
        const checked = activeIds.includes(agent.id);
        return <button key={agent.id} type="button" className={checked ? "enabled" : "disabled"} onClick={() => toggleAgent(agent.id)} aria-pressed={checked}>
          <i style={{ background: checked ? agent.color : "transparent", borderColor: agent.color }} />
          <span>{agent.name}</span>
        </button>;
      })}
    </div>
  </aside>;
}

function RadarPage({ agents, allAgents }: { agents: VisualDashboardAgent[]; allAgents: VisualDashboardAgent[] }) {
  const cx = 180; const cy = 180; const radius = 126;
  const rings = [0.25, 0.5, 0.75, 1];
  return <section className="visualPanel visualRadarPage">
    <div className="visualHeader"><div><p className="visualKicker">Radar normalisé</p><h2>Comparatif agents</h2></div><span>{agents.length}/{allAgents.length} affiché(s) · 0-100 par maximum observé</span></div>
    <div className="visualRadarGrid">
      <svg viewBox="0 0 360 360" role="img" aria-label="Radar des agents IA">
        {rings.map((ring) => <polygon key={ring} points={RADAR_AXES.map((_, index) => { const p = polar(cx, cy, radius * ring, index, RADAR_AXES.length); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="rgba(255,255,255,.08)" />)}
        {RADAR_AXES.map((axis, index) => { const end = polar(cx, cy, radius, index, RADAR_AXES.length); const label = polar(cx, cy, radius + 28, index, RADAR_AXES.length); return <g key={axis.key}><line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(255,255,255,.1)" /><text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fill="rgba(237,245,255,.75)" fontSize="12">{axis.label}</text></g>; })}
        {agents.map((agent) => <path key={agent.id} d={radarPath(agent, radius, cx, cy)} fill={agent.color} fillOpacity=".12" stroke={agent.color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 14px ${agent.glow})` }} />)}
      </svg>
      <div className="visualLegend">{allAgents.map((agent) => {
        const visible = agents.some((item) => item.id === agent.id);
        return <article key={agent.id} className={visible ? "" : "mutedAgent"}><span style={{ background: visible ? agent.color : "transparent", border: `1px solid ${agent.color}` }} /><div><strong>{agent.name}</strong><small>{visible ? `Input ${agent.radar.input} · Output ${agent.radar.output} · Coût ${agent.radar.cost}` : "masqué du radar"}</small></div></article>;
      })}</div>
    </div>
  </section>;
}

function DonutPage({ agents }: { agents: VisualDashboardAgent[] }) {
  const [selectedId, setSelectedId] = useState(agents[0]?.id ?? "");
  const agent = agents.find((item) => item.id === selectedId) ?? agents[0];
  const segments = agent ? donutStroke(agent) : [];
  const total = agent?.donut.reduce((sum, item) => sum + item.value, 0) ?? 0;
  return <section className="visualPanel">
    <div className="visualHeader"><div><p className="visualKicker">Répartition tokens</p><h2>{agent?.name ?? "Agent"}</h2></div><select value={agent?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <div className="visualDonutGrid">
      <svg viewBox="0 0 220 220" role="img" aria-label="Donut répartition tokens">
        <circle cx="110" cy="110" r="74" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="28" />
        {segments.map((segment) => <circle key={segment.label} cx="110" cy="110" r="74" fill="none" stroke={segment.color} strokeWidth="28" strokeDasharray={segment.dash} strokeDashoffset={segment.offset} pathLength="100" transform="rotate(-90 110 110)" />)}
        <text x="110" y="104" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{fmt(total)}</text>
        <text x="110" y="126" textAnchor="middle" fill="rgba(237,245,255,.65)" fontSize="12">tokens</text>
      </svg>
      <div className="visualLegend">{agent?.donut.map((item) => <article key={item.label}><span style={{ background: item.color }} /><div><strong>{item.label} · {fmt(item.pct)}%</strong><small>{fmt(item.value)} tokens</small></div></article>)}</div>
    </div>
  </section>;
}

function ModelsPage({ agents }: { agents: VisualDashboardAgent[] }) {
  const rows = useMemo(() => agents.flatMap((agent) => agent.models.map((model) => ({ agent: agent.name, color: agent.color, ...model }))).sort((a, b) => b.tokens - a.tokens).slice(0, 16), [agents]);
  return <section className="visualPanel">
    <div className="visualHeader"><div><p className="visualKicker">Modèles réels</p><h2>Top modèles SQLite</h2></div><span>{rows.length} lignes</span></div>
    <div className="visualTable">{rows.map((row) => <article key={`${row.agent}-${row.name}`}>
      <div><span style={{ background: row.color }} /><strong>{row.name}</strong><small>{row.agent}</small></div>
      <p>{fmt(row.tokens)} tok</p><p>{euro(row.cost)}</p><p>{row.sessions} session(s)</p><p>{row.lastUsed || "—"}</p>
    </article>)}</div>
  </section>;
}

export default function VisualDashboard({ agents }: Props) {
  const [page, setPage] = useState<Page>("radar");
  const [activeIds, setActiveIds] = useState<string[]>(() => agents.map((agent) => agent.id));
  const activeAgents = useMemo(() => agents.filter((agent) => activeIds.includes(agent.id)), [agents, activeIds]);
  const toggleAgent = (id: string) => setActiveIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  if (!agents.length) return <section className="visualDashboard"><EmptyState /></section>;
  return <section className="visualDashboard visualDashboardWithMenu">
    <Sidebar page={page} setPage={setPage} agents={agents} activeIds={activeIds} toggleAgent={toggleAgent} />
    <div className="visualContent">
      {page === "radar" && <RadarPage agents={activeAgents} allAgents={agents} />}
      {page === "donut" && <DonutPage agents={activeAgents.length ? activeAgents : agents} />}
      {page === "models" && <ModelsPage agents={activeAgents.length ? activeAgents : agents} />}
    </div>
  </section>;
}
