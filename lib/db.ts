import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { MODEL_CATALOG, type ModelCategory } from "./model-catalog.ts";

export type User = { id: number; email: string; passwordHash: string };
export type Project = { id: number; name: string; description: string | null; ownerUserId: number };
export type Provider = { id: number; name: string; kind: string };
export type Model = {
  id: number;
  providerId: number;
  providerName: string;
  name: string;
  apiModelId: string | null;
  category: ModelCategory;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  imagePrice: number | null;
  pricingUnit: string;
  description: string | null;
  source: string | null;
};
export type ConnectionType = "subscription" | "api" | "local";
export type AiAccount = {
  id: number;
  userId: number;
  providerId: number | null;
  providerName: string | null;
  name: string;
  connectionType: ConnectionType;
  subscriptionName: string | null;
  monthlyCostEur: number;
  notes: string | null;
};
export type ProjectAiSetup = {
  id: number;
  projectId: number;
  projectName: string;
  accountId: number;
  accountName: string;
  providerName: string | null;
  modelId: number | null;
  modelName: string | null;
  connectionType: ConnectionType;
  subscriptionName: string | null;
  monthlyCostEur: number;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  label: string;
};
export type UsageEntry = {
  id: number;
  projectId: number;
  projectName: string;
  modelId: number | null;
  modelName: string | null;
  providerName: string | null;
  label: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costEur: number;
  estimatedCostEur: number;
  usedAt: string;
};
export type UsageInput = { projectId: number; modelId?: number | null; label: string; inputTokens: number; outputTokens: number; cacheTokens?: number; reasoningTokens?: number; costEur: number; usedAt?: string };
export type AiAccountInput = { providerId?: number | null; name: string; connectionType: ConnectionType; subscriptionName?: string; monthlyCostEur?: number; notes?: string };
export type ProjectAiSetupInput = { projectId: number; accountId: number; modelId?: number | null; connectionType?: ConnectionType; label?: string; inputPricePerMillion?: number | null; outputPricePerMillion?: number | null };
export type EstimateInput = { projectId: number; setupId: number; label: string; inputText: string; outputText: string; inputTokens?: number; outputTokens?: number; cacheTokens?: number; reasoningTokens?: number; usedAt?: string };
export type AutomaticUsageImportInput = { projectId: number; setupId: number; sourceName: string; rawExport: string; usedAt?: string };
export type UsageConnector = "generic" | "openai" | "anthropic" | "google" | "ollama" | "local";
export type ConnectorUsageImportInput = AutomaticUsageImportInput & { connector: UsageConnector };
export type AutomaticUsageImportResult = { importedCount: number; totalInputTokens: number; totalOutputTokens: number; totalCostEur: number; entries: UsageEntry[] };
export type UsageInboxImportInput = { rootDir: string; projectId: number; setupId: number; usedAt?: string };
export type UsageImportRun = { id: number; userId: number; projectId: number; setupId: number; connector: UsageConnector; sourcePath: string; status: "success" | "failed"; importedCount: number; errorMessage: string | null; createdAt: string };
export type UsageInboxImportResult = AutomaticUsageImportResult & { processedFiles: number; failedFiles: number; runs: UsageImportRun[] };
export type UsageCollectorHealth = { rootDir: string; pendingFiles: number; processedFiles: number; failedFiles: number; lastRun: UsageImportRun | null; recentRuns: UsageImportRun[] };
export type UsageInboxPreviewFile = { connector: UsageConnector; fileName: string; sourcePath: string; sizeBytes: number; status: "ready" | "failed"; detectedCount: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; sampleLabels: string[]; errorMessage: string | null };
export type UsageInboxPreview = { rootDir: string; folders: string[]; files: UsageInboxPreviewFile[]; totals: { files: number; readyFiles: number; failedFiles: number; detectedCount: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number } };
export type UsageReportFormat = "csv" | "json";
export type UsageReport = { projectId: number; projectName: string; generatedAt: string; format: UsageReportFormat; mimeType: string; fileName: string; totals: { entries: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number; estimatedCostEur: number }; entries: UsageEntry[]; content: string };
export type SavedUsageReport = UsageReport & { filePath: string };
export type SavedUsageReportSummary = { fileName: string; format: UsageReportFormat; sizeBytes: number; createdAt: string; filePath: string };
export type DownloadedUsageReport = { fileName: string; format: UsageReportFormat; mimeType: string; sizeBytes: number; content: string };
export type UsageChartPoint = { date: string; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number; entries: number; maxRatio: number };
export type UsageChartBreakdown = { name: string; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number; entries: number; maxRatio: number };
export type UsageTimeRange = "24h" | "7d" | "30d" | "all";
export const USAGE_TIME_RANGES: { id: UsageTimeRange; label: string; hint: string }[] = [
  { id: "24h", label: "24h", hint: "dernières 24 heures" },
  { id: "7d", label: "7j", hint: "7 derniers jours" },
  { id: "30d", label: "30j", hint: "30 derniers jours" },
  { id: "all", label: "All-time", hint: "historique complet" },
];
export type UsageChartData = { projectId: number; projectName: string; timeRange: UsageTimeRange; totals: { entries: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number }; daily: UsageChartPoint[]; topProviders: UsageChartBreakdown[]; topModels: UsageChartBreakdown[] };
export type VisualDashboardAgent = {
  id: string;
  name: string;
  color: string;
  glow: string;
  radar: { input: number; output: number; cache: number; reasoning: number; cost: number; sessions: number };
  donut: { label: string; value: number; color: string; pct: number }[];
  models: { name: string; tokens: number; cost: number; sessions: number; lastUsed: string }[];
};
export type VisualDashboardData = { timeRange: UsageTimeRange; agents: VisualDashboardAgent[] };

// Private raw SQLite row types — never exported
type PragmaInfoRow = { name: string };
type RawUserRow = { id: number; email: string; password_hash: string };
type RawProviderIdRow = { id: number };
type RawModelPriceRow = { input_price_per_million: number | null; output_price_per_million: number | null };
type RawAccountDbRow = { id: number; user_id: number; provider_id: number | null; name: string; connection_type: string; subscription_name: string | null; monthly_cost_eur: number; notes: string | null };
type RawSetupProjectRow = { projectId: number };
type RawEntryRow = { id: number; projectId: number; projectName: string; modelId: number | null; modelName: string | null; providerName: string | null; label: string; inputTokens: number; outputTokens: number; cacheTokens?: number | null; reasoningTokens?: number | null; costEur: number; estimatedCostEur?: number | null; usedAt: string };
type RawAccountRow = { id: number; userId: number; providerId: number | null; providerName: string | null; name: string; connectionType: string; subscriptionName: string | null; monthlyCostEur: number; notes: string | null };
type RawSetupRow = { id: number; projectId: number; projectName: string; accountId: number; accountName: string; providerName: string | null; modelId: number | null; modelName: string | null; connectionType: string; subscriptionName: string | null; monthlyCostEur: number; inputPricePerMillion: number | null; outputPricePerMillion: number | null; label: string };
type RawRunRow = { id: number; userId: number; projectId: number; setupId: number; connector: string; sourcePath: string; status: string; importedCount: number; errorMessage: string | null; createdAt: string };
type RawProjectRow = { id: number; name: string };
type RawTotalsRow = { entries: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number };
type RawChartRow = { date: string; entries: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number };
type RawBreakdownRow = { name: string; entries: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number };
type RawVisualAgentRow = { agentName: string; entries: number; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; totalTokens: number; costEur: number; lastUsed: string };
type RawVisualModelRow = { agentName: string; modelName: string; entries: number; tokens: number; costEur: number; lastUsed: string };
type RawUsageSumRow = { tokens: number; cost: number };

// Chars-per-token ratios by provider family for text estimation
const TOKEN_CHARS_BY_PROVIDER: Record<string, number> = {
  Claude: 3.8,
  OpenAI: 4.0,
  Gemini: 3.5,
  Mistral: 3.8,
  DeepSeek: 3.5,
  Grok: 4.0,
  "Z.ai": 3.5,
  OpenRouter: 4.0,
};

const defaultDbPath = join(process.cwd(), "data", "torquepilot.sqlite");
const defaultUsageInboxDir = join(process.cwd(), "data", "usage-inbox");
const defaultUsageReportsDir = join(process.cwd(), "data", "usage-reports");

function open(dbPath = defaultDbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  return new DatabaseSync(dbPath);
}

function columnExists(db: DatabaseSync, table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as PragmaInfoRow[]).some((row) => row.name === column);
}

function migrate(db: DatabaseSync) {
  if (!columnExists(db, "ai_models", "input_price_per_million")) db.exec("ALTER TABLE ai_models ADD COLUMN input_price_per_million REAL");
  if (!columnExists(db, "ai_models", "output_price_per_million")) db.exec("ALTER TABLE ai_models ADD COLUMN output_price_per_million REAL");
  if (!columnExists(db, "ai_models", "api_model_id")) db.exec("ALTER TABLE ai_models ADD COLUMN api_model_id TEXT");
  if (!columnExists(db, "ai_models", "category")) db.exec("ALTER TABLE ai_models ADD COLUMN category TEXT NOT NULL DEFAULT 'text'");
  if (!columnExists(db, "ai_models", "image_price")) db.exec("ALTER TABLE ai_models ADD COLUMN image_price REAL");
  if (!columnExists(db, "ai_models", "pricing_unit")) db.exec("ALTER TABLE ai_models ADD COLUMN pricing_unit TEXT NOT NULL DEFAULT 'token'");
  if (!columnExists(db, "ai_models", "description")) db.exec("ALTER TABLE ai_models ADD COLUMN description TEXT");
  if (!columnExists(db, "ai_models", "source")) db.exec("ALTER TABLE ai_models ADD COLUMN source TEXT");
  if (!columnExists(db, "ai_usage_entries", "account_id")) db.exec("ALTER TABLE ai_usage_entries ADD COLUMN account_id INTEGER REFERENCES ai_accounts(id)");
  if (!columnExists(db, "ai_usage_entries", "setup_id")) db.exec("ALTER TABLE ai_usage_entries ADD COLUMN setup_id INTEGER REFERENCES project_ai_setups(id)");
  if (!columnExists(db, "ai_usage_entries", "estimation_method")) db.exec("ALTER TABLE ai_usage_entries ADD COLUMN estimation_method TEXT");
  if (!columnExists(db, "ai_usage_entries", "cache_tokens")) db.exec("ALTER TABLE ai_usage_entries ADD COLUMN cache_tokens INTEGER NOT NULL DEFAULT 0");
  if (!columnExists(db, "ai_usage_entries", "reasoning_tokens")) db.exec("ALTER TABLE ai_usage_entries ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0");
}

