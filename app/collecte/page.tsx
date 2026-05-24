import { redirect } from "next/navigation";
import DashboardSectionPage from "../../components/DashboardSectionPage";
import { currentUserId, deleteSavedReportAction, importInboxAction, importUsageAction } from "../actions";
import { DB_PATH, USAGE_INBOX_DIR, USAGE_REPORTS_DIR, getUsageCollectorHealth, getUserById, listDashboardData, listSavedUsageReports, normalizeUsageTimeRange, previewUsageInbox } from "../../lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function euro(value: number) { return `${value.toFixed(4)} €`; }
function price(value: number | null) { return value == null ? "à préciser" : `${value} €/M tok`; }
function categoryLabel(value: string) {
  const labels: Record<string, string> = { text: "Texte", image: "Image", search: "Recherche", tts: "TTS", stt: "STT", local: "Local" };
  return labels[value] || value;
}
function connectionLabel(value: string) { return value === "api" ? "API" : value === "local" ? "Local" : "Abonnement"; }
function costBadge(costEur: number, estimatedCostEur: number) {
  if (costEur > 0) return `facturé ${euro(costEur)}`;
  if (estimatedCostEur > 0) return `estimé ${euro(estimatedCostEur)}`;
  return "0,00 €";
}

function fileSize(bytes: number) { return bytes < 1024 ? `${bytes} o` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`; }
function shortDate(value: string) { return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); }
function modelPriceDetail(model: { inputPricePerMillion: number | null; outputPricePerMillion: number | null; imagePrice?: number | null; pricingUnit?: string }) {
  const base = `Input ${price(model.inputPricePerMillion)} · Output ${price(model.outputPricePerMillion)}`;
  if (model.imagePrice != null) return `${base} · Image ${model.imagePrice} €/unité`;
  if (model.pricingUnit === "audio_minute") return `${base} · Audio/min`;
  if (model.pricingUnit === "character") return `${base} · Caractères`;
  if (model.pricingUnit === "local") return "Local · coût API 0 €";
  return base;
}
function collecteHref(projectId: number | undefined | null, range: string, page?: number) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", String(projectId));
  if (range !== "all") params.set("range", range);
  if (page && Number.isFinite(page) && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/collecte?${query}` : "/collecte";
}

