import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
  totalTokens: number;
  costEur: number;
  usedAt: string;
};
export type UsageInput = { projectId: number; modelId?: number | null; label: string; inputTokens: number; outputTokens: number; costEur: number; usedAt?: string };
export type AiAccountInput = { providerId?: number | null; name: string; connectionType: ConnectionType; subscriptionName?: string; monthlyCostEur?: number; notes?: string };
export type ProjectAiSetupInput = { projectId: number; accountId: number; modelId?: number | null; connectionType?: ConnectionType; label?: string; inputPricePerMillion?: number | null; outputPricePerMillion?: number | null };
export type EstimateInput = { projectId: number; setupId: number; label: string; inputText: string; outputText: string; usedAt?: string };

const defaultDbPath = join(process.cwd(), "data", "torquepilot.sqlite");

function open(dbPath = defaultDbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  return new DatabaseSync(dbPath);
}

function columnExists(db: DatabaseSync, table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).some((row) => row.name === column);
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
      cost_eur REAL NOT NULL DEFAULT 0,
      estimation_method TEXT,
      used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
export function estimateTokensFromText(text: string) { const clean = text.trim(); return clean ? Math.max(1, Math.ceil(clean.length / 4)) : 0; }

function rowToEntry(row: any): UsageEntry {
  const inputTokens = Number(row.inputTokens ?? 0); const outputTokens = Number(row.outputTokens ?? 0);
  return { id: Number(row.id), projectId: Number(row.projectId), projectName: String(row.projectName), modelId: row.modelId == null ? null : Number(row.modelId), modelName: row.modelName == null ? null : String(row.modelName), providerName: row.providerName == null ? null : String(row.providerName), label: String(row.label), inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costEur: Number(row.costEur ?? 0), usedAt: String(row.usedAt) };
}
function rowToAccount(row: any): AiAccount {
  return { id: Number(row.id), userId: Number(row.userId), providerId: row.providerId == null ? null : Number(row.providerId), providerName: row.providerName == null ? null : String(row.providerName), name: String(row.name), connectionType: normalizeConnectionType(row.connectionType), subscriptionName: row.subscriptionName == null ? null : String(row.subscriptionName), monthlyCostEur: Number(row.monthlyCostEur ?? 0), notes: row.notes == null ? null : String(row.notes) };
}
function rowToSetup(row: any): ProjectAiSetup {
  return { id: Number(row.id), projectId: Number(row.projectId), projectName: String(row.projectName), accountId: Number(row.accountId), accountName: String(row.accountName), providerName: row.providerName == null ? null : String(row.providerName), modelId: row.modelId == null ? null : Number(row.modelId), modelName: row.modelName == null ? null : String(row.modelName), connectionType: normalizeConnectionType(row.connectionType), subscriptionName: row.subscriptionName == null ? null : String(row.subscriptionName), monthlyCostEur: Number(row.monthlyCostEur ?? 0), inputPricePerMillion: row.inputPricePerMillion == null ? null : Number(row.inputPricePerMillion), outputPricePerMillion: row.outputPricePerMillion == null ? null : Number(row.outputPricePerMillion), label: String(row.label) };
}

export function createUser(dbPath: string, email: string, password: string): User {
  initDb(dbPath); const db = open(dbPath); const normalized = email.trim().toLowerCase(); const passwordHash = hashPassword(password);
  const result = db.prepare("INSERT INTO users(email, password_hash) VALUES (?, ?)").run(normalized, passwordHash);
  db.close(); return { id: Number(result.lastInsertRowid), email: normalized, passwordHash };
}
export function verifyUser(dbPath: string, email: string, password: string): User | null {
  initDb(dbPath); const db = open(dbPath); const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase()) as any; db.close();
  return row && checkPassword(password, row.password_hash) ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}
