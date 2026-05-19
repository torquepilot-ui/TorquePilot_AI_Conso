import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  initDb,
  createUser,
  verifyUser,
  createProject,
  deleteProject,
  userCanAccessProject,
  seedDefaultProviders,
  listDashboardData,
  recordUsageEntry,
  createAiAccount,
  updateAiAccount,
  deleteAiAccount,
  assignAiAccountToProject,
  updateProjectAiSetup,
  deleteProjectAiSetup,
  estimateProjectUsage,
  estimateTokensFromText,
  importAutomaticUsage,
  importConnectorUsage,
  importHermesLocalUsage,
  previewHermesLocalUsage,
  importUsageInbox,
  previewUsageInbox,
  getUsageCollectorHealth,
  buildUsageReport,
  saveUsageReportFile,
  buildUsageChartData,
  listSavedUsageReports,
  readSavedUsageReport,
  deleteSavedUsageReport,
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

test("catalogue local enrichi : catégories et tarifs API automatiques", () => {
  const categories = new Set(MODEL_CATALOG.map((m) => m.category));
  assert.ok(categories.has("text"));
  assert.ok(categories.has("image"));
  assert.ok(categories.has("search"));
  assert.ok(categories.has("tts"));
  assert.ok(categories.has("stt"));
  assert.ok(MODEL_CATALOG.some((m) => m.providerSlug === "openai" && m.apiModelId === "gpt-4.1-2025-04-14" && m.inputPricePerMillion === 2 && m.outputPricePerMillion === 8));
  assert.ok(MODEL_CATALOG.some((m) => m.category === "image" && m.imagePrice !== null));
});

test("providers/modèles par défaut + données dashboard enrichies catalogue local", () => {
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

test("modification et suppression des comptes IA et affectations projet", () => {
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

    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI API", connectionType: "api" });
    const updatedAccount = updateAiAccount(dbPath, user.id, account.id, {
      providerId: openai.id,
      name: "ChatGPT Plus Rudy",
      connectionType: "subscription",
      subscriptionName: "ChatGPT Plus",
      monthlyCostEur: 22,
      notes: "Compte principal",
    });
    assert.equal(updatedAccount.name, "ChatGPT Plus Rudy");
    assert.equal(updatedAccount.connectionType, "subscription");
    assert.equal(updatedAccount.monthlyCostEur, 22);

    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id });
    const updatedSetup = updateProjectAiSetup(dbPath, user.id, setup.id, {
      projectId: project.id,
      accountId: account.id,
      modelId: gpt.id,
      connectionType: "api",
      label: "API principale TorquePilot",
      inputPricePerMillion: 3,
      outputPricePerMillion: 9,
    });
    assert.equal(updatedSetup.label, "API principale TorquePilot");
    assert.equal(updatedSetup.connectionType, "api");
    assert.equal(updatedSetup.inputPricePerMillion, 3);

    assert.throws(() => updateAiAccount(dbPath, other.id, account.id, { name: "Intrusion", connectionType: "api" }), /Compte IA inconnu/);
    assert.equal(deleteProjectAiSetup(dbPath, user.id, setup.id), true);
    assert.equal(deleteAiAccount(dbPath, user.id, account.id), true);
    const dashboard = listDashboardData(dbPath, user.id, project.id);
    assert.equal(dashboard.projectAiSetups.length, 0);
    assert.equal(dashboard.aiAccounts.length, 0);
  } finally {
    cleanup();
  }
});

test("suppression compte IA conserve l'historique usage et retire les liens", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "delete-usage@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "Projet usage", "");
    const data = listDashboardData(dbPath, user.id, project.id);
    const account = createAiAccount(dbPath, user.id, { providerId: data.providers[0].id, name: "Compte à supprimer", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: data.models[0].id });

    estimateProjectUsage(dbPath, user.id, {
      projectId: project.id,
      setupId: setup.id,
      label: "Historique à garder",
      inputText: "question test",
      outputText: "réponse test",
    });

    assert.equal(deleteAiAccount(dbPath, user.id, account.id), true);
    const dashboard = listDashboardData(dbPath, user.id, project.id);
    assert.equal(dashboard.aiAccounts.length, 0);
    assert.equal(dashboard.projectAiSetups.length, 0);
    assert.equal(dashboard.usageEntries.length, 1);
  } finally {
    cleanup();
  }
});

