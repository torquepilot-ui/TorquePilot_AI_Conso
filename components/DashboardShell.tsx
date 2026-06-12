"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { DASHBOARD_NAV_ITEMS, getDashboardNavItem } from "../lib/dashboard-navigation";

export default function DashboardShell({
  children,
  userEmail,
  googleImage,
  googleName,
}: {
  children: ReactNode;
  userEmail?: string;
  googleImage?: string;
  googleName?: string;
}) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const activeItem = useMemo(() => getDashboardNavItem(pathname), [pathname]);

  return <div className="dashboardShell">
    <aside className={`dashboardSidebar ${open ? "open" : ""}`} aria-label="Navigation dashboard">
      <div className="sidebarBrand">
        <span className="brandMark">TP</span>
        <div>
          <strong>TorquePilot</strong>
          <small>AI Conso</small>
        </div>
      </div>
      <nav className="sidebarNav">
        {DASHBOARD_NAV_ITEMS.map((item) => <Link
          key={item.href}
          href={item.href}
          className={`sidebarLink ${activeItem?.href === item.href ? "active" : ""}`}
          onClick={() => setOpen(false)}
        >
          <span className="sidebarIcon">{item.icon}</span>
          <span><strong>{item.label}</strong><small>{item.description}</small></span>
        </Link>)}
      </nav>
      <div className="sidebarFooter">
        <div className="sidebarUser">
          {googleImage
            ? <img src={googleImage} alt="" className="sidebarAvatar" referrerPolicy="no-referrer" />
            : <span className="sidebarAvatarFallback">{(googleName ?? userEmail ?? "?")[0]?.toUpperCase() ?? "?"}</span>}
          <div className="sidebarUserInfo">
            <strong>{googleName ?? userEmail ?? "session"}</strong>
            {googleName && userEmail && <small>{userEmail}</small>}
          </div>
        </div>
        <button className="sidebarLogoutBtn" type="button" onClick={() => signOut({ callbackUrl: "/" })}>
          🚪 Déconnexion
        </button>
      </div>
    </aside>
    <div className="dashboardMain">
      <header className="dashboardTopbar">
        <button className="menuToggle" type="button" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span></span><span></span><span></span>
        </button>
        <div>
          <span className="topbarLabel">Section active</span>
          <strong>{activeItem?.label || "Accueil"}</strong>
        </div>
        <span className="topbarStatus">Live sandbox</span>
      </header>
      {open && <button className="sidebarBackdrop" type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} />}
      {children}
    </div>
  </div>;
}
