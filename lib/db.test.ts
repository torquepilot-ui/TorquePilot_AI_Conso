import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initDb,
  createUser,
  verifyUser,
  createProject,
  userCanAccessProject,
  seedDefaultProviders,
  listDashboardData,
  recordUsageEntry,
} from "./db.ts";

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), "tp-conso-"));
  const dbPath = join(dir, "test.sqlite");
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("auth sécurisée + isolation projet", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    const user = createUser(dbPath, "torquepilot34@gmail.com", "secret-test");
    assert.equal(user.email, "torquepilot34@gmail.com");
    assert.notEqual(user.passwordHash, "secret-test");
    assert.equal(verifyUser(dbPath, "torquepilot34@gmail.com", "secret-test")?.id, user.id);
    assert.equal(verifyUser(dbPath, "torquepilot34@gmail.com", "bad"), null);

    const project = createProject(dbPath, user.id, "BEES Lab", "Projet isolé");
    assert.equal(userCanAccessProject(dbPath, user.id, project.id), true);
    assert.equal(userCanAccessProject(dbPath, user.id + 99, project.id), false);
  } finally {
    cleanup();
  }
});

test("providers/modèles par défaut + données dashboard", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, user.id);
    assert.equal(data.projects.length, 1);
    assert.ok(data.providers.some((p) => p.name === "OpenAI"));
    assert.ok(data.providers.some((p) => p.name === "Ollama / Lenovo local"));
    assert.ok(data.models.some((m) => m.name === "GPT-4.1"));
    assert.ok(data.models.some((m) => m.providerName === "Ollama / Lenovo local"));
  } finally {
    cleanup();
  }
});

test("saisie consommation IA isolée par projet", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const rudy = createUser(dbPath, "rudy@example.local", "secret-test");
    const other = createUser(dbPath, "other@example.local", "secret-test");
    const project = createProject(dbPath, rudy.id, "TorquePilot", "RAG mécanique");
    const modelId = listDashboardData(dbPath, rudy.id).models[0].id;

    const entry = recordUsageEntry(dbPath, rudy.id, {
      projectId: project.id,
      modelId,
      label: "Test manuel",
      inputTokens: 1200,
      outputTokens: 300,
      costEur: 0.42,
      usedAt: "2026-05-09",
    });
    assert.equal(entry.totalTokens, 1500);

    const data = listDashboardData(dbPath, rudy.id, project.id);
    assert.equal(data.usage.tokens, 1500);
    assert.equal(data.projectUsage.tokens, 1500);
    assert.equal(data.usageEntries.length, 1);
    assert.equal(data.usageEntries[0].label, "Test manuel");

    assert.throws(() => recordUsageEntry(dbPath, other.id, {
      projectId: project.id,
      modelId,
      label: "Intrusion",
      inputTokens: 1,
      outputTokens: 1,
      costEur: 0,
    }), /Accès projet refusé/);
  } finally {
    cleanup();
  }
});
