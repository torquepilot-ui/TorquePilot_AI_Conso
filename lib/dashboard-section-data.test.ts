import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardSectionSummary, fallbackFreshness } from "./dashboard-section-data.ts";

test("sections dashboard : synthèse consommation/agents/alertes depuis données réelles", () => {
  const summary = buildDashboardSectionSummary({
    projects: [{ id: 1, name: "TorquePilot" }],
    selectedProject: { id: 1, name: "TorquePilot" },
    projectAiSetups: [{ connectionType: "api" }, { connectionType: "subscription" }, { connectionType: "local" }],
    aiAccounts: [{ id: 1 }, { id: 2 }],
    usageEntries: [{ id: 10 }],
    totalUsageEntries: 12,
    usage: { tokens: 1000, cost: 0.42 },
    projectUsage: { tokens: 900, cost: 0.33, subscriptionMonthly: 20 },
  }, {
    status: "ok",
    fallbackActive: false,
    activeProvider: "openai-codex",
    activeModel: "gpt-5.5",
    generatedAt: new Date().toISOString(),
    fallbackEventCount: 54,
    recentFallbackEventCount: 11,
    recentWindowHours: 24,
    lastEventType: "main_provider_active",
  });

  assert.equal(summary.projects.total, 1);
  assert.equal(summary.agents.totalSetups, 3);
  assert.equal(summary.agents.apiSetups, 1);
  assert.equal(summary.consumption.totalTokens, 1000);
  assert.equal(summary.logs.fallbackEvents, 54);
  assert.equal(summary.alerts.fallbackFrequent, true);
});

test("sections dashboard : fraîcheur fallback signale JSON stale", () => {
  const now = Date.parse("2026-05-23T08:00:00.000Z");
  assert.deepEqual(fallbackFreshness("2026-05-23T07:59:30.000Z", now), { label: "30s", stale: false });
  assert.deepEqual(fallbackFreshness("2026-05-23T07:57:00.000Z", now), { label: "3min", stale: true });
  assert.equal(fallbackFreshness(undefined, now).stale, true);
});
