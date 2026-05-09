import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type User = { id: number; email: string; passwordHash: string };
export type Project = { id: number; name: string; description: string | null; ownerUserId: number };
export type Provider = { id: number; name: string; kind: string };
export type Model = { id: number; providerId: number; providerName: string; name: string };
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

export type UsageInput = {
  projectId: number;
  modelId?: number | null;
  label: string;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
  usedAt?: string;
};

const defaultDbPath = join(process.cwd(), "data", "torquepilot.sqlite");

function open(dbPath = defaultDbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  return new DatabaseSync(dbPath);
}

export function initDb(dbPath = defaultDbPath) {
  const db = open(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'owner',
      PRIMARY KEY(project_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE IF NOT EXISTS ai_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL REFERENCES ai_providers(id),
      name TEXT NOT NULL,
      UNIQUE(provider_id, name)
    );
    CREATE TABLE IF NOT EXISTS ai_usage_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      model_id INTEGER REFERENCES ai_models(id),
      label TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_eur REAL NOT NULL DEFAULT 0,
      used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
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

function toNonNegativeInteger(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function toNonNegativeMoney(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1000000) / 1000000;
}

function rowToEntry(row: any): UsageEntry {
  const inputTokens = Number(row.inputTokens ?? 0);
  const outputTokens = Number(row.outputTokens ?? 0);
  return {
    id: Number(row.id),
    projectId: Number(row.projectId),
    projectName: String(row.projectName),
    modelId: row.modelId == null ? null : Number(row.modelId),
    modelName: row.modelName == null ? null : String(row.modelName),
    providerName: row.providerName == null ? null : String(row.providerName),
    label: String(row.label),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costEur: Number(row.costEur ?? 0),
    usedAt: String(row.usedAt),
  };
}

export function createUser(dbPath: string, email: string, password: string): User {
  initDb(dbPath);
  const db = open(dbPath);
  const normalized = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const result = db.prepare("INSERT INTO users(email, password_hash) VALUES (?, ?)").run(normalized, passwordHash);
  const user = { id: Number(result.lastInsertRowid), email: normalized, passwordHash };
  db.close();
  return user;
}

export function verifyUser(dbPath: string, email: string, password: string): User | null {
  initDb(dbPath);
  const db = open(dbPath);
  const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase()) as any;
  db.close();
  if (!row || !checkPassword(password, row.password_hash)) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}

export function getUserById(dbPath: string, userId: number): User | null {
  initDb(dbPath);
  const db = open(dbPath);
  const row = db.prepare("SELECT id, email, password_hash FROM users WHERE id = ?").get(userId) as any;
  db.close();
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
}

export function createProject(dbPath: string, userId: number, name: string, description = ""): Project {
  initDb(dbPath);
  const db = open(dbPath);
  const result = db.prepare("INSERT INTO projects(name, description, owner_user_id) VALUES (?, ?, ?)").run(name.trim(), description.trim(), userId);
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, 'owner')").run(id, userId);
  db.close();
  return { id, name: name.trim(), description: description.trim(), ownerUserId: userId };
}

export function userCanAccessProject(dbPath: string, userId: number, projectId: number) {
  initDb(dbPath);
  const db = open(dbPath);
  const row = db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, projectId);
  db.close();
  return Boolean(row);
}