export function getUserById(dbPath: string, userId: number): User | null {
  initDb(dbPath); const db = open(dbPath); const row = db.prepare("SELECT id, email, password_hash FROM users WHERE id = ?").get(userId) as any; db.close();
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}
export function createProject(dbPath: string, userId: number, name: string, description = ""): Project {
  initDb(dbPath); const db = open(dbPath); const result = db.prepare("INSERT INTO projects(name, description, owner_user_id) VALUES (?, ?, ?)").run(name.trim(), description.trim(), userId); const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, 'owner')").run(id, userId); db.close(); return { id, name: name.trim(), description: description.trim(), ownerUserId: userId };
}
export function userCanAccessProject(dbPath: string, userId: number, projectId: number) {
  initDb(dbPath); const db = open(dbPath); const row = db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, projectId); db.close(); return Boolean(row);
}

export function seedDefaultProviders(dbPath = defaultDbPath) {
  initDb(dbPath); const db = open(dbPath);
  try {
    for (const model of MODEL_CATALOG) {
      db.prepare("INSERT OR IGNORE INTO ai_providers(name, kind) VALUES (?, 'catalog')").run(model.providerName);
      const providerRow = db.prepare("SELECT id FROM ai_providers WHERE name = ?").get(model.providerName) as any;
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
    return rowToAccount(db.prepare(`SELECT a.id, a.user_id as userId, a.provider_id as providerId, p.name as providerName, a.name, a.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, a.notes FROM ai_accounts a LEFT JOIN ai_providers p ON p.id = a.provider_id WHERE a.id = ?`).get(Number(result.lastInsertRowid)) as any);
  } finally { db.close(); }
}

export function assignAiAccountToProject(dbPath: string, userId: number, input: ProjectAiSetupInput): ProjectAiSetup {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const account = db.prepare("SELECT * FROM ai_accounts WHERE id = ? AND user_id = ?").get(input.accountId, userId) as any;
    if (!account) throw new Error("Compte IA inconnu");
    const modelId = input.modelId ? Number(input.modelId) : null;
    const model = modelId ? db.prepare("SELECT input_price_per_million, output_price_per_million FROM ai_models WHERE id = ?").get(modelId) as any : null;
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
    FROM project_ai_setups s JOIN projects p ON p.id = s.project_id JOIN ai_accounts a ON a.id = s.account_id LEFT JOIN ai_providers pr ON pr.id = a.provider_id LEFT JOIN ai_models m ON m.id = s.model_id WHERE s.id = ?`).get(setupId) as any);
}

export function recordUsageEntry(dbPath: string, userId: number, input: UsageInput): UsageEntry {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  try {
    if (!db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId)) throw new Error("Accès projet refusé");
    const modelId = input.modelId ? Number(input.modelId) : null;
    if (modelId && !db.prepare("SELECT 1 FROM ai_models WHERE id = ?").get(modelId)) throw new Error("Modèle IA inconnu");
    const result = db.prepare(`INSERT INTO ai_usage_entries(project_id, model_id, label, input_tokens, output_tokens, cost_eur, used_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.projectId, modelId, input.label.trim() || "Usage estimé", toNonNegativeInteger(input.inputTokens), toNonNegativeInteger(input.outputTokens), toNonNegativeMoney(input.costEur), input.usedAt?.trim() || new Date().toISOString().slice(0, 10));
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
    const inputTokens = estimateTokensFromText(input.inputText);
    const outputTokens = estimateTokensFromText(input.outputText);
    const costEur = setup.connectionType === "api" && setup.inputPricePerMillion != null && setup.outputPricePerMillion != null
      ? toNonNegativeMoney((inputTokens / 1_000_000) * setup.inputPricePerMillion + (outputTokens / 1_000_000) * setup.outputPricePerMillion)
      : 0;
    const label = input.label.trim() || "Estimation texte";
    const result = db.prepare(`INSERT INTO ai_usage_entries(project_id, model_id, account_id, setup_id, label, input_tokens, output_tokens, cost_eur, estimation_method, used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'text_chars_approx', ?)`)
      .run(input.projectId, setup.modelId, setup.accountId, setup.id, label, inputTokens, outputTokens, costEur, input.usedAt?.trim() || new Date().toISOString().slice(0, 10));
    return usageById(db, Number(result.lastInsertRowid));
  } finally { db.close(); }
}