test("suppression projet supprime proprement données liées et reste isolée", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "delete-project@example.local", "secret-test");
    const other = createUser(dbPath, "delete-project-other@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "Projet à supprimer", "");
    const otherProject = createProject(dbPath, other.id, "Projet autre", "");
    const data = listDashboardData(dbPath, user.id, project.id);
    const account = createAiAccount(dbPath, user.id, { providerId: data.providers[0].id, name: "Compte projet", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: data.models[0].id });
    estimateProjectUsage(dbPath, user.id, { projectId: project.id, setupId: setup.id, label: "Usage projet", inputText: "a", outputText: "b" });

    assert.throws(() => deleteProject(dbPath, other.id, project.id), /Projet inconnu/);
    assert.equal(deleteProject(dbPath, user.id, project.id), true);
    assert.equal(userCanAccessProject(dbPath, user.id, project.id), false);
    assert.deepEqual(listDashboardData(dbPath, user.id).projects.map((p) => p.id), []);
    assert.deepEqual(listDashboardData(dbPath, other.id).projects.map((p) => p.id), [otherProject.id]);
  } finally {
    cleanup();
  }
});

test("retrait IA affectée conserve l'historique usage et retire le lien", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "delete-setup@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "Projet setup", "");
    const data = listDashboardData(dbPath, user.id, project.id);
    const account = createAiAccount(dbPath, user.id, { providerId: data.providers[0].id, name: "Compte setup", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: data.models[0].id });
    estimateProjectUsage(dbPath, user.id, { projectId: project.id, setupId: setup.id, label: "Historique setup", inputText: "question", outputText: "réponse" });

    assert.equal(deleteProjectAiSetup(dbPath, user.id, setup.id), true);
    const dashboard = listDashboardData(dbPath, user.id, project.id);
    assert.equal(dashboard.projectAiSetups.length, 0);
    assert.equal(dashboard.usageEntries.length, 1);
  } finally {
    cleanup();
  }
});

test("interface publique sans mention KIRO", () => {
  const page = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
  assert.equal(/KIRO/i.test(page), false);
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

test("Phase 4I : aperçu guidé inbox détecte fichiers prêts sans les déplacer", () => {
  const { dbPath, cleanup } = tempDb();
  const inboxRoot = mkdtempSync(join(tmpdir(), "tp-usage-inbox-preview-"));
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI API", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });
    const openaiInbox = join(inboxRoot, "openai", "inbox");
    const localInbox = join(inboxRoot, "local", "inbox");
    mkdirSync(openaiInbox, { recursive: true });
    mkdirSync(localInbox, { recursive: true });
    const okFile = join(openaiInbox, "usage-openai.jsonl");
    const badFile = join(localInbox, "empty.log");
    writeFileSync(okFile, JSON.stringify({ id: "resp_phase4i", created_at: 1778323200, usage: { input_tokens: 1200, output_tokens: 300 } }));
    writeFileSync(badFile, "");

    const preview = previewUsageInbox(inboxRoot, "2026-05-10");

    assert.equal(preview.totals.files, 2);
    assert.equal(preview.totals.readyFiles, 1);
    assert.equal(preview.totals.failedFiles, 1);
    assert.equal(preview.totals.detectedCount, 1);
    assert.equal(preview.totals.inputTokens, 1200);
    assert.equal(preview.totals.outputTokens, 300);
    assert.equal(preview.files.find((file) => file.fileName === "usage-openai.jsonl")?.status, "ready");
    assert.match(preview.files.find((file) => file.fileName === "empty.log")?.errorMessage || "", /Aucun usage importable/);
    assert.equal(existsSync(okFile), true);
    assert.equal(existsSync(badFile), true);

    const result = importUsageInbox(dbPath, user.id, { rootDir: inboxRoot, projectId: project.id, setupId: setup.id });
    assert.equal(result.processedFiles, 1);
    assert.equal(result.failedFiles, 1);
  } finally {
    cleanup();
    rmSync(inboxRoot, { recursive: true, force: true });
  }
});

test("Phase 4D : collecteur local importe inbox puis déplace en processed", () => {
  const { dbPath, cleanup } = tempDb();
  const inboxRoot = mkdtempSync(join(tmpdir(), "tp-usage-inbox-"));
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI API", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });
    const inbox = join(inboxRoot, "openai", "inbox");
    mkdirSync(inbox, { recursive: true });
    const filePath = join(inbox, "usage-openai.jsonl");
    writeFileSync(filePath, JSON.stringify({ id: "resp_phase4d", created_at: 1778323200, usage: { input_tokens: 1000, output_tokens: 250 } }));

    const result = importUsageInbox(dbPath, user.id, { rootDir: inboxRoot, projectId: project.id, setupId: setup.id });

    assert.equal(result.processedFiles, 1);
    assert.equal(result.failedFiles, 0);
    assert.equal(result.importedCount, 1);
    assert.equal(result.totalInputTokens, 1000);
    assert.equal(result.totalOutputTokens, 250);
    assert.equal(existsSync(filePath), false);
    assert.equal(existsSync(join(inboxRoot, "openai", "processed", basename(filePath))), true);
    const health = getUsageCollectorHealth(dbPath, user.id, inboxRoot);
    assert.equal(health.pendingFiles, 0);
    assert.equal(health.processedFiles, 1);
    assert.equal(health.failedFiles, 0);
    assert.equal(health.lastRun?.status, "success");
  } finally {
    cleanup();
    rmSync(inboxRoot, { recursive: true, force: true });
  }
});

