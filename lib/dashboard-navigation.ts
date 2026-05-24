export type DashboardNavItem = {
  label: string;
  href: string;
  icon: string;
  description: string;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: "HOME", href: "/", icon: "⌂", description: "Vue générale : santé, fallback live, KPIs et raccourcis." },
  { label: "EXECUTIVE", href: "/executive", icon: "◇", description: "Synthèse décideur : valeur, ROI, risques et recommandations." },
  { label: "PROJETS", href: "/projets", icon: "▦", description: "Création, sélection et pilotage des projets suivis." },
  { label: "AGENTS", href: "/agents", icon: "◈", description: "Agents IA, comptes, modèles et affectations projet." },
  { label: "LOGS", href: "/logs", icon: "≋", description: "Journal redacted : événements fallback, imports et diagnostics." },
  { label: "COLLECTE", href: "/collecte", icon: "⇣", description: "Imports, collecteur local, catalogue IA et rapports historiques." },
  { label: "CONSOMMATION", href: "/consommation", icon: "↗", description: "Tokens, coûts estimés, tendances et répartitions." },
  { label: "ALERTES", href: "/alertes", icon: "!", description: "Surveillance : fallback fréquent, budget, fraîcheur et erreurs." },
  { label: "PARAMÈTRES", href: "/parametres", icon: "⚙", description: "Seuils, prix modèles, devise et préférences non sensibles." },
];

export function getDashboardNavItem(pathname: string) {
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return DASHBOARD_NAV_ITEMS.find((item) => {
    const itemPath = item.href.replace(/\/$/, "") || "/";
    return itemPath === "/" ? cleanPath === "/" : cleanPath === itemPath || cleanPath.startsWith(`${itemPath}/`);
  });
}
