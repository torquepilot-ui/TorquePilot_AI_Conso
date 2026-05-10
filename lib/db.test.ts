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
  createAiAccount,
  assignAiAccountToProject,
  estimateProjectUsage,
  estimateTokensFromText,
  importAutomaticUsage,
  importConnectorUsage,
} from "./db.ts";
import { MODEL_CATALOG } from "./model-catalog.ts";

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

test("catalogue KIRO enrichi : catégories et tarifs API automatiques", () => {
  const categories = new Set(MODEL_CATALOG.map((m) => m.category));
  assert.ok(categories.has("text"));
  assert.ok(categories.has("image"));
  assert.ok(categories.has("search"));
  assert.ok(categories.has("tts"));
  assert.ok(categories.has("stt"));
  assert.ok(MODEL_CATALOG.some((m) => m.providerSlug === "openai" && m.apiModelId === "gpt-4.1-2025-04-14" && m.inputPricePerMillion === 2 && m.outputPricePerMillion === 8));
  assert.ok(MODEL_CATALOG.some((m) => m.category === "image" && m.imagePrice !== null));
});

test("providers/modèles par défaut + données dashboard enrichies KIRO", () => {
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
    assert.ok(data.models.some((m) => m.inputPricePerMillion !== null));
    assert.ok(data.models.some((m) => m.category === "image" && m.imagePrice !== null));
    assert.ok(data.models.some((m) => m.category === "stt" && m.pricingUnit === "audio_minute"));
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

test("comptes IA abonnement/API affectés au projet", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "T.E.D.", "Pilote Tahiti");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.providerName === "OpenAI")!;

    const sub = createAiAccount(dbPath, user.id, {
      providerId: openai.id,
      name: "ChatGPT Rudy",
      connectionType: "subscription",
      subscriptionName: "ChatGPT Plus",
      monthlyCostEur: 22,
    });
    assert.equal(sub.connectionType, "subscription");
    assert.equal(sub.monthlyCostEur, 22);

    const setup = assignAiAccountToProject(dbPath, user.id, {
      projectId: project.id,
      accountId: sub.id,
      modelId: gpt.id,
      label: "Compte principal T.E.D.",
    });
    assert.equal(setup.projectId, project.id);
    assert.equal(setup.subscriptionName, "ChatGPT Plus");

    const dashboard = listDashboardData(dbPath, user.id, project.id);
    assert.equal(dashboard.aiAccounts.length, 1);
    assert.equal(dashboard.projectAiSetups.length, 1);
    assert.equal(dashboard.projectUsage.subscriptionMonthly, 22);
  } finally {
    cleanup();
  }
});

test("estimation automatique tokens/coût pour configuration API", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const rudy = createUser(dbPath, "rudy@example.local", "secret-test");
    const other = createUser(dbPath, "other@example.local", "secret-test");
    const project = createProject(dbPath, rudy.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, rudy.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const api = createAiAccount(dbPath, rudy.id, { providerId: openai.id, name: "OpenAI API TorquePilot", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, rudy.id, { projectId: project.id, accountId: api.id, modelId: gpt.id });

    const inputText = "a".repeat(4000);
    const outputText = "b".repeat(2000);
    const entry = estimateProjectUsage(dbPath, rudy.id, { projectId: project.id, setupId: setup.id, label: "Estimation API", inputText, outputText, usedAt: "2026-05-09" });
    assert.equal(entry.inputTokens, estimateTokensFromText(inputText));
    assert.equal(entry.outputTokens, estimateTokensFromText(outputText));
    assert.equal(entry.costEur, 0.006);

    assert.throws(() => estimateProjectUsage(dbPath, other.id, { projectId: project.id, setupId: setup.id, label: "intrusion", inputText: "x", outputText: "y" }), /Accès projet refusé/);
  } finally {
    cleanup();
  }
});

