# HERMES — Mission : Intégration Dashboard Visuel

**Projet : TorquePilot AI Conso**
**Fichier source : `torquepilot_dashboard.jsx`**
**Date : 2026-05-21**

-----

## Contexte

Un nouveau composant React a été créé pour remplacer l’affichage actuel du dashboard.
Il contient deux vues complètes avec une sidebar de navigation fixe.
Tu dois l’intégrer dans le projet Next.js existant sur le Lenovo, en branchant les vraies données SQLite à la place des données mockées.

-----

## Ce qui a été créé

### Fichier à intégrer

```
torquepilot_dashboard.jsx
```

Chemin cible recommandé dans le projet Next.js :

```
components/Dashboard.jsx
```

### Architecture du composant

Le composant est un fichier React autonome (`export default App`) qui contient :

```
App (root)
├── Sidebar (fixe gauche, 220px)
│   ├── Logo + label "AI CONSO"
│   ├── Badge total tokens global
│   ├── Navigation : Radar / Répartition
│   └── Liste agents avec conso résumée
│
├── PageRadar
│   ├── Toggle pills par agent (HERMES / BEES LAB / OPENCLAW)
│   ├── RadarChart SVG interactif (6 axes)
│   └── ModelTable par agent (nom / tokens / coût / sessions / dernière utilisation)
│
└── PageDonut
    ├── Sélecteur agent (pills)
    ├── DonutChart SVG (Input / Output / Cache / Reasoning)
    ├── Légende avec barres de progression
    └── ModelTable de l'agent sélectionné
```

### Design

- Fond : `#0A0E1A` (dark navy)
- Font : JetBrains Mono (Google Fonts, déjà chargé dans le composant)
- Couleurs agents : HERMES `#00FFB2` / BEES LAB `#38B6FF` / OPENCLAW `#FF6B6B`
- Pas de dépendances externes — SVG natif, pas de recharts ni d3

-----

## Structure des données mockées à remplacer

Les données sont définies en haut du fichier dans le tableau `AGENTS`.
C’est **le seul endroit à modifier** pour brancher les vraies données.

### Structure exacte attendue par agent

```javascript
{
  id: "hermes",           // identifiant unique snake_case
  name: "HERMES",         // nom affiché
  color: "#00FFB2",       // couleur hex
  glow: "rgba(0,255,178,0.3)",  // même couleur en rgba pour les effets

  // Données radar — valeurs normalisées 0-100 (pas les vrais tokens)
  radar: {
    input: 88,       // % relatif par rapport au max observé
    output: 42,
    cache: 71,
    reasoning: 55,
    cost: 30,
    sessions: 95,
  },

  // Données donut — valeurs absolues en tokens
  donut: [
    { label: "Input",     value: 141038966, color: "#00FFB2", pct: 72 },
    { label: "Output",    value: 1349024,   color: "#38B6FF", pct: 4  },
    { label: "Cache",     value: 38500000,  color: "#A78BFA", pct: 20 },
    { label: "Reasoning", value: 8000000,   color: "#FF6B6B", pct: 4  },
  ],

  // Modèles utilisés par cet agent
  models: [
    {
      name: "GPT-5.5 (Codex)",
      tokens: 128450000,    // total tokens consommés par ce modèle
      cost: 0.0000,         // coût réel en euros
      sessions: 221,        // nombre de sessions
      lastUsed: "2026-05-20"  // format YYYY-MM-DD
    },
  ],
}
```

-----

## Requêtes SQLite à implémenter

### 1. Total tokens par agent et par modèle

```sql
SELECT
  agent_id,
  model,
  SUM(input_tokens)     AS input,
  SUM(output_tokens)    AS output,
  SUM(cache_tokens)     AS cache,
  SUM(reasoning_tokens) AS reasoning,
  SUM(total_tokens)     AS total,
  SUM(cost_eur)         AS cost,
  COUNT(*)              AS sessions,
  MAX(date)             AS last_used
FROM usage_log
GROUP BY agent_id, model
ORDER BY agent_id, total DESC;
```

