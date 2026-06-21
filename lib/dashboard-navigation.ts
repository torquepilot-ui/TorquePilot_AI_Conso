export type DashboardNavItem = {
  label: string;
  href: string;
  icon: string;
  description: string;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "Accueil", href: "/", icon: "🏠", description: "KPIs budget, coût du mois et statut global." },
  { label: "Consommation", href: "/consommation", icon: "📊", description: "Tokens, coûts estimés, tendances et graphiques." },
  { label: "Collecte", href: "/collecte", icon: "📥", description: "Imports, collecteur local et rapports historiques." },
  { label: "Agents", href: "/agents", icon: "🤖", description: "Comptes IA, modèles et affectations projet." },
  { label: "Projets", href: "/projets", icon: "📁", description: "Création, sélection et pilotage des projets." },
  { label: "Alertes", href: "/alertes", icon: "🔔", description: "Surveillance budget, fallback fréquent et erreurs." },
  { label: "Logs", href: "/logs", icon: "📋", description: "Journal : imports, événements fallback, diagnostics." },
  { label: "Paramètres", href: "/parametres", icon: "⚙️", description: "Profil Google, seuil budget et préférences." },
];

export function getDashboardNavItem(pathname: string) {
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return DASHBOARD_NAV_ITEMS.find((item) => {
    const itemPath = item.href.replace(/\/$/, "") || "/";
    return itemPath === "/" ? cleanPath === "/" : cleanPath === itemPath || cleanPath.startsWith(`${itemPath}/`);
  });
}
