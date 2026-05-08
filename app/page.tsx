const stats = [
  { label: "Projets actifs", value: "3", hint: "TorquePilot, T.E.D., Dashboard" },
  { label: "Clients / pistes", value: "0", hint: "À renseigner" },
  { label: "Conso IA mois", value: "—", hint: "À connecter plus tard" },
  { label: "Tâches ouvertes", value: "6", hint: "MVP initial" },
];

const projects = [
  { name: "TorquePilot AI Conso", status: "En setup", owner: "Rudy", next: "Créer le MVP local" },
  { name: "Tamanu Entreprise Digital", status: "Idée validée", owner: "Rudy", next: "Pack commercial + mini-site" },
  { name: "TorquePilot RAG", status: "Existant", owner: "Rudy", next: "Brancher indicateurs plus tard" },
];

const tasks = [
  "Créer structure dashboard",
  "Ajouter stockage SQLite",
  "Créer module clients",
  "Créer module projets",
  "Ajouter suivi consommation IA",
  "Préparer déploiement local Lenovo",
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Dashboard local</p>
          <h1>TorquePilot AI Conso</h1>
          <p className="subtitle">Centre de pilotage simple pour suivre projets, clients, tâches et consommation IA.</p>
        </div>
        <div className="badge">MVP v0.1</div>
      </section>

      <section className="grid stats">
        {stats.map((item) => (
          <article className="card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </article>
        ))}
      </section>

      <section className="layout">
        <article className="panel">
          <h2>Projets</h2>
          <div className="list">
            {projects.map((project) => (
              <div className="row" key={project.name}>
                <div>
                  <h3>{project.name}</h3>
                  <p>Responsable : {project.owner}</p>
                  <p>Prochaine étape : {project.next}</p>
                </div>
                <span className="pill">{project.status}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel">
          <h2>À faire MVP</h2>
          <ul className="tasks">
            {tasks.map((task) => <li key={task}>{task}</li>)}
          </ul>
        </aside>
      </section>
    </main>
  );
}