### 2. Répartition donut par agent

```sql
SELECT
  agent_id,
  SUM(input_tokens)     AS input,
  SUM(output_tokens)    AS output,
  SUM(cache_tokens)     AS cache,
  SUM(reasoning_tokens) AS reasoning
FROM usage_log
GROUP BY agent_id;
```

### 3. Normalisation radar (0-100)

Les valeurs radar ne sont **pas** les tokens bruts — ce sont des pourcentages relatifs au maximum observé sur tous les agents. À calculer côté API :

```javascript
// Exemple de normalisation
const maxInput = Math.max(...agents.map(a => a.totalInput));
agent.radar.input = Math.round((agent.totalInput / maxInput) * 100);
```

-----

## API Route à créer

### Fichier : `pages/api/agents.js` (ou `app/api/agents/route.js` si App Router)

```javascript
import Database from 'better-sqlite3';
import path from 'path';

export default function handler(req, res) {
  const db = new Database(path.join(process.cwd(), 'state.db'));

  // 1. Récupérer les données brutes
  const rows = db.prepare(`
    SELECT
      agent_id, model,
      SUM(input_tokens) as input,
      SUM(output_tokens) as output,
      SUM(cache_tokens) as cache,
      SUM(reasoning_tokens) as reasoning,
      SUM(total_tokens) as total,
      SUM(cost_eur) as cost,
      COUNT(*) as sessions,
      MAX(date) as last_used
    FROM usage_log
    GROUP BY agent_id, model
    ORDER BY agent_id, total DESC
  `).all();

  // 2. Grouper par agent
  // 3. Calculer les pourcentages donut
  // 4. Normaliser les valeurs radar
  // 5. Retourner le tableau AGENTS formaté

  res.json({ agents: formattedAgents });
}
```

-----

## Intégration dans la page Next.js

### Option A — Page dédiée

Créer `pages/dashboard.jsx` :

```javascript
import { useEffect, useState } from 'react';
import Dashboard from '../components/Dashboard';

export default function DashboardPage() {
  const [agents, setAgents] = useState(null);

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => setAgents(d.agents));
  }, []);

  if (!agents) return <div>Chargement...</div>;
  return <Dashboard agents={agents} />;
}
```

### Option B — Remplacer la page existante

Si le dashboard actuel est dans `pages/index.jsx`, remplacer le composant d’affichage par `<Dashboard agents={agents}/>`.

-----

## Adaptation du composant

Le composant actuel utilise des données statiques en haut du fichier.
Pour le rendre dynamique, modifier la signature :

```javascript
// Avant (données mockées internes)
export default function App() { ... }

// Après (données injectées depuis l'API)
export default function Dashboard({ agents }) { ... }
```

Et remplacer la constante `AGENTS` en haut du fichier par la prop `agents`.

-----

## Points d’attention

- **Ne pas modifier OPENCLAW** — ce projet tourne en production sur le Lenovo, paper_trading actif
- **Les noms de colonnes SQLite** (`input_tokens`, `output_tokens`, etc.) sont à adapter selon le vrai schéma de `state.db` — vérifier avec `.schema usage_log` avant d’écrire les requêtes
- **Le radar attend des valeurs 0-100** — ne pas injecter les tokens bruts directement
- **Le donut attend des valeurs absolues** en tokens + un `pct` calculé (arrondi à l’entier)
- **`lastUsed`** doit être au format `YYYY-MM-DD` (string)
- **`cost`** doit être un float en euros avec 4 décimales

-----

## Vérification finale

Une fois intégré, vérifier que :

- [ ] La sidebar affiche le bon total global
- [ ] Le radar toggle correctement par agent
- [ ] Le donut change bien quand on sélectionne un agent différent
- [ ] Les tableaux modèles affichent les vraies valeurs de la DB
- [ ] Le dashboard est accessible via VPN WireGuard depuis l’iPhone

-----

*TorquePilot AI Conso — Intégration Dashboard V1 — 2026-05-21*