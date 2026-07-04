# Suivi Projet — TorquePilot AI Conso

> Dernière mise à jour : 13 juin 2026
> Projet : Dashboard SaaS TorquePilot AI Conso
> Objectif : Permettre à un client TPME de créer un agent IA, choisir son provider, payer, et déployer.

---

## Avancement global : ~35%

| # | Phase | Statut | Date |
|---|---|---|---|
| 1 | 🔐 Auth Gmail (NextAuth v5) | ✅ Terminé | Juin 2026 |
| 2 | 🤖 Création agent + test API | ✅ Terminé | 13/06/2026 |
| 3 | 💳 Paiement Stripe | ⏳ À faire | — |
| 4 | 🚀 Déploiement agent Hermes | ⏳ À faire | — |
| 5 | 📊 Stats / logs temps réel | ⏳ À faire | — |
| 6 | 🎨 UX onboarding + avertissements | ⏳ À faire | — |

---

## Détails techniques

- **Repo** : `torquepilot-ui/TorquePilot_AI_Conso` (branche `rudy-sandbox-preview`)
- **URL** : `http://192-168-1-50.nip.io:3026`
- **Auth** : Google OAuth mode Test, compte `torquepilot34@gmail.com`
- **Hébergement** : Lenovo local (`/home/torquepilot/projects/TorquePilot_AI_Conso_rudy-sandbox`)
- **DB** : SQLite locale (`data/torquepilot.db`)
- **Providers supportés** : DeepSeek, OpenRouter

---

## Correctifs appliqués (13/06/2026)

- `next.config.mjs` : `allowedDevOrigins` pour HMR WebSocket distant
- `app/page.tsx` : fin boucle de redirection → formulaire OAuth
- `components/DashboardSectionPage.tsx` : clés React uniques (title + index)
- `app/agents/page.tsx` : bouton « + Nouvel agent » → `/agents/new`

---

## Prochaine étape

**Phase 3 — Stripe** : intégration paiement, page checkout, webhook activation agent.
