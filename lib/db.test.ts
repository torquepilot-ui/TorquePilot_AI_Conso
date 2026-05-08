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

test("providers par défaut + données dashboard", () => {
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
  } finally {
    cleanup();
  }
});
