import type { ReactNode } from "react";
import DashboardShell from "./DashboardShell";

export default function DashboardSectionPage({
  userEmail,
  eyebrow,
  title,
  description,
  cards,
  children,
}: {
  userEmail?: string;
  eyebrow: string;
  title: string;
  description: string;
  cards: { title: string; body: string; status: string }[];
  children?: ReactNode;
}) {
  return <DashboardShell userEmail={userEmail}>
    <main className="shell dashboardContent">
      <section className="hero compactHero">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subtitle">{description}</p></div>
        <span className="badge">Section dédiée</span>
      </section>
      <section className="grid sectionCards">
         {cards.map((card, i) => <article className="card sectionCard" key={`${card.title}-${i}`}>
          <span>{card.status}</span>
          <strong>{card.title}</strong>
          <small>{card.body}</small>
        </article>)}
      </section>
      {children ?? <section className="panel">
        <p className="eyebrow">Transition UX</p>
        <h2>Migration progressive sans casser l’existant</h2>
        <p className="muted">Cette page est prête dans la navigation. Les blocs actuels restent disponibles sur HOME et seront déplacés ici progressivement avec tests à chaque étape.</p>
      </section>}
    </main>
  </DashboardShell>;
}
