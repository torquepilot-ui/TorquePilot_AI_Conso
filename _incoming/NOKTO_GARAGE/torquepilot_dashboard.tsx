import { useState } from "react";

// ─── DATA ───────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: "hermes",
    name: "HERMES",
    color: "#00FFB2",
    glow: "rgba(0,255,178,0.3)",
    radar: { input: 88, output: 42, cache: 71, reasoning: 55, cost: 30, sessions: 95 },
    donut: [
      { label: "Input",     value: 141038966, color: "#00FFB2", pct: 72 },
      { label: "Output",    value: 1349024,   color: "#38B6FF", pct: 4  },
      { label: "Cache",     value: 38500000,  color: "#A78BFA", pct: 20 },
      { label: "Reasoning", value: 8000000,   color: "#FF6B6B", pct: 4  },
    ],
    models: [
      { name: "GPT-5.5 (Codex)",  tokens: 128450000, cost: 0.0000, sessions: 221, lastUsed: "2026-05-20" },
      { name: "GPT-4o",           tokens: 12500000,  cost: 0.0000, sessions: 58,  lastUsed: "2026-05-14" },
      { name: "Qwen 2.5:3b",      tokens: 1437990,   cost: 0.0000, sessions: 18,  lastUsed: "2026-04-30" },
    ],
  },
  {
    id: "bees",
    name: "BEES LAB",
    color: "#38B6FF",
    glow: "rgba(56,182,255,0.3)",
    radar: { input: 12, output: 18, cache: 9, reasoning: 22, cost: 8, sessions: 10 },
    donut: [
      { label: "Input",     value: 420000,  color: "#00FFB2", pct: 72 },
      { label: "Output",    value: 95000,   color: "#38B6FF", pct: 16 },
      { label: "Cache",     value: 50000,   color: "#A78BFA", pct: 9  },
      { label: "Reasoning", value: 17114,   color: "#FF6B6B", pct: 3  },
    ],
    models: [
      { name: "GPT-5.5 (Codex)", tokens: 520000, cost: 0.0000, sessions: 6, lastUsed: "2026-05-18" },
      { name: "Qwen 2.5:3b",     tokens: 62114,  cost: 0.0000, sessions: 2, lastUsed: "2026-05-01" },
    ],
  },
  {
    id: "openclaw",
    name: "OPENCLAW",
    color: "#FF6B6B",
    glow: "rgba(255,107,107,0.3)",
    radar: { input: 45, output: 60, cache: 30, reasoning: 78, cost: 55, sessions: 40 },
    donut: [
      { label: "Input",     value: 8200000, color: "#00FFB2", pct: 60 },
      { label: "Output",    value: 3100000, color: "#38B6FF", pct: 22 },
      { label: "Cache",     value: 1500000, color: "#A78BFA", pct: 11 },
      { label: "Reasoning", value: 900000,  color: "#FF6B6B", pct: 7  },
    ],
    models: [
      { name: "GPT-4o",      tokens: 9800000, cost: 0.0000, sessions: 98,  lastUsed: "2026-05-21" },
      { name: "mistral:7b",  tokens: 3900000, cost: 0.0000, sessions: 22,  lastUsed: "2026-05-10" },
    ],
  },
];

const RADAR_AXES = ["Input", "Output", "Cache", "Reasoning", "Coût", "Sessions"];
const RADAR_KEYS = ["input", "output", "cache", "reasoning", "cost", "sessions"];