function safePositiveInteger(value: string | undefined, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

const connectorOptions = [
  ["generic", "Auto générique JSON/JSONL"],
  ["openai", "OpenAI Responses/ChatCompletions"],
  ["anthropic", "Anthropic Claude Messages"],
  ["google", "Google Gemini usageMetadata"],
  ["ollama", "Ollama local prompt_eval/eval"],
  ["local", "Local JSONL générique coût 0 €"],
];

export default async function CollectePage({ searchParams }: { searchParams?: Promise<{ project?: string; page?: string; range?: string }> }) {
  const params = await searchParams;
  const userId = await currentUserId();
  const user = userId ? getUserById(DB_PATH, userId) : null;
  if (!user) redirect("/");

  const selectedProjectId = params?.project ? safePositiveInteger(params.project, 0) : undefined;
  const page = safePositiveInteger(params?.page, 1);
  const timeRange = normalizeUsageTimeRange(params?.range);
  const data = listDashboardData(DB_PATH, user.id, selectedProjectId, page, timeRange);
  const selectedProject = data.selectedProject;
  const collectorHealth = getUsageCollectorHealth(DB_PATH, user.id, USAGE_INBOX_DIR);
  const collectorPreview = previewUsageInbox(USAGE_INBOX_DIR);
  const savedReports = listSavedUsageReports(USAGE_REPORTS_DIR);
  const categoryCounts = data.models.reduce<Record<string, number>>((acc, model) => { acc[model.category] = (acc[model.category] || 0) + 1; return acc; }, {});

  return <DashboardSectionPage userEmail={user.email} eyebrow="Collecte & catalogue" title="Collecte" description="Une section unique pour importer les usages, consulter le catalogue IA et générer les rapports historiques sans surcharger HOME." cards={[
    { title: String(data.models.length), body: "modèles dans le catalogue local", status: "Catalogue" },
    { title: String(collectorPreview.totals.readyFiles), body: "fichier(s) prêts dans l’inbox locale", status: "Collecteur" },
    { title: String(savedReports.length), body: "rapports déjà sauvegardés", status: "Rapports" },
  ]}>
    <section className="layout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Projet de travail</p><h2>{selectedProject ? selectedProject.name : "Aucun projet"}</h2></div><span className="pill">{data.projects.length} projet(s)</span></div>
        <p className="muted">Choisis le projet qui recevra les imports. Les liens ci-dessous gardent la section Collecte active pour éviter de revenir sur HOME.</p>
        <div className="projectTabs">{data.projects.length ? data.projects.map((p) => <a className={`tab ${p.id === selectedProject?.id ? "active" : ""}`} href={collecteHref(p.id, timeRange)} key={p.id}><strong>{p.name}</strong><small>{p.description || "Sans description"}</small></a>) : <p className="muted">Ajoute d’abord un projet depuis HOME ou PROJETS.</p>}</div>
      </article>
      <aside className="panel"><h2>Catalogue IA automatique</h2><p className="muted">Catalogue local : {data.models.length} modèles · {Object.entries(categoryCounts).map(([cat, count]) => `${categoryLabel(cat)} ${count}`).join(" · ")}</p><ul className="tasks">{data.models.slice(0, 14).map((m) => <li key={m.id}><span>{m.providerName} · {categoryLabel(m.category)}</span><strong>{m.name}</strong><small>{modelPriceDetail(m)}</small></li>)}</ul></aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel"><div className="sectionHeader"><div><p className="eyebrow">Collecte automatique Phase 4C</p><h2>Connecteurs fournisseur/local</h2></div></div>
        {selectedProject && data.projectAiSetups.length ? <form action={importUsageAction} className="usageForm">
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <input type="hidden" name="returnTo" value={collecteHref(selectedProject.id, timeRange, data.usagePage)} />
          <label>Configuration IA<select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label} — {connectionLabel(s.connectionType)}</option>)}</select></label>
          <label>Connecteur réel<select name="connector" defaultValue="generic">{connectorOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Source fichier/log<input name="sourceName" placeholder="Ex: usage-openai-2026-05-09.jsonl, ollama.log" defaultValue="Import connecteur" /></label>
          <label>Export JSON / JSONL / log local<textarea name="rawExport" placeholder={'OpenAI: {"id":"resp_...","created_at":1778323200,"usage":{"input_tokens":1200,"output_tokens":350}}\nAnthropic: {"id":"msg_...","usage":{"input_tokens":900,"output_tokens":240}}\nGemini: {"responseId":"...","usageMetadata":{"promptTokenCount":600,"candidatesTokenCount":250}}\nOllama: {"model":"llama3.1","prompt_eval_count":500,"eval_count":125}'} rows={9} required></textarea></label>
          <label>Date par défaut<input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <button>Importer via connecteur</button>
          <p className="muted">Sans clé API : on colle ou charge un export/log existant. Le connecteur normalise les champs fournisseur, calcule le coût API via le modèle affecté et force le coût à 0 € pour Ollama/local.</p>
        </form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
      </article>
      <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Collecteur local Phase 4I</p><h2>Import guidé</h2></div><span className="pill">{collectorPreview.totals.readyFiles ? `${collectorPreview.totals.readyFiles} prêt(s)` : "OK"}</span></div>
        <div className="grid stats"><article className="card"><span>Inbox</span><strong>{collectorHealth.pendingFiles}</strong><small>fichiers en attente</small></article><article className="card"><span>Détectés</span><strong>{collectorPreview.totals.detectedCount}</strong><small>{collectorPreview.totals.totalTokens.toLocaleString("fr-FR")} tokens</small></article><article className="card"><span>Erreurs</span><strong>{collectorPreview.totals.failedFiles}</strong><small>avant import</small></article></div>
        <p className="muted">Dépose tes fichiers dans <code>{collectorHealth.rootDir}</code>, sous <code>openai|anthropic|google|ollama|local|generic/inbox</code>. L’aperçu lit sans déplacer ; l’import archive ensuite vers processed/failed.</p>
        <details className="row compact"><summary><div><h3>Dossiers acceptés</h3><p>{collectorPreview.folders.join(" · ")}</p></div><span className="pill">JSON/JSONL/log/txt</span></summary><p className="muted">Aucune clé API demandée : uniquement fichiers ou logs locaux déjà présents sur le Lenovo.</p></details>
        <div className="list">{collectorPreview.files.length ? collectorPreview.files.map((file) => <div className="row compact" key={file.sourcePath}><div><h3>{file.connector} · {file.fileName}</h3><p>{file.status === "ready" ? `${file.detectedCount} ligne(s) · ${file.totalTokens.toLocaleString("fr-FR")} tok · ${fileSize(file.sizeBytes)}` : file.errorMessage}</p>{file.sampleLabels.length ? <small>{file.sampleLabels.join(" · ")}</small> : null}</div><span className="pill">{file.status === "ready" ? "Prêt" : "À corriger"}</span></div>) : <p className="muted">Aucun fichier dans inbox pour l’instant.</p>}</div>
        {selectedProject && data.projectAiSetups.length ? <form action={importInboxAction} className="inlineForm"><input type="hidden" name="projectId" value={selectedProject.id} /><input type="hidden" name="returnTo" value={collecteHref(selectedProject.id, timeRange, data.usagePage)} /><select name="setupId" required>{data.projectAiSetups.map((s) => <option value={s.id} key={s.id}>{s.label}</option>)}</select><input name="usedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /><button>Importer fichiers prêts</button></form> : <p className="muted">Affecte d’abord un compte IA au projet.</p>}
        <div className="list">{collectorHealth.recentRuns.length ? collectorHealth.recentRuns.map((run) => <div className="row compact" key={run.id}><div><h3>{run.connector} · {run.status === "success" ? "OK" : "Erreur"}</h3><p>{run.sourcePath}</p>{run.errorMessage && <p className="alert">{run.errorMessage}</p>}</div><span className="pill">{run.importedCount} lignes</span></div>) : <p className="muted">Aucun run d’import dossier pour l’instant.</p>}</div>
      </aside>
    </section>

    <section className="layout usageLayout">
      <article className="panel">
        <div className="sectionHeader"><div><p className="eyebrow">Rapport de consommation</p><h2>Historique automatique</h2></div>{selectedProject && <div className="reportActions"><a className="buttonLink" href={`/reports/usage?project=${selectedProject.id}&format=csv`}>Télécharger CSV</a><a className="buttonLink ghostLink" href={`/reports/usage?project=${selectedProject.id}&format=json`}>Sauvegarder JSON</a></div>}</div>
        <p className="muted">Les boutons génèrent un rapport tokens depuis SQLite, le téléchargent et en conservent une copie serveur dans <code>data/usage-reports</code>. Le compteur distingue le coût réellement enregistré et l’estimation théorique quand l’usage vient d’un abonnement ou d’un fallback non facturé dans la ligne brute.</p>
        {data.usageEntries.length ? <div className="metricGrid miniMetrics">
          <div><span>Page affichée</span><strong>{data.usageEntries.reduce((sum, e) => sum + e.totalTokens, 0).toLocaleString("fr-FR")} tok</strong></div>
          <div><span>Coût facturé enregistré</span><strong>{euro(data.usageEntries.reduce((sum, e) => sum + e.costEur, 0))}</strong></div>
          <div><span>Valeur estimée tokens</span><strong>{euro(data.usageEntries.reduce((sum, e) => sum + e.estimatedCostEur, 0))}</strong></div>
        </div> : null}
        <div className="list">{data.usageEntries.length ? data.usageEntries.map((e) => <div className="row compact" key={e.id}><div><h3>{e.label}</h3><p>{e.providerName || "IA"} · {e.modelName || "Modèle"} · {e.usedAt}</p></div><span className="pill">{e.totalTokens.toLocaleString("fr-FR")} tok · in {e.inputTokens.toLocaleString("fr-FR")} · out {e.outputTokens.toLocaleString("fr-FR")} · cache {e.cacheTokens.toLocaleString("fr-FR")} · rais. {e.reasoningTokens.toLocaleString("fr-FR")} · {costBadge(e.costEur, e.estimatedCostEur)}</span></div>) : <p className="muted">Aucun usage collecté pour ce projet.</p>}</div>
        {data.totalUsageEntries > data.usagePageSize && (() => {
          const totalPages = Math.ceil(data.totalUsageEntries / data.usagePageSize);
          const prevHref = data.usagePage > 1 ? collecteHref(selectedProject?.id, timeRange, data.usagePage - 1) : null;
          const nextHref = data.usagePage < totalPages ? collecteHref(selectedProject?.id, timeRange, data.usagePage + 1) : null;
          return <div className="pagination"><span className="muted">Page {data.usagePage}/{totalPages} · {data.totalUsageEntries} entrées</span><div className="paginationLinks">{prevHref ? <a className="buttonLink ghostLink" href={prevHref}>← Précédent</a> : null}{nextHref ? <a className="buttonLink ghostLink" href={nextHref}>Suivant →</a> : null}</div></div>;
        })()}
      </article>
      <aside className="panel"><div className="sectionHeader"><div><p className="eyebrow">Phase 4G</p><h2>Rapports sauvegardés</h2></div><span className="pill">{savedReports.length}</span></div><p className="muted">Retrouve les exports déjà générés, avec téléchargement direct et suppression côté serveur.</p><div className="list">{savedReports.length ? savedReports.map((report) => <div className="row compact reportRow" key={report.fileName}><div><h3>{report.format.toUpperCase()} · {fileSize(report.sizeBytes)}</h3><p>{shortDate(report.createdAt)}</p><small>{report.fileName}</small></div><div className="reportActions reportRowActions"><a className="buttonLink ghostLink" href={`/reports/saved?file=${encodeURIComponent(report.fileName)}`}>Télécharger</a><form action={deleteSavedReportAction}><input type="hidden" name="projectId" value={selectedProject?.id ?? ""} /><input type="hidden" name="returnTo" value={collecteHref(selectedProject?.id, timeRange, data.usagePage)} /><input type="hidden" name="fileName" value={report.fileName} /><button className="danger">Supprimer</button></form></div></div>) : <p className="muted">Aucun rapport sauvegardé. Génère d’abord un CSV ou JSON.</p>}</div></aside>
    </section>
  </DashboardSectionPage>;
}