export function initDb(dbPath = defaultDbPath) {
  const db = open(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, owner_user_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS project_members (project_id INTEGER NOT NULL REFERENCES projects(id), user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL DEFAULT 'owner', PRIMARY KEY(project_id, user_id));
    CREATE TABLE IF NOT EXISTS ai_providers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL DEFAULT 'manual');
    CREATE TABLE IF NOT EXISTS ai_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL REFERENCES ai_providers(id),
      name TEXT NOT NULL,
      api_model_id TEXT,
      category TEXT NOT NULL DEFAULT 'text',
      input_price_per_million REAL,
      output_price_per_million REAL,
      image_price REAL,
      pricing_unit TEXT NOT NULL DEFAULT 'token',
      description TEXT,
      source TEXT,
      UNIQUE(provider_id, name)
    );
    CREATE TABLE IF NOT EXISTS ai_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      provider_id INTEGER REFERENCES ai_providers(id),
      name TEXT NOT NULL,
      connection_type TEXT NOT NULL CHECK(connection_type IN ('subscription','api','local')),
      subscription_name TEXT,
      monthly_cost_eur REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS project_ai_setups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      account_id INTEGER NOT NULL REFERENCES ai_accounts(id),
      model_id INTEGER REFERENCES ai_models(id),
      connection_type TEXT NOT NULL CHECK(connection_type IN ('subscription','api','local')),
      label TEXT NOT NULL,
      input_price_per_million REAL,
      output_price_per_million REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_usage_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      model_id INTEGER REFERENCES ai_models(id),
      account_id INTEGER REFERENCES ai_accounts(id),
      setup_id INTEGER REFERENCES project_ai_setups(id),
      label TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      cost_eur REAL NOT NULL DEFAULT 0,
      estimation_method TEXT,
      used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS usage_import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      setup_id INTEGER NOT NULL REFERENCES project_ai_setups(id),
      connector TEXT NOT NULL,
      source_path TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success','failed')),
      imported_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  migrate(db);
  db.close();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
function checkPassword(password: string, stored: string) {
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
function toNonNegativeInteger(value: number) { const n = Number(value); return !Number.isFinite(n) || n < 0 ? 0 : Math.round(n); }
function toNonNegativeMoney(value: number) { const n = Number(value); return !Number.isFinite(n) || n < 0 ? 0 : Math.round(n * 1000000) / 1000000; }
function toNullableMoney(value: unknown) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000000) / 1000000 : null; }
function normalizeConnectionType(value: string | undefined): ConnectionType { return value === "api" || value === "local" ? value : "subscription"; }
function usageEstimatedCostSql(alias = "e") {
  return `CASE
    WHEN ${alias}.cost_eur > 0 THEN ${alias}.cost_eur
    WHEN coalesce(s.input_price_per_million, m.input_price_per_million) IS NOT NULL AND coalesce(s.output_price_per_million, m.output_price_per_million) IS NOT NULL
      THEN ((CASE WHEN ${alias}.input_tokens > 0 THEN ${alias}.input_tokens ELSE ${alias}.cache_tokens END) / 1000000.0) * coalesce(s.input_price_per_million, m.input_price_per_million)
        + ((CASE WHEN ${alias}.output_tokens > 0 THEN ${alias}.output_tokens ELSE ${alias}.reasoning_tokens END) / 1000000.0) * coalesce(s.output_price_per_million, m.output_price_per_million)
    ELSE 0
  END`;
}

export function estimateTokensFromText(text: string, providerName?: string | null) {
  const clean = text.trim();
  if (!clean) return 0;
  const charsPerToken = (providerName ? TOKEN_CHARS_BY_PROVIDER[providerName] : undefined) ?? 4.0;
  return Math.max(1, Math.ceil(clean.length / charsPerToken));
}

function rowToEntry(row: RawEntryRow): UsageEntry {
  const inputTokens = Number(row.inputTokens ?? 0); const outputTokens = Number(row.outputTokens ?? 0);
  const cacheTokens = Number(row.cacheTokens ?? 0); const reasoningTokens = Number(row.reasoningTokens ?? 0);
  const costEur = Number(row.costEur ?? 0);
  return { id: Number(row.id), projectId: Number(row.projectId), projectName: String(row.projectName), modelId: row.modelId == null ? null : Number(row.modelId), modelName: row.modelName == null ? null : String(row.modelName), providerName: row.providerName == null ? null : String(row.providerName), label: String(row.label), inputTokens, outputTokens, cacheTokens, reasoningTokens, totalTokens: inputTokens + outputTokens, costEur, estimatedCostEur: toNonNegativeMoney(Number(row.estimatedCostEur ?? costEur)), usedAt: String(row.usedAt) };
}
function rowToAccount(row: RawAccountRow): AiAccount {
  return { id: Number(row.id), userId: Number(row.userId), providerId: row.providerId == null ? null : Number(row.providerId), providerName: row.providerName == null ? null : String(row.providerName), name: String(row.name), connectionType: normalizeConnectionType(row.connectionType), subscriptionName: row.subscriptionName == null ? null : String(row.subscriptionName), monthlyCostEur: Number(row.monthlyCostEur ?? 0), notes: row.notes == null ? null : String(row.notes) };
}
function rowToSetup(row: RawSetupRow): ProjectAiSetup {
  return { id: Number(row.id), projectId: Number(row.projectId), projectName: String(row.projectName), accountId: Number(row.accountId), accountName: String(row.accountName), providerName: row.providerName == null ? null : String(row.providerName), modelId: row.modelId == null ? null : Number(row.modelId), modelName: row.modelName == null ? null : String(row.modelName), connectionType: normalizeConnectionType(row.connectionType), subscriptionName: row.subscriptionName == null ? null : String(row.subscriptionName), monthlyCostEur: Number(row.monthlyCostEur ?? 0), inputPricePerMillion: row.inputPricePerMillion == null ? null : Number(row.inputPricePerMillion), outputPricePerMillion: row.outputPricePerMillion == null ? null : Number(row.outputPricePerMillion), label: String(row.label) };
}

export function createUser(dbPath: string, email: string, password: string): User {
  initDb(dbPath); const db = open(dbPath); const normalized = email.trim().toLowerCase(); const passwordHash = hashPassword(password);
  const result = db.prepare("INSERT INTO users(email, password_hash) VALUES (?, ?)").run(normalized, passwordHash);
  db.close(); return { id: Number(result.lastInsertRowid), email: normalized, passwordHash };
}
export function verifyUser(dbPath: string, email: string, password: string): User | null {
  initDb(dbPath); const db = open(dbPath); const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase()) as RawUserRow | undefined; db.close();
  return row && checkPassword(password, row.password_hash) ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}
export function getUserById(dbPath: string, userId: number): User | null {
  initDb(dbPath); const db = open(dbPath); const row = db.prepare("SELECT id, email, password_hash FROM users WHERE id = ?").get(userId) as RawUserRow | undefined; db.close();
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}
export function createProject(dbPath: string, userId: number, name: string, description = ""): Project {
  initDb(dbPath); const db = open(dbPath); const result = db.prepare("INSERT INTO projects(name, description, owner_user_id) VALUES (?, ?, ?)").run(name.trim(), description.trim(), userId); const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, 'owner')").run(id, userId); db.close(); return { id, name: name.trim(), description: description.trim(), ownerUserId: userId };
}
export function deleteProject(dbPath: string, userId: number, projectId: number) {
  initDb(dbPath); const db = open(dbPath);
  try {
    const existing = db.prepare("SELECT 1 FROM projects WHERE id = ? AND owner_user_id = ?").get(projectId, userId);
    if (!existing) throw new Error("Projet inconnu");
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM usage_import_runs WHERE project_id = ? AND user_id = ?").run(projectId, userId);
      db.prepare("DELETE FROM ai_usage_entries WHERE project_id = ?").run(projectId);
      db.prepare("DELETE FROM project_ai_setups WHERE project_id = ?").run(projectId);
      db.prepare("DELETE FROM project_members WHERE project_id = ?").run(projectId);
      const result = db.prepare("DELETE FROM projects WHERE id = ? AND owner_user_id = ?").run(projectId, userId);
      db.exec("COMMIT");
      return result.changes > 0;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}
export function userCanAccessProject(dbPath: string, userId: number, projectId: number) {
  initDb(dbPath); const db = open(dbPath); const row = db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, projectId); db.close(); return Boolean(row);
}
export function updateProject(dbPath: string, userId: number, projectId: number, name: string, description: string): Project {
  initDb(dbPath); const db = open(dbPath);
  try {
    const existing = db.prepare("SELECT 1 FROM projects WHERE id = ? AND owner_user_id = ?").get(projectId, userId);
    if (!existing) throw new Error("Projet inconnu");
    const trimmedName = name.trim(); if (!trimmedName) throw new Error("Nom de projet obligatoire");
    db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ? AND owner_user_id = ?").run(trimmedName, description.trim(), projectId, userId);
    return db.prepare("SELECT id, name, description, owner_user_id as ownerUserId FROM projects WHERE id = ?").get(projectId) as Project;
  } finally { db.close(); }
}

const _seededPaths = new Set<string>();

