import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type User = { id: number; email: string; passwordHash: string };
export type Project = { id: number; name: string; description: string | null; ownerUserId: number };
export type Provider = { id: number; name: string; kind: string };

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
  const providers = ["OpenAI", "OpenRouter", "Kimi", "Ollama / Lenovo local", "Mistral", "Claude", "Gemini", "Groq", "Autre"];
  for (const name of providers) db.prepare("INSERT OR IGNORE INTO ai_providers(name, kind) VALUES (?, 'manual')").run(name);
  db.close();
}

export function listDashboardData(dbPath: string, userId: number) {
  initDb(dbPath);
  seedDefaultProviders(dbPath);
  const db = open(dbPath);
  const projects = db.prepare(`SELECT p.id, p.name, p.description, p.owner_user_id as ownerUserId
    FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id DESC`).all(userId) as Project[];
  const providers = db.prepare("SELECT id, name, kind FROM ai_providers ORDER BY id").all() as Provider[];
  const usage = db.prepare(`SELECT coalesce(sum(input_tokens + output_tokens),0) as tokens, coalesce(sum(cost_eur),0) as cost
    FROM ai_usage_entries e JOIN project_members pm ON pm.project_id = e.project_id WHERE pm.user_id = ?`).get(userId) as any;
  db.close();
  return { projects, providers, usage: { tokens: Number(usage.tokens), cost: Number(usage.cost) } };
}

export const DB_PATH = defaultDbPath;
