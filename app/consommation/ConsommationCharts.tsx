"use client";

import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

type DayPoint = { date: string; totalTokens: number; costEur: number };
type ModelRow = { name: string; totalTokens: number; costEur: number };

const TOOLTIP_STYLE = {
  background: "#101b2e",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  color: "#edf5ff",
  fontSize: 12,
};
const TICK_STYLE = { fontSize: 11, fill: "#9db0c8" };
const GRID_COLOR = "rgba(255,255,255,0.06)";

export function ConsommationLineChart({ daily }: { daily: DayPoint[] }) {
  if (!daily.length) return <p className="muted">Aucun point temporel pour cette période.</p>;
  return (
    <div className="rechartsWrapper">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="date" tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v).toLocaleString("fr-FR") + " tok", "Tokens"]} />
          <Line type="monotone" dataKey="totalTokens" stroke="#35d0a7" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#35d0a7" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConsommationModelChart({ models }: { models: ModelRow[] }) {
  if (!models.length) return <p className="muted">Aucun modèle détecté.</p>;
  const data = models.slice(0, 6).map((m) => ({ name: m.name.length > 18 ? m.name.slice(0, 17) + "…" : m.name, tokens: m.totalTokens, cost: m.costEur }));
  return (
    <div className="rechartsWrapper">
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
          <XAxis type="number" tick={TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <YAxis type="category" dataKey="name" tick={TICK_STYLE} tickLine={false} axisLine={false} width={110} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v).toLocaleString("fr-FR") + " tok", "Tokens"]} />
          <Bar dataKey="tokens" fill="#4aa3ff" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