export function seedDefaultProviders(dbPath = defaultDbPath) {
  initDb(dbPath);
  const db = open(dbPath);
  const providers = [
    { name: "OpenAI", models: ["GPT-4.1", "GPT-4.1 mini", "GPT-4o", "o3"] },
    { name: "OpenRouter", models: ["Claude Sonnet via OpenRouter", "Kimi K2 via OpenRouter", "DeepSeek via OpenRouter"] },
    { name: "Kimi", models: ["Kimi K2", "Moonshot v1"] },
    { name: "Ollama / Lenovo local", models: ["llama3.1 local", "qwen local", "mistral local"] },
    { name: "Mistral", models: ["Mistral Large", "Codestral"] },
    { name: "Claude", models: ["Claude Sonnet", "Claude Opus"] },
    { name: "Gemini", models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash"] },
    { name: "Groq", models: ["Llama via Groq", "Mixtral via Groq"] },
    { name: "Autre", models: ["Modèle manuel"] },
  ];
  for (const provider of providers) {
    db.prepare("INSERT OR IGNORE INTO ai_providers(name, kind) VALUES (?, 'manual')").run(provider.name);
    const providerRow = db.prepare("SELECT id FROM ai_providers WHERE name = ?").get(provider.name) as any;
    for (const model of provider.models) {
      db.prepare("INSERT OR IGNORE INTO ai_models(provider_id, name) VALUES (?, ?)").run(providerRow.id, model);
    }
  }
  db.close();
}

export function recordUsageEntry(dbPath: string, userId: number, input: UsageInput): UsageEntry {
  initDb(dbPath);
  seedDefaultProviders(dbPath);
  const db = open(dbPath);
  try {
    const canAccess = db.prepare("SELECT 1 FROM project_members WHERE user_id = ? AND project_id = ?").get(userId, input.projectId);
    if (!canAccess) throw new Error("Accès projet refusé");

    const modelId = input.modelId ? Number(input.modelId) : null;
    if (modelId) {
      const modelExists = db.prepare("SELECT 1 FROM ai_models WHERE id = ?").get(modelId);
      if (!modelExists) throw new Error("Modèle IA inconnu");
    }

    const label = input.label.trim() || "Saisie manuelle";
    const inputTokens = toNonNegativeInteger(input.inputTokens);
    const outputTokens = toNonNegativeInteger(input.outputTokens);
    const costEur = toNonNegativeMoney(input.costEur);
    const usedAt = input.usedAt?.trim() || new Date().toISOString().slice(0, 10);

    const result = db.prepare(`INSERT INTO ai_usage_entries(project_id, model_id, label, input_tokens, output_tokens, cost_eur, used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.projectId, modelId, label, inputTokens, outputTokens, costEur, usedAt);

    const row = db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName,
      pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens,
      e.cost_eur as costEur, e.used_at as usedAt
      FROM ai_usage_entries e
      JOIN projects p ON p.id = e.project_id
      LEFT JOIN ai_models m ON m.id = e.model_id
      LEFT JOIN ai_providers pr ON pr.id = m.provider_id
      WHERE e.id = ?`).get(Number(result.lastInsertRowid)) as any;
    return rowToEntry(row);
  } finally {
    db.close();
  }
}

export function listDashboardData(dbPath: string, userId: number, selectedProjectId?: number) {
  initDb(dbPath);
  seedDefaultProviders(dbPath);
  const db = open(dbPath);
  const projects = db.prepare(`SELECT p.id, p.name, p.description, p.owner_user_id as ownerUserId
    FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id DESC`).all(userId) as Project[];
  const providers = db.prepare("SELECT id, name, kind FROM ai_providers ORDER BY id").all() as Provider[];
  const models = db.prepare(`SELECT m.id, m.provider_id as providerId, p.name as providerName, m.name
    FROM ai_models m JOIN ai_providers p ON p.id = m.provider_id ORDER BY p.id, m.id`).all() as Model[];
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;
  const usage = db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost
    FROM ai_usage_entries e JOIN project_members pm ON pm.project_id = e.project_id WHERE pm.user_id = ?`).get(userId) as any;
  const projectUsage = selectedProject
    ? db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost
      FROM ai_usage_entries WHERE project_id = ?`).get(selectedProject.id) as any
    : { tokens: 0, cost: 0 };
  const usageEntries = db.prepare(`SELECT e.id, e.project_id as projectId, p.name as projectName, e.model_id as modelId, m.name as modelName,
    pr.name as providerName, e.label, e.input_tokens as inputTokens, e.output_tokens as outputTokens,
    e.cost_eur as costEur, e.used_at as usedAt
    FROM ai_usage_entries e
    JOIN projects p ON p.id = e.project_id
    JOIN project_members pm ON pm.project_id = e.project_id AND pm.user_id = ?
    LEFT JOIN ai_models m ON m.id = e.model_id
    LEFT JOIN ai_providers pr ON pr.id = m.provider_id
    WHERE (? IS NULL OR e.project_id = ?)
    ORDER BY e.used_at DESC, e.id DESC LIMIT 30`).all(userId, selectedProject?.id ?? null, selectedProject?.id ?? null).map(rowToEntry);
  db.close();
  return {
    projects,
    providers,
    models,
    selectedProject,
    usageEntries,
    usage: { tokens: Number(usage.tokens), cost: Number(usage.cost) },
    projectUsage: { tokens: Number(projectUsage.tokens), cost: Number(projectUsage.cost) },
  };
}

export const DB_PATH = defaultDbPath;