const NAV = [
  { id: "radar", label: "Radar",    icon: "⬡" },
  { id: "donut", label: "Répartition", icon: "◎" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function polar(angle, r, cx, cy) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n.toLocaleString("fr-FR");
}

// ─── RADAR CHART ─────────────────────────────────────────────────────────────

function RadarChart({ agents, size = 300 }) {
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.37;
  const n = RADAR_AXES.length;

  const axisAngle = (i) => (360 / n) * i;

  function agentPath(agent) {
    return RADAR_KEYS.map((key, i) => {
      const r = (agent.radar[key] / 100) * maxR;
      const p = polar(axisAngle(i), r, cx, cy);
      return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    }).join(" ") + " Z";
  }

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <defs>
        {agents.map(a => (
          <filter key={a.id} id={`rg-${a.id}`}>
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        ))}
      </defs>

      {/* Grid rings */}
      {[20,40,60,80,100].map(pct => {
        const r = (pct/100)*maxR;
        const d = RADAR_AXES.map((_,i)=>{
          const p = polar(axisAngle(i), r, cx, cy);
          return `${i===0?"M":"L"} ${p.x} ${p.y}`;
        }).join(" ") + " Z";
        return <path key={pct} d={d} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>;
      })}

      {/* Axis lines */}
      {RADAR_AXES.map((_,i) => {
        const p = polar(axisAngle(i), maxR, cx, cy);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>;
      })}

      {/* Agent fills */}
      {agents.map(a => (
        <path key={a.id} d={agentPath(a)}
          fill={a.color} fillOpacity="0.07"
          stroke={a.color} strokeWidth="1.5"
          filter={`url(#rg-${a.id})`}
        />
      ))}

      {/* Dots */}
      {agents.map(a => RADAR_KEYS.map((key,i) => {
        const r = (a.radar[key]/100)*maxR;
        const p = polar(axisAngle(i), r, cx, cy);
        return <circle key={`${a.id}-${key}`} cx={p.x} cy={p.y} r="3.5"
          fill={a.color} filter={`url(#rg-${a.id})`}/>;
      }))}

      {/* Labels */}
      {RADAR_AXES.map((label,i) => {
        const p = polar(axisAngle(i), maxR+26, cx, cy);
        const ang = axisAngle(i);
        const anchor = ang > 10 && ang < 170 ? "start" : ang > 190 && ang < 350 ? "end" : "middle";
        return (
          <text key={label} x={p.x} y={p.y} textAnchor={anchor}
            dominantBaseline="middle" fill="rgba(255,255,255,0.4)"
            fontSize="10" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.06em">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── DONUT CHART ─────────────────────────────────────────────────────────────

function DonutChart({ data, size = 200 }) {
  const cx = size/2, cy = size/2;
  const R = size*0.37, inner = size*0.23;
  let cum = -90;

  function slicePath(pct, start) {
    const ang = (pct/100)*360;
    const end = start + ang;
    const large = ang > 180 ? 1 : 0;
    const s = polar(start, R, cx, cy);
    const e = polar(end, R, cx, cy);
    const si = polar(start, inner, cx, cy);
    const ei = polar(end, inner, cx, cy);
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${inner} ${inner} 0 ${large} 0 ${si.x} ${si.y} Z`;
  }

  const total = data.reduce((s,d) => s+d.value, 0);

  return (
    <svg width={size} height={size}>
      <defs>
        {data.map(d => (
          <filter key={d.label} id={`dg-${d.label}`}>
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        ))}
      </defs>
      {data.map(d => {
        const start = cum;
        cum += (d.pct/100)*360;
        return <path key={d.label} d={slicePath(d.pct, start)}
          fill={d.color} fillOpacity="0.9"
          filter={`url(#dg-${d.label})`}/>;
      })}
      <circle cx={cx} cy={cy} r={inner-1} fill="#0D1117"/>
      <text x={cx} y={cy-9} textAnchor="middle" fill="rgba(255,255,255,0.35)"
        fontSize="9" fontFamily="'JetBrains Mono', monospace">TOKENS</text>
      <text x={cx} y={cy+8} textAnchor="middle" fill="white"
        fontSize="12" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
        {fmt(total)}
      </text>
    </svg>
  );
}

// ─── MODEL TABLE ─────────────────────────────────────────────────────────────

function ModelTable({ models, agentColor }) {
  return (
    <div style={{ width: "100%", marginTop: 4 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 80px 64px 52px 88px",
        gap: "0 8px",
        padding: "6px 12px",
        fontSize: 9,
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.25)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span>MODÈLE</span><span style={{textAlign:"right"}}>TOKENS</span>
        <span style={{textAlign:"right"}}>COÛT</span>
        <span style={{textAlign:"right"}}>SESSION</span>
        <span style={{textAlign:"right"}}>DERNIÈRE</span>
      </div>
      {models.map((m, i) => (
        <div key={m.name} style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 64px 52px 88px",
          gap: "0 8px",
          padding: "10px 12px",
          fontSize: 11,
          borderBottom: i < models.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          transition: "background 0.15s",
          cursor: "default",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{m.name}</span>
          <span style={{ textAlign:"right", color: agentColor, fontWeight: 700 }}>{fmt(m.tokens)}</span>
          <span style={{ textAlign:"right", color: "rgba(255,255,255,0.45)" }}>{m.cost.toFixed(4)}€</span>
          <span style={{ textAlign:"right", color: "rgba(255,255,255,0.45)" }}>{m.sessions}</span>
          <span style={{ textAlign:"right", color: "rgba(255,255,255,0.3)", fontSize:10 }}>{m.lastUsed}</span>
        </div>
      ))}
    </div>
  );
}

// ─── PAGE RADAR ──────────────────────────────────────────────────────────────

function PageRadar() {
  const [active, setActive] = useState(AGENTS.map(a=>a.id));
  const toggle = id => setActive(prev =>
    prev.includes(id) ? prev.length > 1 ? prev.filter(x=>x!==id) : prev : [...prev, id]
  );
  const visible = AGENTS.filter(a => active.includes(a.id));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize:9, letterSpacing:"0.2em", color:"rgba(255,255,255,0.3)", marginBottom:4 }}>
          VUE — COMPARAISON AGENTS
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:"0.04em" }}>Radar Agents</h2>
      </div>

      {/* Chart + toggles */}
      <div style={{
        background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)",
        borderRadius:14, padding:"28px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:20,
      }}>
        {/* Toggle pills */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
          {AGENTS.map(a => (
            <button key={a.id} onClick={() => toggle(a.id)} style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"6px 16px", borderRadius:20,
              border:`1px solid ${active.includes(a.id) ? a.color : "rgba(255,255,255,0.1)"}`,
              background: active.includes(a.id) ? `${a.color}10` : "transparent",
              color: active.includes(a.id) ? a.color : "rgba(255,255,255,0.35)",
              cursor:"pointer", fontSize:11, letterSpacing:"0.08em",
              fontFamily:"'JetBrains Mono', monospace", transition:"all 0.2s",
            }}>
              <span style={{
                width:7, height:7, borderRadius:"50%", background: a.color,
                boxShadow: active.includes(a.id) ? `0 0 8px ${a.color}` : "none",
              }}/>
              {a.name}
            </button>
          ))}
        </div>

        <RadarChart agents={visible} size={300}/>
      </div>

      {/* Per-agent model tables */}
      {AGENTS.map(a => (
        <div key={a.id} style={{
          background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:14, overflow:"hidden",
          opacity: active.includes(a.id) ? 1 : 0.35, transition:"opacity 0.3s",
        }}>
          {/* Agent header */}
          <div style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"14px 16px",
            borderBottom:"1px solid rgba(255,255,255,0.05)",
          }}>
            <span style={{
              width:8, height:8, borderRadius:"50%", background:a.color,
              boxShadow:`0 0 10px ${a.color}`, flexShrink:0,
            }}/>
            <span style={{ fontSize:13, fontWeight:700, color:a.color, letterSpacing:"0.06em" }}>
              {a.name}
            </span>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginLeft:"auto" }}>
              {a.models.length} modèle{a.models.length > 1 ? "s" : ""}
            </span>
          </div>
          <ModelTable models={a.models} agentColor={a.color}/>
        </div>
      ))}
    </div>
  );
}