test("Phase 4D : collecteur local journalise les échecs et déplace en failed", () => {
  const { dbPath, cleanup } = tempDb();
  const inboxRoot = mkdtempSync(join(tmpdir(), "tp-usage-inbox-"));
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "Local Lab", "Logs locaux");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "Compte local", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });
    const inbox = join(inboxRoot, "local", "inbox");
    mkdirSync(inbox, { recursive: true });
    const badFile = join(inbox, "empty.log");
    writeFileSync(badFile, "");

    const result = importUsageInbox(dbPath, user.id, { rootDir: inboxRoot, projectId: project.id, setupId: setup.id });

    assert.equal(result.processedFiles, 0);
    assert.equal(result.failedFiles, 1);
    assert.equal(result.importedCount, 0);
    assert.equal(existsSync(badFile), false);
    assert.equal(existsSync(join(inboxRoot, "local", "failed", basename(badFile))), true);
    const health = getUsageCollectorHealth(dbPath, user.id, inboxRoot);
    assert.equal(health.failedFiles, 1);
    assert.equal(health.lastRun?.status, "failed");
    assert.match(health.recentRuns[0].errorMessage || "", /Aucun usage importable/);
  } finally {
    cleanup();
    rmSync(inboxRoot, { recursive: true, force: true });
  }
});

test("Phase 4F : rapport consommation exportable CSV et sauvegardé", () => {
  const { dbPath, cleanup } = tempDb();
  const reportDir = mkdtempSync(join(tmpdir(), "tp-usage-reports-"));
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const other = createUser(dbPath, "other@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI API", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });
    importConnectorUsage(dbPath, user.id, {
      connector: "openai",
      projectId: project.id,
      setupId: setup.id,
      sourceName: "OpenAI export",
      rawExport: JSON.stringify({ id: "resp_report", created_at: 1778323200, usage: { input_tokens: 1200, output_tokens: 300 } }),
    });

    const report = buildUsageReport(dbPath, user.id, project.id, "csv");

    assert.equal(report.projectName, "TorquePilot");
    assert.equal(report.totals.totalTokens, 1500);
    assert.equal(report.totals.inputTokens, 1200);
    assert.equal(report.totals.outputTokens, 300);
    assert.match(report.content, /date,projet,fournisseur,modele,libelle,input_tokens,output_tokens,total_tokens,cost_eur/);
    assert.match(report.content, /resp_report/);
    assert.equal(report.mimeType, "text/csv; charset=utf-8");
    assert.throws(() => buildUsageReport(dbPath, other.id, project.id, "csv"), /Accès projet refusé/);

    const saved = saveUsageReportFile(dbPath, user.id, { projectId: project.id, format: "csv", outputDir: reportDir });
    assert.equal(existsSync(saved.filePath), true);
    assert.equal(saved.fileName.endsWith(".csv"), true);
    assert.match(readFileSync(saved.filePath, "utf8"), /TorquePilot/);
  } finally {
    cleanup();
    rmSync(reportDir, { recursive: true, force: true });
  }
});