export function seedDefaultProviders(dbPath = defaultDbPath) {
  if (_seededPaths.has(dbPath)) return;
  _seededPaths.add(dbPath);
  initDb(dbPath); const db = open(dbPath);
  try {
    for (const model of MODEL_CATALOG) {
      db.prepare("INSERT OR IGNORE INTO ai_providers(name, kind) VALUES (?, 'catalog')").run(model.providerName);
      const providerRow = db.prepare("SELECT id FROM ai_providers WHERE name = ?").get(model.providerName) as RawProviderIdRow;
      db.prepare(`INSERT OR IGNORE INTO ai_models(provider_id, name, api_model_id, category, input_price_per_million, output_price_per_million, image_price, pricing_unit, description, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(providerRow.id, model.name, model.apiModelId, model.category, model.inputPricePerMillion, model.outputPricePerMillion, model.imagePrice, model.pricingUnit, model.description, model.source);
      db.prepare(`UPDATE ai_models SET
          api_model_id = coalesce(api_model_id, ?),
          category = CASE WHEN category IS NULL OR category = 'text' THEN ? ELSE category END,
          input_price_per_million = coalesce(input_price_per_million, ?),
          output_price_per_million = coalesce(output_price_per_million, ?),
          image_price = coalesce(image_price, ?),
          pricing_unit = CASE WHEN pricing_unit IS NULL OR pricing_unit = 'token' THEN ? ELSE pricing_unit END,
          description = coalesce(description, ?),
          source = coalesce(source, ?)
        WHERE provider_id = ? AND name = ?`)
        .run(model.apiModelId, model.category, model.inputPricePerMillion, model.outputPricePerMillion, model.imagePrice, model.pricingUnit, model.description, model.source, providerRow.id, model.name);
    }
  } finally { db.close(); }
}

export function createAiAccount(dbPath: string, userId: number, input: AiAccountInput): AiAccount {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    const name = input.name.trim(); if (!name) throw new Error("Nom du compte IA obligatoire");
    const connectionType = normalizeConnectionType(input.connectionType);
    const providerId = input.providerId ? Number(input.providerId) : null;
    if (providerId && !db.prepare("SELECT 1 FROM ai_providers WHERE id = ?").get(providerId)) throw new Error("Fournisseur IA inconnu");
    const result = db.prepare(`INSERT INTO ai_accounts(user_id, provider_id, name, connection_type, subscription_name, monthly_cost_eur, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(userId, providerId, name, connectionType, input.subscriptionName?.trim() || null, toNonNegativeMoney(input.monthlyCostEur ?? 0), input.notes?.trim() || null);
    return rowToAccount(db.prepare(`SELECT a.id, a.user_id as userId, a.provider_id as providerId, p.name as providerName, a.name, a.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, a.notes FROM ai_accounts a LEFT JOIN ai_providers p ON p.id = a.provider_id WHERE a.id = ?`).get(Number(result.lastInsertRowid)) as RawAccountRow);
  } finally { db.close(); }
}

export function updateAiAccount(dbPath: string, userId: number, accountId: number, input: Partial<AiAccountInput>): AiAccount {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    const existing = db.prepare("SELECT * FROM ai_accounts WHERE id = ? AND user_id = ?").get(accountId, userId) as RawAccountDbRow | undefined;
    if (!existing) throw new Error("Compte IA inconnu");
    const name = String(input.name ?? existing.name).trim(); if (!name) throw new Error("Nom du compte IA obligatoire");
    const connectionType = normalizeConnectionType(input.connectionType ?? existing.connection_type);
    const providerId = input.providerId === undefined ? existing.provider_id : (input.providerId ? Number(input.providerId) : null);
    if (providerId && !db.prepare("SELECT 1 FROM ai_providers WHERE id = ?").get(providerId)) throw new Error("Fournisseur IA inconnu");
    db.prepare(`UPDATE ai_accounts SET provider_id = ?, name = ?, connection_type = ?, subscription_name = ?, monthly_cost_eur = ?, notes = ? WHERE id = ? AND user_id = ?`)
      .run(providerId, name, connectionType, input.subscriptionName?.trim() || null, toNonNegativeMoney(input.monthlyCostEur ?? existing.monthly_cost_eur ?? 0), input.notes?.trim() || null, accountId, userId);
    return rowToAccount(db.prepare(`SELECT a.id, a.user_id as userId, a.provider_id as providerId, p.name as providerName, a.name, a.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, a.notes FROM ai_accounts a LEFT JOIN ai_providers p ON p.id = a.provider_id WHERE a.id = ? AND a.user_id = ?`).get(accountId, userId) as RawAccountRow);
  } finally { db.close(); }
}

export function deleteAiAccount(dbPath: string, userId: number, accountId: number) {
  initDb(dbPath); const db = open(dbPath);
  try {
    const existing = db.prepare("SELECT 1 FROM ai_accounts WHERE id = ? AND user_id = ?").get(accountId, userId);
    if (!existing) throw new Error("Compte IA inconnu");
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE ai_usage_entries SET account_id = NULL WHERE account_id = ?").run(accountId);
      db.prepare("UPDATE ai_usage_entries SET setup_id = NULL WHERE setup_id IN (SELECT id FROM project_ai_setups WHERE account_id = ?)").run(accountId);
      db.prepare(`DELETE FROM usage_import_runs
        WHERE setup_id IN (SELECT s.id FROM project_ai_setups s JOIN ai_accounts a ON a.id = s.account_id WHERE s.account_id = ? AND a.user_id = ?)`)
        .run(accountId, userId);
      db.prepare("DELETE FROM project_ai_setups WHERE account_id = ? AND account_id IN (SELECT id FROM ai_accounts WHERE user_id = ?)").run(accountId, userId);
      const result = db.prepare("DELETE FROM ai_accounts WHERE id = ? AND user_id = ?").run(accountId, userId);
      db.exec("COMMIT");
      return result.changes > 0;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}

export function assignAiAccountToProject(dbPath: string, userId: number, input: ProjectAiSetupInput): ProjectAiSetup {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const account = db.prepare("SELECT * FROM ai_accounts WHERE id = ? AND user_id = ?").get(input.accountId, userId) as RawAccountDbRow | undefined;
    if (!account) throw new Error("Compte IA inconnu");
    const modelId = input.modelId ? Number(input.modelId) : null;
    const model = modelId ? db.prepare("SELECT input_price_per_million, output_price_per_million FROM ai_models WHERE id = ?").get(modelId) as RawModelPriceRow | null : null;
    if (modelId && !model) throw new Error("Modèle IA inconnu");
    const connectionType = input.connectionType ? normalizeConnectionType(input.connectionType) : normalizeConnectionType(account.connection_type);
    const inputPrice = toNullableMoney(input.inputPricePerMillion ?? model?.input_price_per_million);
    const outputPrice = toNullableMoney(input.outputPricePerMillion ?? model?.output_price_per_million);
    const label = input.label?.trim() || `${account.name} — ${connectionType === "api" ? "API" : connectionType === "local" ? "Local" : "Abonnement"}`;
    const result = db.prepare(`INSERT INTO project_ai_setups(project_id, account_id, model_id, connection_type, label, input_price_per_million, output_price_per_million) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(input.projectId, input.accountId, modelId, connectionType, label, inputPrice, outputPrice);
    return getSetupById(db, Number(result.lastInsertRowid));
  } finally { db.close(); }
}

function getSetupById(db: DatabaseSync, setupId: number): ProjectAiSetup {
  return rowToSetup(db.prepare(`SELECT s.id, s.project_id as projectId, p.name as projectName, s.account_id as accountId, a.name as accountName, pr.name as providerName, s.model_id as modelId, m.name as modelName, s.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, s.input_price_per_million as inputPricePerMillion, s.output_price_per_million as outputPricePerMillion, s.label
    FROM project_ai_setups s JOIN projects p ON p.id = s.project_id JOIN ai_accounts a ON a.id = s.account_id LEFT JOIN ai_providers pr ON pr.id = a.provider_id LEFT JOIN ai_models m ON m.id = s.model_id WHERE s.id = ?`).get(setupId) as RawSetupRow);
}

export function updateProjectAiSetup(dbPath: string, userId: number, setupId: number, input: ProjectAiSetupInput): ProjectAiSetup {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    const current = db.prepare(`SELECT s.* FROM project_ai_setups s JOIN projects p ON p.id = s.project_id JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE s.id = ?`).get(userId, setupId);
    if (!current) throw new Error("Configuration IA inconnue");
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const account = db.prepare("SELECT * FROM ai_accounts WHERE id = ? AND user_id = ?").get(input.accountId, userId) as RawAccountDbRow | undefined;
    if (!account) throw new Error("Compte IA inconnu");
    const modelId = input.modelId ? Number(input.modelId) : null;
    const model = modelId ? db.prepare("SELECT input_price_per_million, output_price_per_million FROM ai_models WHERE id = ?").get(modelId) as RawModelPriceRow | null : null;
    if (modelId && !model) throw new Error("Modèle IA inconnu");
    const connectionType = input.connectionType ? normalizeConnectionType(input.connectionType) : normalizeConnectionType(account.connection_type);
    const inputPrice = toNullableMoney(input.inputPricePerMillion ?? model?.input_price_per_million);
    const outputPrice = toNullableMoney(input.outputPricePerMillion ?? model?.output_price_per_million);
    const label = input.label?.trim() || `${account.name} — ${connectionType === "api" ? "API" : connectionType === "local" ? "Local" : "Abonnement"}`;
    db.prepare(`UPDATE project_ai_setups SET project_id = ?, account_id = ?, model_id = ?, connection_type = ?, label = ?, input_price_per_million = ?, output_price_per_million = ? WHERE id = ?`)
      .run(input.projectId, input.accountId, modelId, connectionType, label, inputPrice, outputPrice, setupId);
    return getSetupById(db, setupId);
  } finally { db.close(); }
}

export function deleteProjectAiSetup(dbPath: string, userId: number, setupId: number) {
  initDb(dbPath); const db = open(dbPath);
  try {
    const existing = db.prepare(`SELECT s.project_id as projectId FROM project_ai_setups s JOIN project_members pm ON pm.project_id = s.project_id AND pm.user_id = ? WHERE s.id = ?`).get(userId, setupId) as RawSetupProjectRow | undefined;
    if (!existing) throw new Error("Configuration IA inconnue");
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE ai_usage_entries SET setup_id = NULL WHERE setup_id = ? AND project_id = ?").run(setupId, existing.projectId);
      db.prepare("DELETE FROM usage_import_runs WHERE setup_id = ? AND project_id = ? AND user_id = ?").run(setupId, existing.projectId, userId);
      const result = db.prepare("DELETE FROM project_ai_setups WHERE id = ?").run(setupId);
      db.exec("COMMIT");
      return result.changes > 0;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  } finally { db.close(); }
}

export function recordUsageEntry(dbPath: string, userId: number, input: UsageInput): UsageEntry {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const modelId = input.modelId ? Number(input.modelId) : null;
    if (modelId && !db.prepare("SELECT 1 FROM ai_models WHERE id = ?").get(modelId)) throw new Error("Modèle IA inconnu");
    const result = db.prepare(`INSERT INTO ai_usage_entries(project_id, model_id, label, input_tokens, output_tokens, cache_tokens, reasoning_tokens, cost_eur, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.projectId, modelId, input.label.trim() || "Usage estimé", toNonNegativeInteger(input.inputTokens), toNonNegativeInteger(input.outputTokens), toNonNegativeInteger(input.cacheTokens ?? 0), toNonNegativeInteger(input.reasoningTokens ?? 0), toNonNegativeMoney(input.costEur), input.usedAt?.trim() || new Date().toISOString().slice(0, 10));
    return usageById(db, Number(result.lastInsertRowid));
  } finally { db.close(); }
}

export function estimateProjectUsage(dbPath: string, userId: number, input: EstimateInput): UsageEntry {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const setup = getSetupById(db, input.setupId);
    if (setup.projectId !== input.projectId) throw new Error("Configuration IA hors projet");
    const accountOwner = db.prepare("SELECT 1 FROM ai_accounts WHERE id = ? AND user_id = ?").get(setup.accountId, userId);
    if (!accountOwner) throw new Error("Compte IA refusé");
    const estimatedInputTokens = estimateTokensFromText(input.inputText, setup.providerName);
    const estimatedOutputTokens = estimateTokensFromText(input.outputText, setup.providerName);
    const inputTokens = input.inputTokens == null || input.inputTokens <= 0 ? estimatedInputTokens : toNonNegativeInteger(input.inputTokens);
    const outputTokens = input.outputTokens == null || input.outputTokens <= 0 ? estimatedOutputTokens : toNonNegativeInteger(input.outputTokens);
    const cacheTokens = toNonNegativeInteger(input.cacheTokens ?? 0);
    const reasoningTokens = toNonNegativeInteger(input.reasoningTokens ?? 0);
    const billableInputTokens = inputTokens > 0 ? inputTokens : cacheTokens;
    const billableOutputTokens = outputTokens > 0 ? outputTokens : reasoningTokens;
    const costEur = setup.connectionType === "api" && setup.inputPricePerMillion != null && setup.outputPricePerMillion != null
      ? toNonNegativeMoney((billableInputTokens / 1_000_000) * setup.inputPricePerMillion + (billableOutputTokens / 1_000_000) * setup.outputPricePerMillion)
      : 0;
    const label = input.label.trim() || "Estimation texte";
    const result = db.prepare(`INSERT INTO ai_usage_entries(project_id, model_id, account_id, setup_id, label, input_tokens, output_tokens, cache_tokens, reasoning_tokens, cost_eur, estimation_method, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'text_chars_approx', ?)` )
      .run(input.projectId, setup.modelId, setup.accountId, setup.id, label, inputTokens, outputTokens, cacheTokens, reasoningTokens, costEur, input.usedAt?.trim() || new Date().toISOString().slice(0, 10));
    return usageById(db, Number(result.lastInsertRowid));
  } finally { db.close(); }
}

type ParsedUsageCandidate = { label: string; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; usedAt: string; method: string; forceZeroCost?: boolean };
function getPath(record: any, key: string) { return key.split(".").reduce((acc, part) => acc == null ? undefined : acc[part], record); }
function pickFirstNumber(record: any, keys: string[]) {
  for (const key of keys) {
    const value = getPath(record, key);
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}
function normalizeDate(value: unknown, fallbackDate: string) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString().slice(0, 10);
  const raw = String(value ?? fallbackDate).trim();
  return raw ? raw.slice(0, 10) : fallbackDate;
}
function normalizeUsageRecord(record: any, sourceName: string, fallbackDate: string): ParsedUsageCandidate | null {
  if (!record || typeof record !== "object") return null;
  const inputTokens = pickFirstNumber(record, ["input_tokens", "prompt_tokens", "usage.input_tokens", "usage.prompt_tokens", "usage.inputTokens", "tokens.input", "inputTokens"]);
  const outputTokens = pickFirstNumber(record, ["output_tokens", "completion_tokens", "usage.output_tokens", "usage.completion_tokens", "usage.outputTokens", "tokens.output", "outputTokens"]);
  const inputText = String(record.input_text ?? record.prompt ?? record.request ?? "");
  const outputText = String(record.output_text ?? record.completion ?? record.response ?? "");
  const finalInput = inputTokens ?? estimateTokensFromText(inputText);
  const finalOutput = outputTokens ?? estimateTokensFromText(outputText);
  const cacheTokens = pickFirstNumber(record, ["cache_tokens", "cached_tokens", "usage.cache_tokens", "usage.cached_tokens", "usage.input_tokens_details.cached_tokens", "usage.prompt_tokens_details.cached_tokens", "cacheTokens", "tokens.cache"]) ?? 0;
  const reasoningTokens = pickFirstNumber(record, ["reasoning_tokens", "usage.reasoning_tokens", "usage.output_tokens_details.reasoning_tokens", "usage.completion_tokens_details.reasoning_tokens", "output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens", "usageMetadata.thoughtsTokenCount", "usage_metadata.thoughts_token_count", "thoughtsTokenCount", "reasoningTokens", "tokens.reasoning"]) ?? 0;
  if (finalInput + finalOutput <= 0) return null;
  const id = String(record.request_id ?? record.id ?? record.response_id ?? "").trim();
  const label = String(record.label ?? record.title ?? record.name ?? "").trim() || (id ? `${sourceName} · ${id}` : sourceName);
  return { label, inputTokens: finalInput, outputTokens: finalOutput, cacheTokens, reasoningTokens, usedAt: normalizeDate(record.used_at ?? record.timestamp ?? record.created_at ?? record.createdAt, fallbackDate), method: "json_usage_import" };
}
function normalizeConnectorRecord(record: any, connector: UsageConnector, sourceName: string, fallbackDate: string): ParsedUsageCandidate | null {
  if (!record || typeof record !== "object") return null;
  if (connector === "generic") return normalizeUsageRecord(record, sourceName, fallbackDate);
  const specs: Record<Exclude<UsageConnector, "generic">, { label: string; input: string[]; output: string[]; cache: string[]; reasoning: string[]; id: string[]; date: string[]; method: string; forceZeroCost?: boolean }> = {
    openai: { label: "OpenAI", input: ["usage.input_tokens", "usage.prompt_tokens", "input_tokens", "prompt_tokens"], output: ["usage.output_tokens", "usage.completion_tokens", "output_tokens", "completion_tokens"], cache: ["usage.input_tokens_details.cached_tokens", "usage.prompt_tokens_details.cached_tokens", "input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cached_tokens", "cache_tokens"], reasoning: ["usage.output_tokens_details.reasoning_tokens", "usage.completion_tokens_details.reasoning_tokens", "output_tokens_details.reasoning_tokens", "completion_tokens_details.reasoning_tokens", "reasoning_tokens"], id: ["id", "request_id", "response_id"], date: ["created_at", "created", "timestamp"], method: "openai_usage_connector" },
    anthropic: { label: "Anthropic", input: ["usage.input_tokens", "input_tokens"], output: ["usage.output_tokens", "output_tokens"], cache: ["usage.cache_read_input_tokens", "usage.cache_creation_input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "cached_tokens", "cache_tokens"], reasoning: ["usage.reasoning_tokens", "reasoning_tokens"], id: ["id", "message_id"], date: ["created_at", "createdAt", "timestamp"], method: "anthropic_usage_connector" },
    google: { label: "Google Gemini", input: ["usageMetadata.promptTokenCount", "usage_metadata.prompt_token_count", "promptTokenCount"], output: ["usageMetadata.candidatesTokenCount", "usage_metadata.candidates_token_count", "candidatesTokenCount"], cache: ["usageMetadata.cachedContentTokenCount", "usage_metadata.cached_content_token_count", "cachedContentTokenCount", "cache_tokens"], reasoning: ["usageMetadata.thoughtsTokenCount", "usage_metadata.thoughts_token_count", "thoughtsTokenCount", "reasoning_tokens"], id: ["responseId", "id", "name"], date: ["createTime", "created_at", "timestamp"], method: "google_usage_connector" },
    ollama: { label: "Ollama", input: ["prompt_eval_count", "usage.prompt_eval_count", "input_tokens"], output: ["eval_count", "usage.eval_count", "output_tokens"], cache: ["cache_tokens", "cached_tokens"], reasoning: ["reasoning_tokens"], id: ["id", "model"], date: ["created_at", "timestamp"], method: "ollama_local_connector", forceZeroCost: true },
    local: { label: "Local", input: ["input_tokens", "prompt_tokens", "prompt_eval_count"], output: ["output_tokens", "completion_tokens", "eval_count"], cache: ["cache_tokens", "cached_tokens"], reasoning: ["reasoning_tokens"], id: ["id", "model", "name"], date: ["created_at", "timestamp"], method: "local_usage_connector", forceZeroCost: true },
  };
  const spec = specs[connector];
  const inputTokens = pickFirstNumber(record, spec.input);
  const outputTokens = pickFirstNumber(record, spec.output);
  const inputText = String(record.input_text ?? record.prompt ?? record.request ?? "");
  const outputText = String(record.output_text ?? record.completion ?? record.response ?? "");
  const finalInput = inputTokens ?? estimateTokensFromText(inputText);
  const finalOutput = outputTokens ?? estimateTokensFromText(outputText);
  const cacheTokens = pickFirstNumber(record, spec.cache) ?? 0;
  const reasoningTokens = pickFirstNumber(record, spec.reasoning) ?? 0;
  if (finalInput + finalOutput <= 0) return null;
  const id = spec.id.map((key) => String(getPath(record, key) ?? "").trim()).find(Boolean);
  const rawDate = spec.date.map((key) => getPath(record, key)).find((value) => value != null);
  return { label: id ? `${spec.label} · ${id}` : sourceName, inputTokens: finalInput, outputTokens: finalOutput, cacheTokens, reasoningTokens, usedAt: normalizeDate(rawDate, fallbackDate), method: spec.method, forceZeroCost: spec.forceZeroCost };
}
function flattenUsagePayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["data", "records", "requests", "usage", "items", "responses", "messages"]) if (Array.isArray(payload[key])) return payload[key];
  return [payload];
}
function parseJsonUsage(raw: string, sourceName: string, fallbackDate: string, connector: UsageConnector = "generic") {
  const parsed: ParsedUsageCandidate[] = [];
  try {
    for (const record of flattenUsagePayload(JSON.parse(raw))) {
      const candidate = connector === "generic" ? normalizeUsageRecord(record, sourceName, fallbackDate) : normalizeConnectorRecord(record, connector, sourceName, fallbackDate);
      if (candidate) parsed.push(candidate);
    }
    if (parsed.length) return parsed;
  } catch {}
  for (const line of raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    try {
      const candidate = connector === "generic" ? normalizeUsageRecord(JSON.parse(line), sourceName, fallbackDate) : normalizeConnectorRecord(JSON.parse(line), connector, sourceName, fallbackDate);
      if (candidate) parsed.push(candidate);
    } catch {}
  }
  return parsed;
}
function parseTextUsage(raw: string, sourceName: string, fallbackDate: string): ParsedUsageCandidate[] {
  const inputMatch = raw.match(/(?:^|\n)\s*(?:user|prompt|input|entrée)\s*:\s*([\s\S]*?)(?=\n\s*(?:assistant|output|sortie|réponse)\s*:|$)/i);
  const outputMatch = raw.match(/(?:^|\n)\s*(?:assistant|output|sortie|réponse)\s*:\s*([\s\S]*)$/i);
  const inputText = inputMatch?.[1]?.trim() || raw.trim();
  const outputText = outputMatch?.[1]?.trim() || "";
  const inputTokens = estimateTokensFromText(inputText);
  const outputTokens = estimateTokensFromText(outputText);
  return inputTokens + outputTokens > 0 ? [{ label: sourceName, inputTokens, outputTokens, cacheTokens: 0, reasoningTokens: 0, usedAt: fallbackDate, method: "text_chars_approx_import" }] : [];
}
function parseAutomaticUsage(raw: string, sourceName: string, fallbackDate: string) {
  const jsonRecords = parseJsonUsage(raw, sourceName, fallbackDate);
  return jsonRecords.length ? jsonRecords : parseTextUsage(raw, sourceName, fallbackDate);
}
function parseConnectorUsage(raw: string, connector: UsageConnector, sourceName: string, fallbackDate: string) {
  const jsonRecords = parseJsonUsage(raw, sourceName, fallbackDate, connector);
  return jsonRecords.length ? jsonRecords : parseTextUsage(raw, `${sourceName} · ${connector}`, fallbackDate);
}
function importParsedUsage(dbPath: string, userId: number, input: AutomaticUsageImportInput, candidates: ParsedUsageCandidate[]): AutomaticUsageImportResult {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const setup = getSetupById(db, input.setupId);
    if (setup.projectId !== input.projectId) throw new Error("Configuration IA hors projet");
    if (!db.prepare("SELECT 1 FROM ai_accounts WHERE id = ? AND user_id = ?").get(setup.accountId, userId)) throw new Error("Compte IA refusé");
    if (!candidates.length) throw new Error("Aucun usage importable détecté");
    const entries: UsageEntry[] = [];
    db.exec("BEGIN");
    try {
      for (const candidate of candidates) {
        const billableInputTokens = candidate.inputTokens > 0 ? candidate.inputTokens : candidate.cacheTokens;
        const billableOutputTokens = candidate.outputTokens > 0 ? candidate.outputTokens : candidate.reasoningTokens;
        const costEur = !candidate.forceZeroCost && setup.connectionType === "api" && setup.inputPricePerMillion != null && setup.outputPricePerMillion != null
          ? toNonNegativeMoney((billableInputTokens / 1_000_000) * setup.inputPricePerMillion + (billableOutputTokens / 1_000_000) * setup.outputPricePerMillion)
          : 0;
        const result = db.prepare(`INSERT INTO ai_usage_entries(project_id, model_id, account_id, setup_id, label, input_tokens, output_tokens, cache_tokens, reasoning_tokens, cost_eur, estimation_method, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.projectId, setup.modelId, setup.accountId, setup.id, candidate.label, candidate.inputTokens, candidate.outputTokens, candidate.cacheTokens, candidate.reasoningTokens, costEur, candidate.method, candidate.usedAt || input.usedAt || new Date().toISOString().slice(0, 10));
        entries.push(usageById(db, Number(result.lastInsertRowid)));
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return {
      importedCount: entries.length,
      totalInputTokens: entries.reduce((sum, entry) => sum + entry.inputTokens, 0),
      totalOutputTokens: entries.reduce((sum, entry) => sum + entry.outputTokens, 0),
      totalCostEur: toNonNegativeMoney(entries.reduce((sum, entry) => sum + entry.costEur, 0)),
      entries,
    };
  } finally { db.close(); }
}

export function importConnectorUsage(dbPath: string, userId: number, input: ConnectorUsageImportInput): AutomaticUsageImportResult {
  const sourceName = input.sourceName.trim() || `Connecteur ${input.connector}`;
  const fallbackDate = input.usedAt?.trim() || new Date().toISOString().slice(0, 10);
  return importParsedUsage(dbPath, userId, input, parseConnectorUsage(input.rawExport, input.connector, sourceName, fallbackDate));
}

export function importAutomaticUsage(dbPath: string, userId: number, input: AutomaticUsageImportInput): AutomaticUsageImportResult {
  const sourceName = input.sourceName.trim() || "Import automatique";
  const fallbackDate = input.usedAt?.trim() || new Date().toISOString().slice(0, 10);
  return importParsedUsage(dbPath, userId, input, parseAutomaticUsage(input.rawExport, sourceName, fallbackDate));
}

const inboxConnectors: UsageConnector[] = ["generic", "openai", "anthropic", "google", "ollama", "local"];
const importableExtensions = new Set([".json", ".jsonl", ".log", ".txt"]);

function ensureUsageInbox(rootDir: string) {
  for (const connector of inboxConnectors) for (const folder of ["inbox", "processed", "failed"]) mkdirSync(join(rootDir, connector, folder), { recursive: true });
}
function safeMovePath(targetDir: string, filePath: string) {
  mkdirSync(targetDir, { recursive: true });
  const parsed = basename(filePath);
  let target = join(targetDir, parsed);
  if (existsSync(target)) target = join(targetDir, `${Date.now()}-${parsed}`);
  renameSync(filePath, target);
  return target;
}
function listInboxFiles(rootDir: string) {
  ensureUsageInbox(rootDir);
  const files: { connector: UsageConnector; path: string }[] = [];
  for (const connector of inboxConnectors) {
    const inbox = join(rootDir, connector, "inbox");
    for (const name of readdirSync(inbox).sort()) {
      const path = join(inbox, name);
      if (statSync(path).isFile() && importableExtensions.has(extname(name).toLowerCase())) files.push({ connector, path });
    }
  }
  return files;
}

export function previewUsageInbox(rootDir: string, usedAt?: string): UsageInboxPreview {
  const fallbackDate = usedAt?.trim() || new Date().toISOString().slice(0, 10);
  const files = listInboxFiles(rootDir).map((file) => {
    const fileName = basename(file.path);
    try {
      const rawExport = readFileSync(file.path, "utf8");
      const candidates = parseConnectorUsage(rawExport, file.connector, fileName, fallbackDate);
      const inputTokens = candidates.reduce((sum, candidate) => sum + candidate.inputTokens, 0);
      const outputTokens = candidates.reduce((sum, candidate) => sum + candidate.outputTokens, 0);
      const cacheTokens = candidates.reduce((sum, candidate) => sum + candidate.cacheTokens, 0);
      const reasoningTokens = candidates.reduce((sum, candidate) => sum + candidate.reasoningTokens, 0);
      return { connector: file.connector, fileName, sourcePath: file.path, sizeBytes: statSync(file.path).size, status: candidates.length ? "ready" as const : "failed" as const, detectedCount: candidates.length, inputTokens, outputTokens, cacheTokens, reasoningTokens, totalTokens: inputTokens + outputTokens, sampleLabels: candidates.slice(0, 3).map((candidate) => candidate.label), errorMessage: candidates.length ? null : "Aucun usage importable détecté" };
    } catch (error) {
      return { connector: file.connector, fileName, sourcePath: file.path, sizeBytes: existsSync(file.path) ? statSync(file.path).size : 0, status: "failed" as const, detectedCount: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, reasoningTokens: 0, totalTokens: 0, sampleLabels: [], errorMessage: error instanceof Error ? error.message : "Aperçu refusé" };
    }
  });
  return {
    rootDir,
    folders: inboxConnectors.map((connector) => `${connector}/inbox`),
    files,
    totals: {
      files: files.length,
      readyFiles: files.filter((file) => file.status === "ready").length,
      failedFiles: files.filter((file) => file.status === "failed").length,
      detectedCount: files.reduce((sum, file) => sum + file.detectedCount, 0),
      inputTokens: files.reduce((sum, file) => sum + file.inputTokens, 0),
      outputTokens: files.reduce((sum, file) => sum + file.outputTokens, 0),
      cacheTokens: files.reduce((sum, file) => sum + file.cacheTokens, 0),
      reasoningTokens: files.reduce((sum, file) => sum + file.reasoningTokens, 0),
      totalTokens: files.reduce((sum, file) => sum + file.totalTokens, 0),
    },
  };
}
function countFiles(rootDir: string, folder: "inbox" | "processed" | "failed") {
  ensureUsageInbox(rootDir);
  return inboxConnectors.reduce((sum, connector) => {
    const dir = join(rootDir, connector, folder);
    return sum + readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile()).length;
  }, 0);
}
function rowToRun(row: RawRunRow): UsageImportRun {
  return { id: Number(row.id), userId: Number(row.userId), projectId: Number(row.projectId), setupId: Number(row.setupId), connector: row.connector as UsageConnector, sourcePath: String(row.sourcePath), status: row.status === "success" ? "success" : "failed", importedCount: Number(row.importedCount ?? 0), errorMessage: row.errorMessage == null ? null : String(row.errorMessage), createdAt: String(row.createdAt) };
}
function recordImportRun(dbPath: string, userId: number, projectId: number, setupId: number, connector: UsageConnector, sourcePath: string, status: "success" | "failed", importedCount: number, errorMessage?: string) {
  initDb(dbPath); const db = open(dbPath);
  try {
    const result = db.prepare(`INSERT INTO usage_import_runs(user_id, project_id, setup_id, connector, source_path, status, imported_count, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, projectId, setupId, connector, sourcePath, status, importedCount, errorMessage || null);
    return rowToRun(db.prepare(`SELECT id, user_id as userId, project_id as projectId, setup_id as setupId, connector, source_path as sourcePath, status, imported_count as importedCount, error_message as errorMessage, created_at as createdAt FROM usage_import_runs WHERE id = ?`).get(Number(result.lastInsertRowid)) as RawRunRow);
  } finally { db.close(); }
}

export function importUsageInbox(dbPath: string, userId: number, input: UsageInboxImportInput): UsageInboxImportResult {
  const files = listInboxFiles(input.rootDir);
  const entries: UsageEntry[] = [];
  const runs: UsageImportRun[] = [];
  let processedFiles = 0;
  let failedFiles = 0;
  for (const file of files) {
    const sourcePath = file.path;
    try {
      const rawExport = readFileSync(sourcePath, "utf8");
      const result = importConnectorUsage(dbPath, userId, { connector: file.connector, projectId: input.projectId, setupId: input.setupId, sourceName: basename(sourcePath), rawExport, usedAt: input.usedAt });
      entries.push(...result.entries);
      safeMovePath(join(input.rootDir, file.connector, "processed"), sourcePath);
      processedFiles += 1;
      runs.push(recordImportRun(dbPath, userId, input.projectId, input.setupId, file.connector, sourcePath, "success", result.importedCount));
    } catch (error) {
      safeMovePath(join(input.rootDir, file.connector, "failed"), sourcePath);
      failedFiles += 1;
      runs.push(recordImportRun(dbPath, userId, input.projectId, input.setupId, file.connector, sourcePath, "failed", 0, error instanceof Error ? error.message : "Import refusé"));
    }
  }
  return { processedFiles, failedFiles, runs, importedCount: entries.length, totalInputTokens: entries.reduce((sum, entry) => sum + entry.inputTokens, 0), totalOutputTokens: entries.reduce((sum, entry) => sum + entry.outputTokens, 0), totalCostEur: toNonNegativeMoney(entries.reduce((sum, entry) => sum + entry.costEur, 0)), entries };
}

export function getUsageCollectorHealth(dbPath: string, userId: number, rootDir: string): UsageCollectorHealth {
  initDb(dbPath); ensureUsageInbox(rootDir); const db = open(dbPath);
  try {
    const rows = (db.prepare(`SELECT id, user_id as userId, project_id as projectId, setup_id as setupId, connector, source_path as sourcePath, status, imported_count as importedCount, error_message as errorMessage, created_at as createdAt FROM usage_import_runs WHERE user_id = ? ORDER BY id DESC LIMIT 8`).all(userId) as RawRunRow[]).map(rowToRun);
    return { rootDir, pendingFiles: countFiles(rootDir, "inbox"), processedFiles: countFiles(rootDir, "processed"), failedFiles: countFiles(rootDir, "failed"), lastRun: rows[0] ?? null, recentRuns: rows };
  } finally { db.close(); }
}

function usageById(db: DatabaseSync, entryId: number): UsageEntry {
  return rowToEntry(db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName, pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens, e.cache_tokens as cacheTokens, e.reasoning_tokens as reasoningTokens, e.cost_eur as costEur, ${usageEstimatedCostSql("e")} as estimatedCostEur, e.used_at as usedAt
    FROM ai_usage_entries e JOIN projects p ON p.id = e.project_id LEFT JOIN project_ai_setups s ON s.id = e.setup_id LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE e.id = ?`).get(entryId) as RawEntryRow);
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}
function safeReportSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "projet";
}
function usageReportEntries(db: DatabaseSync, userId: number, projectId: number) {
  const project = db.prepare(`SELECT p.id, p.name FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE p.id = ?`).get(userId, projectId) as RawProjectRow | undefined;
  if (!project) throw new Error("Accès projet refusé");
  const entries = (db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName, pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens, e.cache_tokens as cacheTokens, e.reasoning_tokens as reasoningTokens, e.cost_eur as costEur, ${usageEstimatedCostSql("e")} as estimatedCostEur, e.used_at as usedAt
    FROM ai_usage_entries e JOIN projects p ON p.id = e.project_id LEFT JOIN project_ai_setups s ON s.id = e.setup_id LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE e.project_id = ? ORDER BY e.used_at ASC, e.id ASC`).all(projectId) as RawEntryRow[]).map(rowToEntry);
  return { projectName: String(project.name), entries };
}
export function buildUsageReport(dbPath: string, userId: number, projectId: number, format: UsageReportFormat = "csv"): UsageReport {
  initDb(dbPath); const db = open(dbPath);
  try {
    const { projectName, entries } = usageReportEntries(db, userId, projectId);
    const generatedAt = new Date().toISOString();
    const totals = {
      entries: entries.length,
      inputTokens: entries.reduce((sum, entry) => sum + entry.inputTokens, 0),
      outputTokens: entries.reduce((sum, entry) => sum + entry.outputTokens, 0),
      cacheTokens: entries.reduce((sum, entry) => sum + entry.cacheTokens, 0),
      reasoningTokens: entries.reduce((sum, entry) => sum + entry.reasoningTokens, 0),
      totalTokens: entries.reduce((sum, entry) => sum + entry.totalTokens, 0),
      costEur: toNonNegativeMoney(entries.reduce((sum, entry) => sum + entry.costEur, 0)),
      estimatedCostEur: toNonNegativeMoney(entries.reduce((sum, entry) => sum + entry.estimatedCostEur, 0)),
    };
    const normalizedFormat: UsageReportFormat = format === "json" ? "json" : "csv";
    const fileName = `rapport-consommation-tokens-${safeReportSlug(projectName)}-${generatedAt.slice(0, 10)}.${normalizedFormat}`;
    const content = normalizedFormat === "json"
      ? JSON.stringify({ projectId, projectName, generatedAt, totals, entries }, null, 2)
      : [
          "date,projet,fournisseur,modele,libelle,input_tokens,output_tokens,cache_tokens,reasoning_tokens,total_tokens,cost_eur,estimated_cost_eur",
          ...entries.map((entry) => [entry.usedAt, entry.projectName, entry.providerName || "", entry.modelName || "", entry.label, entry.inputTokens, entry.outputTokens, entry.cacheTokens, entry.reasoningTokens, entry.totalTokens, entry.costEur.toFixed(6), entry.estimatedCostEur.toFixed(6)].map(csvEscape).join(",")),
          "",
          `TOTAL,${csvEscape(projectName)},,,,${totals.inputTokens},${totals.outputTokens},${totals.cacheTokens},${totals.reasoningTokens},${totals.totalTokens},${totals.costEur.toFixed(6)}`,
        ].join("\n");
    return { projectId, projectName, generatedAt, format: normalizedFormat, mimeType: normalizedFormat === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8", fileName, totals, entries, content };
  } finally { db.close(); }
}
export function saveUsageReportFile(dbPath: string, userId: number, input: { projectId: number; format?: UsageReportFormat; outputDir?: string }): SavedUsageReport {
  const report = buildUsageReport(dbPath, userId, input.projectId, input.format ?? "csv");
  const outputDir = input.outputDir || defaultUsageReportsDir;
  mkdirSync(outputDir, { recursive: true });
  const filePath = join(outputDir, report.fileName);
  writeFileSync(filePath, report.content, "utf8");
  return { ...report, filePath };
}

function safeSavedReportName(fileName: string) {
  const clean = basename(String(fileName || ""));
  if (!/^rapport-consommation-tokens-[a-z0-9_-]+-\d{4}-\d{2}-\d{2}\.(csv|json)$/.test(clean)) throw new Error("Nom de rapport refusé");
  return clean;
}
export function listSavedUsageReports(outputDir = defaultUsageReportsDir): SavedUsageReportSummary[] {
  mkdirSync(outputDir, { recursive: true });
  return readdirSync(outputDir)
    .filter((fileName) => {
      try { safeSavedReportName(fileName); return true; } catch { return false; }
    })
    .map((fileName) => {
      const filePath = join(outputDir, fileName);
      const stats = statSync(filePath);
      return { fileName, format: fileName.endsWith(".json") ? "json" as const : "csv" as const, sizeBytes: stats.size, createdAt: stats.mtime.toISOString(), filePath };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function readSavedUsageReport(outputDir: string, fileName: string): DownloadedUsageReport {
  const clean = safeSavedReportName(fileName);
  const filePath = join(outputDir, clean);
  const content = readFileSync(filePath, "utf8");
  const format: UsageReportFormat = clean.endsWith(".json") ? "json" : "csv";
  return { fileName: clean, format, mimeType: format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8", sizeBytes: Buffer.byteLength(content), content };
}
export function deleteSavedUsageReport(outputDir: string, fileName: string) {
  const clean = safeSavedReportName(fileName);
  const filePath = join(outputDir, clean);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

function withMaxRatio<T extends { totalTokens: number }>(rows: T[]) {
  const maxTokens = Math.max(0, ...rows.map((row) => row.totalTokens));
  return rows.map((row) => ({ ...row, maxRatio: maxTokens > 0 ? row.totalTokens / maxTokens : 0 }));
}
export function normalizeUsageTimeRange(value?: string | null): UsageTimeRange {
  return value === "24h" || value === "7d" || value === "30d" || value === "all" ? value : "all";
}
function usageTimeFilter(column: string, timeRange?: UsageTimeRange) {
  const range = normalizeUsageTimeRange(timeRange);
  if (range === "24h") return { range, clause: ` AND datetime(${column}) >= datetime('now', '-1 day')` };
  if (range === "7d") return { range, clause: ` AND date(${column}) >= date('now', '-6 days')` };
  if (range === "30d") return { range, clause: ` AND date(${column}) >= date('now', '-29 days')` };
  return { range, clause: "" };
}
function _buildUsageChartData(db: DatabaseSync, userId: number, projectId: number, timeRange: UsageTimeRange = "all"): UsageChartData {
  const project = db.prepare(`SELECT p.id, p.name FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE p.id = ?`).get(userId, projectId) as RawProjectRow | undefined;
  if (!project) throw new Error("Accès projet refusé");
  const dateFilter = usageTimeFilter("used_at", timeRange);
  const aliasedDateFilter = usageTimeFilter("e.used_at", timeRange);
  const totalsRow = db.prepare(`SELECT count(*) as entries, coalesce(sum(input_tokens),0) as inputTokens, coalesce(sum(output_tokens),0) as outputTokens, coalesce(sum(cache_tokens),0) as cacheTokens, coalesce(sum(reasoning_tokens),0) as reasoningTokens, coalesce(sum(input_tokens + output_tokens),0) as totalTokens, coalesce(sum(cost_eur),0) as costEur FROM ai_usage_entries WHERE project_id = ?${dateFilter.clause}`).get(projectId) as RawTotalsRow;
  const dailyRows = db.prepare(`SELECT substr(used_at,1,10) as date, count(*) as entries, coalesce(sum(input_tokens),0) as inputTokens, coalesce(sum(output_tokens),0) as outputTokens, coalesce(sum(cache_tokens),0) as cacheTokens, coalesce(sum(reasoning_tokens),0) as reasoningTokens, coalesce(sum(input_tokens + output_tokens),0) as totalTokens, coalesce(sum(cost_eur),0) as costEur FROM ai_usage_entries WHERE project_id = ?${dateFilter.clause} GROUP BY substr(used_at,1,10) ORDER BY date ASC`).all(projectId) as RawChartRow[];
  const providerRows = db.prepare(`SELECT coalesce(pr.name,'IA') as name, count(*) as entries, coalesce(sum(e.input_tokens),0) as inputTokens, coalesce(sum(e.output_tokens),0) as outputTokens, coalesce(sum(e.cache_tokens),0) as cacheTokens, coalesce(sum(e.reasoning_tokens),0) as reasoningTokens, coalesce(sum(e.input_tokens + e.output_tokens),0) as totalTokens, coalesce(sum(e.cost_eur),0) as costEur FROM ai_usage_entries e LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE e.project_id = ?${aliasedDateFilter.clause} GROUP BY coalesce(pr.name,'IA') ORDER BY totalTokens DESC, name ASC LIMIT 5`).all(projectId) as RawBreakdownRow[];
  const modelRows = db.prepare(`SELECT coalesce(m.name,'Modèle') as name, count(*) as entries, coalesce(sum(e.input_tokens),0) as inputTokens, coalesce(sum(e.output_tokens),0) as outputTokens, coalesce(sum(e.cache_tokens),0) as cacheTokens, coalesce(sum(e.reasoning_tokens),0) as reasoningTokens, coalesce(sum(e.input_tokens + e.output_tokens),0) as totalTokens, coalesce(sum(e.cost_eur),0) as costEur FROM ai_usage_entries e LEFT JOIN ai_models m ON m.id = e.model_id WHERE e.project_id = ?${aliasedDateFilter.clause} GROUP BY coalesce(m.name,'Modèle') ORDER BY totalTokens DESC, name ASC LIMIT 5`).all(projectId) as RawBreakdownRow[];
  const normalize = (row: RawBreakdownRow) => ({ name: String(row.name), inputTokens: Number(row.inputTokens ?? 0), outputTokens: Number(row.outputTokens ?? 0), cacheTokens: Number(row.cacheTokens ?? 0), reasoningTokens: Number(row.reasoningTokens ?? 0), totalTokens: Number(row.totalTokens ?? 0), costEur: toNonNegativeMoney(Number(row.costEur ?? 0)), entries: Number(row.entries ?? 0) });
  const normalizeDaily = (row: RawChartRow) => ({ date: String(row.date), inputTokens: Number(row.inputTokens ?? 0), outputTokens: Number(row.outputTokens ?? 0), cacheTokens: Number(row.cacheTokens ?? 0), reasoningTokens: Number(row.reasoningTokens ?? 0), totalTokens: Number(row.totalTokens ?? 0), costEur: toNonNegativeMoney(Number(row.costEur ?? 0)), entries: Number(row.entries ?? 0) });
  return {
    projectId: Number(project.id),
    projectName: String(project.name),
    timeRange: dateFilter.range,
    totals: { entries: Number(totalsRow.entries ?? 0), inputTokens: Number(totalsRow.inputTokens ?? 0), outputTokens: Number(totalsRow.outputTokens ?? 0), cacheTokens: Number(totalsRow.cacheTokens ?? 0), reasoningTokens: Number(totalsRow.reasoningTokens ?? 0), totalTokens: Number(totalsRow.totalTokens ?? 0), costEur: toNonNegativeMoney(Number(totalsRow.costEur ?? 0)) },
    daily: withMaxRatio(dailyRows.map(normalizeDaily)),
    topProviders: withMaxRatio(providerRows.map(normalize)),
    topModels: withMaxRatio(modelRows.map(normalize)),
  };
}

export function buildUsageChartData(dbPath: string, userId: number, projectId: number, timeRange: UsageTimeRange = "all"): UsageChartData {
  initDb(dbPath); const db = open(dbPath);
  try { return _buildUsageChartData(db, userId, projectId, timeRange); } finally { db.close(); }
}

const VISUAL_AGENT_COLORS = [
  { color: "#00FFB2", glow: "rgba(0,255,178,.35)" },
  { color: "#38B6FF", glow: "rgba(56,182,255,.35)" },
  { color: "#FF6B6B", glow: "rgba(255,107,107,.32)" },
  { color: "#A78BFA", glow: "rgba(167,139,250,.32)" },
  { color: "#FBBF24", glow: "rgba(251,191,36,.28)" },
];
const DONUT_COLORS = ["#00FFB2", "#38B6FF", "#A78BFA", "#FBBF24", "#FF6B6B"];
function visualAgentName(label: string | null, projectName: string | null) {
  const raw = (label || projectName || "IA locale").trim();
  const first = raw.split("·")[0]?.trim() || raw;
  return first.replace(/\s+default$/i, "").trim() || "IA locale";
}
function visualModelName(label: string | null, modelName: string | null, providerName: string | null) {
  const parts = (label || "").split("·").map((part) => part.trim()).filter(Boolean);
  const labelModel = parts.find((part, index) => index > 0 && /^(gpt|claude|gemini|deepseek|llama|mistral|qwen|grok|o[0-9]|sonnet|opus|haiku)/i.test(part));
  return labelModel || modelName || providerName || "Modèle non renseigné";
}
function normalizedScore(value: number, max: number) {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round((value / max) * 100)));
}
function _buildVisualDashboardData(db: DatabaseSync, userId: number, projectId?: number | null, timeRange: UsageTimeRange = "all"): VisualDashboardData {
  const scope = db.prepare(`SELECT p.id FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE (? IS NULL OR p.id = ?)`)
    .all(userId, projectId ?? null, projectId ?? null) as { id: number }[];
  if (projectId != null && scope.length === 0) throw new Error("Accès projet refusé");
  const agentMap = new Map<string, RawVisualAgentRow>();
  const dateFilter = usageTimeFilter("e.used_at", timeRange);
  const entries = db.prepare(`SELECT e.label, p.name as projectName, m.name as modelName, pr.name as providerName, e.input_tokens as inputTokens, e.output_tokens as outputTokens, e.cache_tokens as cacheTokens, e.reasoning_tokens as reasoningTokens, e.cost_eur as costEur, e.used_at as usedAt
    FROM ai_usage_entries e JOIN projects p ON p.id = e.project_id JOIN project_members pm ON pm.project_id = e.project_id AND pm.user_id = ? LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE (? IS NULL OR e.project_id = ?)${dateFilter.clause}`)
    .all(userId, projectId ?? null, projectId ?? null) as { label: string; projectName: string; modelName: string | null; providerName: string | null; inputTokens: number; outputTokens: number; cacheTokens: number; reasoningTokens: number; costEur: number; usedAt: string }[];
  const modelsByAgent = new Map<string, Map<string, RawVisualModelRow>>();
  for (const entry of entries) {
    const agentName = visualAgentName(entry.label, entry.projectName);
    const modelName = visualModelName(entry.label, entry.modelName, entry.providerName);
    const tokens = Number(entry.inputTokens ?? 0) + Number(entry.outputTokens ?? 0);
    const existing = agentMap.get(agentName) ?? { agentName, entries: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, reasoningTokens: 0, totalTokens: 0, costEur: 0, lastUsed: "" };
    existing.entries += 1;
    existing.inputTokens += Number(entry.inputTokens ?? 0);
    existing.outputTokens += Number(entry.outputTokens ?? 0);
    existing.cacheTokens += Number(entry.cacheTokens ?? 0);
    existing.reasoningTokens += Number(entry.reasoningTokens ?? 0);
    existing.totalTokens += tokens;
    existing.costEur += Number(entry.costEur ?? 0);
    existing.lastUsed = existing.lastUsed > String(entry.usedAt) ? existing.lastUsed : String(entry.usedAt);
    agentMap.set(agentName, existing);
    const agentModels = modelsByAgent.get(agentName) ?? new Map<string, RawVisualModelRow>();
    const model = agentModels.get(modelName) ?? { agentName, modelName, entries: 0, tokens: 0, costEur: 0, lastUsed: "" };
    model.entries += 1;
    model.tokens += tokens;
    model.costEur += Number(entry.costEur ?? 0);
    model.lastUsed = model.lastUsed > String(entry.usedAt) ? model.lastUsed : String(entry.usedAt);
    agentModels.set(modelName, model);
    modelsByAgent.set(agentName, agentModels);
  }
  const rows = [...agentMap.values()].sort((a, b) => b.totalTokens - a.totalTokens || a.agentName.localeCompare(b.agentName));
  const max = {
    input: Math.max(0, ...rows.map((row) => row.inputTokens)),
    output: Math.max(0, ...rows.map((row) => row.outputTokens)),
    cache: Math.max(0, ...rows.map((row) => row.cacheTokens)),
    reasoning: Math.max(0, ...rows.map((row) => row.reasoningTokens)),
    cost: Math.max(0, ...rows.map((row) => row.costEur)),
    sessions: Math.max(0, ...rows.map((row) => row.entries)),
  };
  const agents = rows.map((row, index) => {
    const palette = VISUAL_AGENT_COLORS[index % VISUAL_AGENT_COLORS.length];
    const donutRaw = [
      { label: "Input", value: Number(row.inputTokens), color: DONUT_COLORS[0] },
      { label: "Output", value: Number(row.outputTokens), color: DONUT_COLORS[1] },
      { label: "Cache", value: Number(row.cacheTokens), color: DONUT_COLORS[2] },
      { label: "Reasoning", value: Number(row.reasoningTokens), color: DONUT_COLORS[3] },
    ].filter((item) => item.value > 0);
    const donutTotal = donutRaw.reduce((sum, item) => sum + item.value, 0);
    return {
      id: row.agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `agent-${index + 1}`,
      name: row.agentName,
      color: palette.color,
      glow: palette.glow,
      radar: {
        input: normalizedScore(row.inputTokens, max.input),
        output: normalizedScore(row.outputTokens, max.output),
        cache: normalizedScore(row.cacheTokens, max.cache),
        reasoning: normalizedScore(row.reasoningTokens, max.reasoning),
        cost: normalizedScore(row.costEur, max.cost),
        sessions: normalizedScore(row.entries, max.sessions),
      },
      donut: donutRaw.map((item) => ({ ...item, pct: donutTotal > 0 ? Math.round((item.value / donutTotal) * 1000) / 10 : 0 })),
      models: [...(modelsByAgent.get(row.agentName)?.values() ?? [])]
        .sort((a, b) => b.tokens - a.tokens || a.modelName.localeCompare(b.modelName))
        .slice(0, 8)
        .map((model) => ({ name: model.modelName, tokens: Number(model.tokens), cost: toNonNegativeMoney(model.costEur), sessions: Number(model.entries), lastUsed: String(model.lastUsed || "").slice(0, 10) })),
    };
  });
  return { timeRange: dateFilter.range, agents };
}
export function buildVisualDashboardData(dbPath: string, userId: number, projectId?: number | null, timeRange: UsageTimeRange = "all"): VisualDashboardData {
  initDb(dbPath); const db = open(dbPath);
  try { return _buildVisualDashboardData(db, userId, projectId, timeRange); } finally { db.close(); }
}

const USAGE_PAGE_SIZE = 30;

export function listDashboardData(dbPath: string, userId: number, selectedProjectId?: number, page = 1, timeRange: UsageTimeRange = "all") {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  const projects = db.prepare(`SELECT p.id, p.name, p.description, p.owner_user_id as ownerUserId FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id DESC`).all(userId) as Project[];
  const providers = db.prepare("SELECT id, name, kind FROM ai_providers ORDER BY id").all() as Provider[];
  const models = db.prepare(`SELECT m.id, m.provider_id as providerId, p.name as providerName, m.name, m.api_model_id as apiModelId, m.category, m.input_price_per_million as inputPricePerMillion, m.output_price_per_million as outputPricePerMillion, m.image_price as imagePrice, m.pricing_unit as pricingUnit, m.description, m.source FROM ai_models m JOIN ai_providers p ON p.id = m.provider_id ORDER BY p.name, m.category, m.name`).all() as Model[];
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;
  const aiAccounts = (db.prepare(`SELECT a.id, a.user_id as userId, a.provider_id as providerId, p.name as providerName, a.name, a.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, a.notes FROM ai_accounts a LEFT JOIN ai_providers p ON p.id = a.provider_id WHERE a.user_id = ? ORDER BY a.id DESC`).all(userId) as RawAccountRow[]).map(rowToAccount);
  const projectAiSetups = selectedProject ? (db.prepare(`SELECT s.id, s.project_id as projectId, p.name as projectName, s.account_id as accountId, a.name as accountName, pr.name as providerName, s.model_id as modelId, m.name as modelName, s.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, s.input_price_per_million as inputPricePerMillion, s.output_price_per_million as outputPricePerMillion, s.label
    FROM project_ai_setups s JOIN projects p ON p.id = s.project_id JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? JOIN ai_accounts a ON a.id = s.account_id LEFT JOIN ai_providers pr ON pr.id = a.provider_id LEFT JOIN ai_models m ON m.id = s.model_id WHERE s.project_id = ? ORDER BY s.id DESC`).all(userId, selectedProject.id) as RawSetupRow[]).map(rowToSetup) : [];
  const range = normalizeUsageTimeRange(timeRange);
  const usageDateFilter = usageTimeFilter("e.used_at", range);
  const projectDateFilter = usageTimeFilter("used_at", range);
  const usage = db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost FROM ai_usage_entries e JOIN project_members pm ON pm.project_id = e.project_id WHERE pm.user_id = ?${usageDateFilter.clause}`).get(userId) as RawUsageSumRow;
  const projectUsage = selectedProject ? db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost FROM ai_usage_entries WHERE project_id = ?${projectDateFilter.clause}`).get(selectedProject.id) as RawUsageSumRow : { tokens: 0, cost: 0 };
  const subscriptionMonthly = projectAiSetups.reduce((sum, setup) => sum + (setup.connectionType === "subscription" ? setup.monthlyCostEur : 0), 0);
  const safePage = Number.isFinite(page) ? Math.max(1, Math.round(page)) : 1;
  const offset = (safePage - 1) * USAGE_PAGE_SIZE;
  const totalUsageRow = db.prepare(`SELECT count(*) as total FROM ai_usage_entries e JOIN project_members pm ON pm.project_id = e.project_id AND pm.user_id = ? WHERE (? IS NULL OR e.project_id = ?)${usageDateFilter.clause}`).get(userId, selectedProject?.id ?? null, selectedProject?.id ?? null) as { total: number };
  const totalUsageEntries = Number(totalUsageRow.total ?? 0);
  const usageEntries = (db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName, pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens, e.cache_tokens as cacheTokens, e.reasoning_tokens as reasoningTokens, e.cost_eur as costEur, ${usageEstimatedCostSql("e")} as estimatedCostEur, e.used_at as usedAt FROM ai_usage_entries e JOIN projects p ON p.id = e.project_id JOIN project_members pm ON pm.project_id = e.project_id AND pm.user_id = ? LEFT JOIN project_ai_setups s ON s.id = e.setup_id LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE (? IS NULL OR e.project_id = ?)${usageDateFilter.clause} ORDER BY e.used_at DESC, e.id DESC LIMIT ? OFFSET ?`).all(userId, selectedProject?.id ?? null, selectedProject?.id ?? null, USAGE_PAGE_SIZE, offset) as RawEntryRow[]).map(rowToEntry);
  const usageCharts = selectedProject ? _buildUsageChartData(db, userId, selectedProject.id, range) : null;
  const visualDashboard = _buildVisualDashboardData(db, userId, selectedProject?.id ?? null, range);
  db.close();
  return { projects, providers, models, aiAccounts, projectAiSetups, selectedProject, timeRange: range, usageEntries, totalUsageEntries, usagePage: safePage, usagePageSize: USAGE_PAGE_SIZE, usageCharts, visualDashboard, usage: { tokens: Number(usage.tokens), cost: toNonNegativeMoney(Number(usage.cost)) }, projectUsage: { tokens: Number(projectUsage.tokens), cost: toNonNegativeMoney(Number(projectUsage.cost)), subscriptionMonthly } };
}

export const DB_PATH = defaultDbPath;
export const USAGE_INBOX_DIR = defaultUsageInboxDir;
export const USAGE_REPORTS_DIR = defaultUsageReportsDir;