// ─── PAGE DONUT ──────────────────────────────────────────────────────────────

function PageDonut() {
  const [selectedId, setSelectedId] = useState("hermes");
  const agent = AGENTS.find(a => a.id === selectedId);
  const total = agent.donut.reduce((s,d)=>s+d.value, 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize:9, letterSpacing:"0.2em", color:"rgba(255,255,255,0.3)", marginBottom:4 }}>
          VUE — RÉPARTITION TOKENS
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:"0.04em" }}>Répartition par agent</h2>
      </div>

      {/* Agent selector */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {AGENTS.map(a => (
          <button key={a.id} onClick={() => setSelectedId(a.id)} style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"8px 18px", borderRadius:10,
            border:`1px solid ${selectedId===a.id ? a.color : "rgba(255,255,255,0.08)"}`,
            background: selectedId===a.id ? `${a.color}12` : "rgba(255,255,255,0.02)",
            color: selectedId===a.id ? a.color : "rgba(255,255,255,0.35)",
            cursor:"pointer", fontSize:11, letterSpacing:"0.08em",
            fontFamily:"'JetBrains Mono', monospace", transition:"all 0.2s",
            boxShadow: selectedId===a.id ? `0 0 20px ${a.glow}` : "none",
          }}>
            <span style={{
              width:7, height:7, borderRadius:"50%", background:a.color,
              boxShadow: selectedId===a.id ? `0 0 8px ${a.color}` : "none",
            }}/>
            {a.name}
          </button>
        ))}
      </div>

      {/* Donut + legend */}
      <div style={{
        background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)",
        borderRadius:14, padding:"28px 24px",
        display:"flex", gap:32, alignItems:"center", flexWrap:"wrap",
      }}>
        <DonutChart data={agent.donut} size={200}/>
        <div style={{ flex:1, minWidth:200, display:"flex", flexDirection:"column", gap:14 }}>
          {agent.donut.map(d => (
            <div key={d.label}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"baseline" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{
                    width:7, height:7, borderRadius:"50%", background:d.color,
                    boxShadow:`0 0 6px ${d.color}`, flexShrink:0,
                  }}/>
                  <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em" }}>
                    {d.label}
                  </span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"white" }}>
                    {fmt(d.value)}
                  </span>
                  <span style={{ fontSize:10, color:d.color, marginLeft:8 }}>{d.pct}%</span>
                </div>
              </div>
              <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                <div style={{
                  height:"100%", width:`${d.pct}%`, background:d.color,
                  borderRadius:2, boxShadow:`0 0 8px ${d.color}`,
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model table */}
      <div style={{
        background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)",
        borderRadius:14, overflow:"hidden",
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)",
        }}>
          <span style={{
            width:7, height:7, borderRadius:"50%", background:agent.color,
            boxShadow:`0 0 8px ${agent.color}`,
          }}/>
          <span style={{ fontSize:12, fontWeight:700, color:agent.color, letterSpacing:"0.06em" }}>
            {agent.name}
          </span>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginLeft:"auto" }}>
            Modèles utilisés
          </span>
        </div>
        <ModelTable models={agent.models} agentColor={agent.color}/>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage }) {
  const totalTokens = AGENTS.reduce((s,a) => s + a.models.reduce((m,mod)=>m+mod.tokens,0), 0);

  return (
    <aside style={{
      width: 220, flexShrink:0,
      background:"rgba(255,255,255,0.015)",
      borderRight:"1px solid rgba(255,255,255,0.06)",
      display:"flex", flexDirection:"column",
      minHeight:"100vh", padding:"28px 0",
    }}>
      {/* Logo */}
      <div style={{ padding:"0 20px 28px" }}>
        <div style={{ fontSize:9, letterSpacing:"0.2em", color:"rgba(255,255,255,0.25)", marginBottom:6 }}>
          TORQUEPILOT
        </div>
        <div style={{ fontSize:15, fontWeight:700, letterSpacing:"0.05em", color:"#00FFB2" }}>
          AI CONSO
        </div>
      </div>

      {/* Total tokens badge */}
      <div style={{
        margin:"0 14px 28px",
        padding:"12px 14px",
        background:"rgba(0,255,178,0.05)",
        border:"1px solid rgba(0,255,178,0.15)",
        borderRadius:10,
      }}>
        <div style={{ fontSize:8, letterSpacing:"0.15em", color:"rgba(0,255,178,0.5)", marginBottom:4 }}>
          TOTAL TOKENS
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:"#00FFB2", letterSpacing:"0.04em" }}>
          {fmt(totalTokens)}
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding:"0 10px", display:"flex", flexDirection:"column", gap:4 }}>
        <div style={{ fontSize:8, letterSpacing:"0.15em", color:"rgba(255,255,255,0.2)", padding:"0 10px", marginBottom:8 }}>
          VUES
        </div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"10px 14px", borderRadius:8, border:"none",
            background: page===n.id ? "rgba(0,255,178,0.08)" : "transparent",
            color: page===n.id ? "#00FFB2" : "rgba(255,255,255,0.35)",
            cursor:"pointer", fontFamily:"'JetBrains Mono', monospace",
            fontSize:11, letterSpacing:"0.08em", textAlign:"left",
            transition:"all 0.15s",
            borderLeft: page===n.id ? "2px solid #00FFB2" : "2px solid transparent",
          }}>
            <span style={{ fontSize:15, opacity:0.8 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>

      {/* Agents list */}
      <div style={{ padding:"28px 10px 0", display:"flex", flexDirection:"column", gap:4 }}>
        <div style={{ fontSize:8, letterSpacing:"0.15em", color:"rgba(255,255,255,0.2)", padding:"0 10px", marginBottom:8 }}>
          AGENTS
        </div>
        {AGENTS.map(a => {
          const tok = a.models.reduce((s,m)=>s+m.tokens,0);
          return (
            <div key={a.id} style={{
              padding:"10px 14px", borderRadius:8,
              background:"rgba(255,255,255,0.02)",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <span style={{
                  width:6, height:6, borderRadius:"50%", background:a.color,
                  boxShadow:`0 0 6px ${a.color}`, flexShrink:0,
                }}/>
                <span style={{ fontSize:10, fontWeight:700, color:a.color, letterSpacing:"0.06em" }}>
                  {a.name}
                </span>
              </div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", paddingLeft:14 }}>
                {fmt(tok)} tok
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop:"auto", padding:"20px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", letterSpacing:"0.1em" }}>
          v1.0 — LOCAL
        </div>
      </div>
    </aside>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("radar");

  return (
    <div style={{
      minHeight:"100vh",
      background:"#0A0E1A",
      color:"white",
      fontFamily:"'JetBrains Mono', 'Courier New', monospace",
      display:"flex",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
      `}</style>

      <Sidebar page={page} setPage={setPage}/>

      <main style={{
        flex:1, padding:"36px 40px",
        overflowY:"auto", maxHeight:"100vh",
      }}>
        {page === "radar" && <PageRadar/>}
        {page === "donut" && <PageDonut/>}
      </main>
    </div>
  );
}