test("Phase 4G : rapports sauvegardés listables, téléchargeables et supprimables", () => {
  const { dbPath, cleanup } = tempDb();
  const reportDir = mkdtempSync(join(tmpdir(), "tp-saved-reports-"));
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI API", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });
    estimateProjectUsage(dbPath, user.id, { projectId: project.id, setupId: setup.id, label: "session rapport", inputText: "prompt", outputText: "réponse" });

    const csv = saveUsageReportFile(dbPath, user.id, { projectId: project.id, format: "csv", outputDir: reportDir });
    const json = saveUsageReportFile(dbPath, user.id, { projectId: project.id, format: "json", outputDir: reportDir });
    const reports = listSavedUsageReports(reportDir);

    assert.equal(reports.length, 2);
    assert.equal(reports.some((r) => r.fileName === csv.fileName && r.format === "csv" && r.sizeBytes > 0), true);
    assert.equal(reports.some((r) => r.fileName === json.fileName && r.format === "json" && r.sizeBytes > 0), true);

    const downloaded = readSavedUsageReport(reportDir, csv.fileName);
    assert.equal(downloaded.fileName, csv.fileName);
    assert.equal(downloaded.mimeType, "text/csv; charset=utf-8");
    assert.match(downloaded.content, /rapport|date,projet|TorquePilot/i);

    assert.throws(() => readSavedUsageReport(reportDir, "../secret.txt"), /Nom de rapport refusé/);
    assert.equal(deleteSavedUsageReport(reportDir, csv.fileName), true);
    assert.equal(existsSync(csv.filePath), false);
    assert.equal(deleteSavedUsageReport(reportDir, "rapport-consommation-tokens-absent-2026-05-10.csv"), false);
  } finally {
    cleanup();
    rmSync(reportDir, { recursive: true, force: true });
  }
});

test("Phase 4H : agrégats graphiques isolés par projet et utilisateur", () => {
  const { dbPath, cleanup } = tempDb();
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "rudy@example.local", "secret-test");
    const other = createUser(dbPath, "other@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "TorquePilot", "RAG mécanique");
    const otherProject = createProject(dbPath, user.id, "T.E.D.", "Pilote Tahiti");
    const data = listDashboardData(dbPath, user.id);
    const openai = data.providers.find((p) => p.name === "OpenAI")!;
    const gpt = data.models.find((m) => m.name === "GPT-4.1")!;
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "OpenAI API", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });
    const otherSetup = assignAiAccountToProject(dbPath, user.id, { projectId: otherProject.id, accountId: account.id, modelId: gpt.id, connectionType: "api" });

    importConnectorUsage(dbPath, user.id, { connector: "openai", projectId: project.id, setupId: setup.id, sourceName: "jour 1", usedAt: "2026-05-08", rawExport: JSON.stringify({ id: "a", usage: { input_tokens: 1000, output_tokens: 500 } }) });
    importConnectorUsage(dbPath, user.id, { connector: "openai", projectId: project.id, setupId: setup.id, sourceName: "jour 2", usedAt: "2026-05-09", rawExport: JSON.stringify({ id: "b", usage: { input_tokens: 2000, output_tokens: 1000 } }) });
    importConnectorUsage(dbPath, user.id, { connector: "openai", projectId: otherProject.id, setupId: otherSetup.id, sourceName: "hors scope", usedAt: "2026-05-09", rawExport: JSON.stringify({ id: "c", usage: { input_tokens: 9000, output_tokens: 9000 } }) });

    const charts = buildUsageChartData(dbPath, user.id, project.id);

    assert.equal(charts.projectId, project.id);
    assert.equal(charts.totals.entries, 2);
    assert.equal(charts.totals.inputTokens, 3000);
    assert.equal(charts.totals.outputTokens, 1500);
    assert.equal(charts.totals.totalTokens, 4500);
    assert.equal(charts.daily.length, 2);
    assert.deepEqual(charts.daily.map((d) => [d.date, d.totalTokens]), [["2026-05-08", 1500], ["2026-05-09", 3000]]);
    assert.equal(charts.daily[1].maxRatio, 1);
    assert.equal(charts.topProviders[0].name, "OpenAI");
    assert.equal(charts.topProviders[0].totalTokens, 4500);
    assert.equal(charts.topModels[0].name, "GPT-4.1");
    assert.throws(() => buildUsageChartData(dbPath, other.id, project.id), /Accès projet refusé/);
  } finally {
    cleanup();
  }
});