function usageById(db: DatabaseSync, entryId: number): UsageEntry {
  return rowToEntry(db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName, pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens, e.cost_eur as costEur, e.used_at as usedAt
    FROM ai_usage_entries e JOIN projects p ON p.id = e.project_id LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE e.id = ?`).get(entryId) as any);
}

export function listDashboardData(dbPath: string, userId: number, selectedProjectId?: number) {
  initDb(dbPath); seedDefaultProviders(dbPath); const db = open(dbPath);
  const projects = db.prepare(`SELECT p.id, p.name, p.description, p.owner_user_id as ownerUserId FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id DESC`).all(userId) as Project[];
  const providers = db.prepare("SELECT id, name, kind FROM ai_providers ORDER BY id").all() as Provider[];
  const models = db.prepare(`SELECT m.id, m.provider_id as providerId, p.name as providerName, m.name, m.api_model_id as apiModelId, m.category, m.input_price_per_million as inputPricePerMillion, m.output_price_per_million as outputPricePerMillion, m.image_price as imagePrice, m.pricing_unit as pricingUnit, m.description, m.source FROM ai_models m JOIN ai_providers p ON p.id = m.provider_id ORDER BY p.name, m.category, m.name`).all() as Model[];
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;
  const aiAccounts = db.prepare(`SELECT a.id, a.user_id as userId, a.provider_id as providerId, p.name as providerName, a.name, a.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, a.notes FROM ai_accounts a LEFT JOIN ai_providers p ON p.id = a.provider_id WHERE a.user_id = ? ORDER BY a.id DESC`).all(userId).map(rowToAccount);
  const projectAiSetups = selectedProject ? db.prepare(`SELECT s.id, s.project_id as projectId, p.name as projectName, s.account_id as accountId, a.name as accountName, pr.name as providerName, s.model_id as modelId, m.name as modelName, s.connection_type as connectionType, a.subscription_name as subscriptionName, a.monthly_cost_eur as monthlyCostEur, s.input_price_per_million as inputPricePerMillion, s.output_price_per_million as outputPricePerMillion, s.label
    FROM project_ai_setups s JOIN projects p ON p.id = s.project_id JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? JOIN ai_accounts a ON a.id = s.account_id LEFT JOIN ai_providers pr ON pr.id = a.provider_id LEFT JOIN ai_models m ON m.id = s.model_id WHERE s.project_id = ? ORDER BY s.id DESC`).all(userId, selectedProject.id).map(rowToSetup) : [];
  const usage = db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost FROM ai_usage_entries e JOIN project_members pm ON pm.project_id = e.project_id WHERE pm.user_id = ?`).get(userId) as any;
  const projectUsage = selectedProject ? db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost FROM ai_usage_entries WHERE project_id = ?`).get(selectedProject.id) as any : { tokens: 0, cost: 0 };
  const subscriptionMonthly = projectAiSetups.reduce((sum, setup) => sum + (setup.connectionType === "subscription" ? setup.monthlyCostEur : 0), 0);
  const usageEntries = db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName, pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens, e.cost_eur as costEur, e.used_at as usedAt FROM ai_usage_entries e JOIN projects p ON p.id = e.project_id JOIN project_members pm ON pm.project_id = e.project_id AND pm.user_id = ? LEFT JOIN ai_models m ON m.id = e.model_id LEFT JOIN ai_providers pr ON pr.id = m.provider_id WHERE (? IS NULL OR e.project_id = ?) ORDER BY e.used_at DESC, e.id DESC LIMIT 30`).all(userId, selectedProject?.id ?? null, selectedProject?.id ?? null).map(rowToEntry);
  db.close();
  return { projects, providers, models, aiAccounts, projectAiSetups, selectedProject, usageEntries, usage: { tokens: Number(usage.tokens), cost: Number(usage.cost) }, projectUsage: { tokens: Number(projectUsage.tokens), cost: Number(projectUsage.cost), subscriptionMonthly } };
}

export const DB_PATH = defaultDbPath;