test("Phase 4B : import automatique JSON/JSONL de logs d'usage", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const rudy = createUser(dbPath, "rudy@example.local", "secret-test");
    const other = createUser(dbPath, "other@example.local", "secret-test");
    const project = createProject(dbPath, rudy.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, rudy.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const api = createAiAccount(dbPath, rudy.id, { providerId: openai.id, name: "OpenAI API TorquePilot", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, rudy.id, { projectId: project.id, accountId: api.id, modelId: gpt.id });
    const rawExport = [
      JSON.stringify({ timestamp: "2026-05-09T10:00:00Z", model: "gpt-4.1-2025-04-14", prompt_tokens: 1000, completion_tokens: 500, request_id: "req_1" }),
      JSON.stringify({ created_at: "2026-05-09T11:00:00Z", input_tokens: 2000, output_tokens: 1000, label: "diagnostic" }),
    ].join("\n");

    const result = importAutomaticUsage(dbPath, rudy.id, { projectId: project.id, setupId: setup.id, sourceName: "OpenAI usage export", rawExport });
    assert.equal(result.importedCount, 2);
    assert.equal(result.totalInputTokens, 3000);
    assert.equal(result.totalOutputTokens, 1500);
    assert.equal(result.totalCostEur, 0.018);
    assert.equal(result.entries[0].label, "OpenAI usage export · req_1");
    assert.equal(result.entries[1].label, "diagnostic");

    const dashboard = listDashboardData(dbPath, rudy.id, project.id);
    assert.equal(dashboard.projectUsage.tokens, 4500);
    assert.equal(dashboard.projectUsage.cost, 0.018);
    assert.equal(dashboard.usageEntries.length, 2);

    assert.throws(() => importAutomaticUsage(dbPath, other.id, { projectId: project.id, setupId: setup.id, sourceName: "intrusion", rawExport }), /Accès projet refusé/);
  } finally {
    cleanup();
  }
});

test("Phase 4B : import automatique texte brut estime les tokens sans coût manuel", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "T.E.D.", "Pilote Tahiti");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "ChatGPT export", connectionType: "subscription", monthlyCostEur: 22 });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "subscription" });

    const rawExport = `User: ${"p".repeat(400)}\nAssistant: ${"r".repeat(800)}`;
    const result = importAutomaticUsage(dbPath, user.id, { projectId: project.id, setupId: setup.id, sourceName: "Conversation collée", rawExport, usedAt: "2026-05-09" });
    assert.equal(result.importedCount, 1);
    assert.equal(result.totalInputTokens, estimateTokensFromText("p".repeat(400)));
    assert.equal(result.totalOutputTokens, estimateTokensFromText("r".repeat(800)));
    assert.equal(result.totalCostEur, 0);
    assert.equal(result.entries[0].label, "Conversation collée");
  } finally {
    cleanup();
  }
});

test("Phase 4C : connecteur OpenAI importe un export réel Responses/usage", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const other = createUser(dbPath, "other@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI usage export", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });

    const rawExport = JSON.stringify({
      object: "list",
      data: [
        { id: "resp_1", created_at: 1778323200, model: "gpt-4.1-2025-04-14", usage: { input_tokens: 1200, output_tokens: 400 } },
        { id: "chatcmpl_2", created: 1778326800, usage: { prompt_tokens: 800, completion_tokens: 200 } },
      ],
    });
    const result = importConnectorUsage(dbPath, user.id, { connector: "openai", projectId: project.id, setupId: setup.id, sourceName: "OpenAI Responses export", rawExport });
    assert.equal(result.importedCount, 2);
    assert.equal(result.totalInputTokens, 2000);
    assert.equal(result.totalOutputTokens, 600);
    assert.equal(result.totalCostEur, 0.0088);
    assert.match(result.entries[0].label, /OpenAI · resp_1/);
    assert.equal(result.entries[0].usedAt, "2026-05-09");
    assert.throws(() => importConnectorUsage(dbPath, other.id, { connector: "openai", projectId: project.id, setupId: setup.id, sourceName: "intrusion", rawExport }), /Accès projet refusé/);
  } finally {
    cleanup();
  }
});

test("Phase 4C : connecteurs Anthropic, Gemini et Ollama normalisent les logs locaux", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "Local Lab", "Logs fournisseurs");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "Connecteurs locaux", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });

    const anthropic = importConnectorUsage(dbPath, user.id, { connector: "anthropic", projectId: project.id, setupId: setup.id, sourceName: "Claude usage", rawExport: JSON.stringify({ id: "msg_1", usage: { input_tokens: 700, output_tokens: 300 }, created_at: "2026-05-09T08:00:00Z" }) });
    const gemini = importConnectorUsage(dbPath, user.id, { connector: "google", projectId: project.id, setupId: setup.id, sourceName: "Gemini usage", rawExport: JSON.stringify({ responseId: "gem_1", usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 250 }, createTime: "2026-05-09T09:00:00Z" }) });
    const ollama = importConnectorUsage(dbPath, user.id, { connector: "ollama", projectId: project.id, setupId: setup.id, sourceName: "Ollama local", rawExport: JSON.stringify({ model: "llama3.1", prompt_eval_count: 500, eval_count: 125, created_at: "2026-05-09T10:00:00Z" }) });

    assert.equal(anthropic.totalInputTokens, 700);
    assert.equal(gemini.totalOutputTokens, 250);
    assert.equal(ollama.totalCostEur, 0);
    assert.equal(listDashboardData(dbPath, user.id, project.id).usageEntries.length, 3);
  } finally {
    cleanup();
  }
});