test("connecteur HERMES local : importe les métriques sessions sans doublons", () => {
  const { dbPath, cleanup } = tempDb();
  const hermesDir = mkdtempSync(join(tmpdir(), "tp-hermes-"));
  const hermesDbPath = join(hermesDir, "state.db");
  try {
    initDb(dbPath);
    seedDefaultProviders(dbPath);
    const user = createUser(dbPath, "hermes@example.local", "secret-test");
    const project = createProject(dbPath, user.id, "HERMES — Limule TEMPEST", "Compteur local");
    const data = listDashboardData(dbPath, user.id, project.id);
    const openai = data.providers.find((p) => p.name === "OpenAI") ?? data.providers[0];
    const gpt = data.models.find((m) => m.name === "GPT-4.1") ?? data.models[0];
    const account = createAiAccount(dbPath, user.id, { providerId: openai.id, name: "HERMES Local", connectionType: "api" });
    const setup = assignAiAccountToProject(dbPath, user.id, { projectId: project.id, accountId: account.id, modelId: gpt.id, connectionType: "api", label: "HERMES Local Usage" });

    const hdb = new DatabaseSync(hermesDbPath);
    hdb.exec(`CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      model TEXT,
      started_at REAL NOT NULL,
      ended_at REAL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      billing_provider TEXT,
      estimated_cost_usd REAL,
      actual_cost_usd REAL,
      api_call_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      title TEXT,
      system_prompt TEXT
    );
    CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, content TEXT);`);
    hdb.prepare(`INSERT INTO sessions(id, source, model, started_at, ended_at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, billing_provider, estimated_cost_usd, actual_cost_usd, api_call_count, tool_call_count, title, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("sess-1", "telegram", "gpt-4.1", 1770000000, 1770000060, 100, 50, 10, 5, 7, "openai", 0.01, 0.02, 2, 1, "Titre privé", "Prompt privé");
    hdb.prepare(`INSERT INTO messages(session_id, content) VALUES (?, ?)`).run("sess-1", "contenu privé à ne jamais importer");
    hdb.close();

    const preview = previewHermesLocalUsage(hermesDbPath, "test");
    assert.equal(preview.importableSessions, 1);
    assert.equal(preview.inputTokens, 100);
    assert.equal(preview.cacheTokens, 15);
    assert.equal(preview.outputTokens, 50);
    assert.equal(preview.reasoningTokens, 7);

    const first = importHermesLocalUsage(dbPath, user.id, { projectId: project.id, setupId: setup.id, hermesDbPath, profileName: "test" });
    assert.equal(first.importedCount, 1);
    assert.equal(first.entries[0].inputTokens, 115);
    assert.equal(first.entries[0].outputTokens, 57);
    assert.equal(first.entries[0].usedAt, "2026-02-02");
    assert.match(first.entries[0].label, /HERMES test · gpt-4\.1 · telegram/);

    const second = importHermesLocalUsage(dbPath, user.id, { projectId: project.id, setupId: setup.id, hermesDbPath, profileName: "test" });
    assert.equal(second.importedCount, 0);
    const refreshed = listDashboardData(dbPath, user.id, project.id);
    assert.equal(refreshed.usage.tokens, 172);
  } finally {
    cleanup();
    rmSync(hermesDir, { recursive: true, force: true });
  }
});
